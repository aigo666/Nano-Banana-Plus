import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { ConfigService } from './ConfigService.js';
export class UserService {
    static JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
    static JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
    // 用户注册
    static async register(userData) {
        const { username, email, password, confirmPassword } = userData;
        if (password !== confirmPassword) {
            throw new Error('密码确认不匹配');
        }
        // 检查用户是否已存在
        const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existingUsers.length > 0) {
            throw new Error('用户名或邮箱已存在');
        }
        // 密码加密
        const passwordHash = await bcrypt.hash(password, 12);
        // 创建用户
        const [result] = await pool.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, passwordHash]);
        const userId = result.insertId;
        // 创建用户余额记录
        await pool.execute('INSERT INTO user_balances (user_id) VALUES (?)', [userId]);
        // 赠送新用户免费次数
        await this.grantNewUserFreeCredits(userId);
        // 获取创建的用户信息
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('用户创建失败');
        }
        // 生成JWT token
        const token = this.generateToken({ userId, email, role: user.role });
        // 更新最后登录时间
        await this.updateLastLogin(userId);
        const { password_hash, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token };
    }
    // 用户登录
    static async login(loginData) {
        const { email, password } = loginData;
        // 查找用户
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            throw new Error('用户不存在');
        }
        const user = users[0];
        // 检查用户状态
        if (user.status === 'banned') {
            throw new Error('账户已被封禁');
        }
        if (user.status === 'inactive') {
            throw new Error('账户已被禁用');
        }
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new Error('密码错误');
        }
        // 生成JWT token
        const token = this.generateToken({ userId: user.id, email: user.email, role: user.role });
        // 更新最后登录时间
        await this.updateLastLogin(user.id);
        const { password_hash, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token };
    }
    // 根据ID获取用户
    static async getUserById(id) {
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
        return users.length > 0 ? users[0] : null;
    }
    // 获取用户列表（分页）
    static async getUsers(query) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(100, Math.max(1, query.limit || 20));
        const offset = (page - 1) * limit;
        const sortBy = query.sortBy || 'created_at';
        const sortOrder = query.sortOrder || 'desc';
        const search = query.search || '';
        const vipStatus = query.vipStatus || 'all';
        const status = query.status || 'all';
        let whereConditions = [];
        let params = [];
        if (search) {
            whereConditions.push('(u.username LIKE ? OR u.email LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        if (vipStatus !== 'all') {
            if (vipStatus === 'vip') {
                whereConditions.push('u.is_member = 1 AND u.member_expires_at > NOW()');
            }
            else if (vipStatus === 'normal') {
                whereConditions.push('(u.is_member = 0 OR u.member_expires_at <= NOW() OR u.member_expires_at IS NULL)');
            }
        }
        if (status !== 'all') {
            whereConditions.push('u.status = ?');
            params.push(status);
        }
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        // 获取总数
        const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM users u ${whereClause}`, params);
        const total = countResult[0].total;
        // 获取用户列表，包含VIP信息和可用次数
        const [users] = await pool.execute(`SELECT 
        u.id, u.username, u.email, u.avatar, u.role, u.status, 
        u.is_member, u.member_expires_at, u.created_at, u.updated_at, u.last_login,
        COALESCE(ub.total_recharged, 0) as total_recharged,
        COALESCE(SUM(CASE WHEN up.status = 'active' AND up.expires_at > NOW() THEN up.times_remaining ELSE 0 END), 0) as available_times
       FROM users u
       LEFT JOIN user_balances ub ON u.id = ub.user_id
       LEFT JOIN user_packages up ON u.id = up.user_id
       ${whereClause}
       GROUP BY u.id, u.username, u.email, u.avatar, u.role, u.status, u.is_member, u.member_expires_at, u.created_at, u.updated_at, u.last_login, ub.total_recharged
       ORDER BY u.${sortBy} ${sortOrder.toUpperCase()} 
       LIMIT ${limit} OFFSET ${offset}`, params);
        return {
            items: users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    // 更新用户状态
    static async updateUserStatus(userId, status) {
        await pool.execute('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, userId]);
    }
    // 更新用户角色
    static async updateUserRole(userId, role) {
        await pool.execute('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
    }
    // 更新用户信息
    static async updateUser(id, updateData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // 构建更新字段
            const updateFields = [];
            const updateValues = [];
            if (updateData.username !== undefined) {
                updateFields.push('username = ?');
                updateValues.push(updateData.username);
            }
            if (updateData.email !== undefined) {
                updateFields.push('email = ?');
                updateValues.push(updateData.email);
            }
            if (updateData.is_member !== undefined) {
                updateFields.push('is_member = ?');
                updateValues.push(updateData.is_member);
            }
            if (updateData.member_expires_at !== undefined) {
                updateFields.push('member_expires_at = ?');
                // 如果是null，直接使用null；否则格式化为MySQL datetime格式
                if (updateData.member_expires_at === null) {
                    updateValues.push(null);
                }
                else {
                    const date = new Date(updateData.member_expires_at);
                    updateValues.push(date.toISOString().slice(0, 19).replace('T', ' '));
                }
            }
            if (updateData.role !== undefined) {
                updateFields.push('role = ?');
                updateValues.push(updateData.role);
            }
            if (updateData.status !== undefined) {
                updateFields.push('status = ?');
                updateValues.push(updateData.status);
            }
            // 处理密码更新
            if (updateData.newPassword !== undefined) {
                const passwordHash = await bcrypt.hash(updateData.newPassword, 12);
                updateFields.push('password_hash = ?');
                updateValues.push(passwordHash);
            }
            if (updateFields.length > 0) {
                updateFields.push('updated_at = NOW()');
                updateValues.push(id);
                const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
                await connection.execute(sql, updateValues);
            }
            // 如果更新了可用次数，需要更新用户套餐
            if (updateData.available_times !== undefined) {
                // 先清除现有的管理员赠送套餐
                await connection.execute('DELETE FROM user_packages WHERE user_id = ? AND package_name = "管理员赠送"', [id]);
                // 如果设置了可用次数，创建一个管理员赠送的套餐
                if (updateData.available_times > 0) {
                    const expiresAt = new Date();
                    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1年有效期
                    await connection.execute(`
            INSERT INTO user_packages (
              user_id, package_id, package_name, times_total, times_used, 
              times_remaining, price, expires_at, status, created_at, updated_at
            ) VALUES (?, NULL, '管理员赠送', ?, 0, ?, 0, ?, 'active', NOW(), NOW())
          `, [id, updateData.available_times, updateData.available_times, expiresAt]);
                }
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    // 删除用户
    static async deleteUser(userId) {
        await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    }
    // 获取用户余额
    static async getUserBalance(userId) {
        const [balances] = await pool.execute('SELECT * FROM user_balances WHERE user_id = ?', [userId]);
        return balances.length > 0 ? balances[0] : null;
    }
    // 更新用户余额
    static async updateUserBalance(userId, amount, description = '') {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // 检查用户余额记录是否存在
            const [balances] = await connection.execute('SELECT id, balance FROM user_balances WHERE user_id = ?', [userId]);
            if (balances.length === 0) {
                // 如果不存在，创建余额记录
                await connection.execute('INSERT INTO user_balances (user_id, balance, total_recharged, total_consumed) VALUES (?, ?, ?, ?)', [userId, Math.max(0, amount), amount > 0 ? amount : 0, amount < 0 ? Math.abs(amount) : 0]);
            }
            else {
                // 更新现有余额记录
                const currentBalance = parseFloat(balances[0].balance);
                const newBalance = Math.max(0, currentBalance + amount);
                if (amount > 0) {
                    // 充值
                    await connection.execute('UPDATE user_balances SET balance = ?, total_recharged = total_recharged + ? WHERE user_id = ?', [newBalance, amount, userId]);
                }
                else {
                    // 消费
                    const consumeAmount = Math.abs(amount);
                    await connection.execute('UPDATE user_balances SET balance = ?, total_consumed = total_consumed + ? WHERE user_id = ?', [newBalance, consumeAmount, userId]);
                }
            }
            // 记录余额变动日志（可选，如果有余额变动表的话）
            // await connection.execute(
            //   'INSERT INTO balance_logs (user_id, amount, description, created_at) VALUES (?, ?, ?, NOW())',
            //   [userId, amount, description]
            // );
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    // 验证JWT token
    static verifyToken(token) {
        try {
            return jwt.verify(token, this.JWT_SECRET);
        }
        catch (error) {
            throw new Error('无效的token');
        }
    }
    // 生成JWT token
    static generateToken(payload) {
        return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
    }
    // 更新最后登录时间
    static async updateLastLogin(userId) {
        await pool.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    }
    // 赠送新用户免费次数
    static async grantNewUserFreeCredits(userId) {
        try {
            // 获取系统配置
            const freeCreditsStr = await ConfigService.getConfig('new_user_free_credits');
            const expiryDaysStr = await ConfigService.getConfig('free_credits_expiry_days');
            const neverExpireStr = await ConfigService.getConfig('free_credits_never_expire');
            const freeCredits = parseInt(freeCreditsStr || '5');
            const expiryDays = parseInt(expiryDaysStr || '30');
            const neverExpire = neverExpireStr === 'true';
            // 如果免费次数为0，则不赠送
            if (freeCredits <= 0) {
                return;
            }
            // 免费次数不需要关联套餐，直接赠送
            // 计算过期时间
            let expiresAt = null;
            if (!neverExpire) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + expiryDays);
            }
            // 创建免费次数记录（不关联套餐）
            await pool.execute(`INSERT INTO user_packages 
         (user_id, package_id, package_name, times_total, times_used, times_remaining, price, expires_at, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                userId,
                null, // package_id 设为 NULL，表示不关联任何套餐
                '新用户免费次数',
                freeCredits,
                0,
                freeCredits,
                0.00,
                neverExpire ? null : expiresAt,
                'active'
            ]);
            console.log(`✅ 为用户 ${userId} 赠送了 ${freeCredits} 次免费使用次数`);
        }
        catch (error) {
            console.error('❌ 赠送免费次数失败:', error);
            // 不抛出错误，避免影响用户注册流程
        }
    }
    // 创建默认管理员账户
    static async createDefaultAdmin() {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@nanobanana.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
        // 检查管理员是否已存在
        const [existingAdmins] = await pool.execute('SELECT id FROM users WHERE email = ? AND role = "admin"', [adminEmail]);
        if (existingAdmins.length > 0) {
            console.log('✅ 默认管理员账户已存在');
            return;
        }
        try {
            const passwordHash = await bcrypt.hash(adminPassword, 12);
            const [result] = await pool.execute('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', ['admin', adminEmail, passwordHash, 'admin']);
            const userId = result.insertId;
            // 创建管理员余额记录
            await pool.execute('INSERT INTO user_balances (user_id) VALUES (?)', [userId]);
            console.log('✅ 默认管理员账户创建成功');
            console.log(`管理员邮箱: ${adminEmail}`);
            console.log(`管理员密码: ${adminPassword}`);
        }
        catch (error) {
            console.error('❌ 创建默认管理员账户失败:', error);
        }
    }
}
//# sourceMappingURL=UserService.js.map