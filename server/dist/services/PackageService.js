import { pool } from '../config/database.js';
export class PackageService {
    // 获取套餐列表（分页）
    static async getPackages(query = {}) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(100, Math.max(1, query.limit || 10));
        const offset = (page - 1) * limit;
        let whereClause = '';
        let orderClause = 'ORDER BY sort_order ASC, created_at DESC';
        const queryParams = [];
        // 搜索条件
        if (query.search) {
            whereClause = 'WHERE name LIKE ?';
            queryParams.push(`%${query.search}%`);
        }
        // 排序
        if (query.sortBy) {
            const allowedSortFields = ['name', 'times', 'validity_days', 'price', 'sort_order', 'created_at'];
            if (allowedSortFields.includes(query.sortBy)) {
                const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
                orderClause = `ORDER BY ${query.sortBy} ${sortOrder}`;
            }
        }
        // 获取总数
        const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM packages ${whereClause}`, queryParams);
        const total = countResult[0].total;
        // 获取数据
        const [rows] = await pool.execute(`SELECT * FROM packages ${whereClause} ${orderClause} LIMIT ? OFFSET ?`, [...queryParams, limit, offset]);
        return {
            items: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    // 获取活跃套餐列表（用于前端显示）
    static async getActivePackages() {
        const [rows] = await pool.execute('SELECT * FROM packages WHERE is_active = ? ORDER BY sort_order ASC, price ASC', [1]);
        return rows;
    }
    // 根据ID获取套餐
    static async getPackageById(id) {
        const [rows] = await pool.execute('SELECT * FROM packages WHERE id = ?', [id]);
        return rows.length > 0 ? rows[0] : null;
    }
    // 创建套餐
    static async createPackage(packageData) {
        const { name, description, usage_count, validity_days, price, sort_order = 0 } = packageData;
        // 检查套餐名称是否已存在
        const [existingRows] = await pool.execute('SELECT id FROM packages WHERE name = ?', [name]);
        if (existingRows.length > 0) {
            throw new Error('套餐名称已存在');
        }
        // 插入新套餐
        const [result] = await pool.execute(`INSERT INTO packages (name, description, usage_count, validity_days, price, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?)`, [name, description || null, usage_count, validity_days, price, sort_order]);
        const newPackage = await this.getPackageById(result.insertId);
        if (!newPackage) {
            throw new Error('创建套餐失败');
        }
        return newPackage;
    }
    // 更新套餐
    static async updatePackage(id, updateData) {
        const existingPackage = await this.getPackageById(id);
        if (!existingPackage) {
            throw new Error('套餐不存在');
        }
        // 如果更新名称，检查是否与其他套餐重复
        if (updateData.name && updateData.name !== existingPackage.name) {
            const [existingRows] = await pool.execute('SELECT id FROM packages WHERE name = ? AND id != ?', [updateData.name, id]);
            if (existingRows.length > 0) {
                throw new Error('套餐名称已存在');
            }
        }
        // 构建更新语句
        const updateFields = [];
        const updateValues = [];
        Object.entries(updateData).forEach(([key, value]) => {
            if (value !== undefined) {
                updateFields.push(`${key} = ?`);
                updateValues.push(value);
            }
        });
        if (updateFields.length === 0) {
            return existingPackage;
        }
        updateValues.push(id);
        await pool.execute(`UPDATE packages SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, updateValues);
        const updatedPackage = await this.getPackageById(id);
        if (!updatedPackage) {
            throw new Error('更新套餐失败');
        }
        return updatedPackage;
    }
    // 删除套餐
    static async deletePackage(id) {
        const existingPackage = await this.getPackageById(id);
        if (!existingPackage) {
            throw new Error('套餐不存在');
        }
        // 删除套餐前，将相关的user_packages记录的package_id设为NULL
        // 这样不会影响用户已获得的权益，只是断开与套餐的关联
        await pool.execute('UPDATE user_packages SET package_id = NULL WHERE package_id = ?', [id]);
        // 删除套餐
        await pool.execute('DELETE FROM packages WHERE id = ?', [id]);
    }
    // 用户购买套餐
    static async purchasePackage(userId, purchaseData) {
        const { package_id, payment_method } = purchaseData;
        // 获取套餐信息
        const packageInfo = await this.getPackageById(package_id);
        if (!packageInfo) {
            throw new Error('套餐不存在');
        }
        if (!packageInfo.is_active) {
            throw new Error('套餐已下架');
        }
        // 计算过期时间
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + packageInfo.validity_days);
        // 插入用户套餐记录
        const [result] = await pool.execute(`INSERT INTO user_packages 
       (user_id, package_id, package_name, times_total, times_remaining, price, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            userId,
            package_id,
            packageInfo.name,
            packageInfo.usage_count,
            packageInfo.usage_count,
            packageInfo.price,
            expiresAt
        ]);
        // 创建充值记录
        await pool.execute(`INSERT INTO recharge_records (user_id, amount, payment_method, status) 
       VALUES (?, ?, ?, ?)`, [userId, packageInfo.price, payment_method, 'completed']);
        // 更新用户余额（增加充值金额）
        await pool.execute(`UPDATE user_balances 
       SET total_recharged = total_recharged + ? 
       WHERE user_id = ?`, [packageInfo.price, userId]);
        // 升级用户为会员
        await this.upgradeMember(userId, expiresAt);
        // 获取购买的套餐记录
        const [userPackageRows] = await pool.execute('SELECT * FROM user_packages WHERE id = ?', [result.insertId]);
        return userPackageRows[0];
    }
    // 获取用户的套餐列表
    static async getUserPackages(userId) {
        const [rows] = await pool.execute(`SELECT * FROM user_packages 
       WHERE user_id = ? 
       ORDER BY created_at DESC`, [userId]);
        return rows;
    }
    // 获取用户的有效套餐
    static async getUserActivePackages(userId) {
        const [rows] = await pool.execute(`SELECT * FROM user_packages 
       WHERE user_id = ? 
       AND status = 'active' 
       AND times_remaining > 0 
       AND expires_at > NOW() 
       ORDER BY expires_at ASC`, [userId]);
        return rows;
    }
    // 使用套餐次数
    static async usePackageTimes(userId, times = 1) {
        // 获取用户的有效套餐（按过期时间排序，优先使用即将过期的）
        const activePackages = await this.getUserActivePackages(userId);
        let remainingTimes = times;
        for (const userPackage of activePackages) {
            if (remainingTimes <= 0)
                break;
            const useTimes = Math.min(remainingTimes, userPackage.times_remaining);
            // 更新套餐使用次数
            await pool.execute(`UPDATE user_packages 
         SET times_used = times_used + ?, 
             times_remaining = times_remaining - ?,
             status = CASE 
               WHEN times_remaining - ? <= 0 THEN 'exhausted'
               ELSE status 
             END
         WHERE id = ?`, [useTimes, useTimes, useTimes, userPackage.id]);
            remainingTimes -= useTimes;
        }
        return remainingTimes === 0;
    }
    // 检查用户是否有可用次数
    static async checkUserAvailableTimes(userId) {
        const [rows] = await pool.execute(`SELECT SUM(times_remaining) as total_times 
       FROM user_packages 
       WHERE user_id = ? 
       AND status = 'active' 
       AND times_remaining > 0 
       AND expires_at > NOW()`, [userId]);
        return rows[0]?.total_times || 0;
    }
    // 升级用户为会员
    static async upgradeMember(userId, memberExpiresAt) {
        // 获取用户当前的会员到期时间
        const [userRows] = await pool.execute('SELECT member_expires_at FROM users WHERE id = ?', [userId]);
        let newExpiresAt = memberExpiresAt;
        // 如果用户已经是会员且未过期，则在现有到期时间基础上延长
        if (userRows.length > 0 && userRows[0].member_expires_at) {
            const currentExpiresAt = new Date(userRows[0].member_expires_at);
            const now = new Date();
            if (currentExpiresAt > now) {
                // 会员未过期，在现有时间基础上延长
                const packageDays = Math.ceil((memberExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                newExpiresAt = new Date(currentExpiresAt);
                newExpiresAt.setDate(newExpiresAt.getDate() + packageDays);
            }
        }
        // 更新用户会员状态
        await pool.execute(`UPDATE users 
       SET is_member = 1, member_expires_at = ? 
       WHERE id = ?`, [newExpiresAt, userId]);
    }
    // 获取用户会员信息
    static async getUserMemberInfo(userId) {
        // 获取用户会员状态
        const [userRows] = await pool.execute('SELECT is_member, member_expires_at FROM users WHERE id = ?', [userId]);
        // 获取可用次数
        const availableTimes = await this.checkUserAvailableTimes(userId);
        const user = userRows[0];
        let isMember = user?.is_member || false;
        let memberExpiresAt = user?.member_expires_at;
        // 检查会员是否过期
        if (isMember && memberExpiresAt) {
            const expiresAt = new Date(memberExpiresAt);
            const now = new Date();
            if (expiresAt <= now) {
                // 会员已过期，更新状态
                await pool.execute('UPDATE users SET is_member = 0 WHERE id = ?', [userId]);
                isMember = false;
                memberExpiresAt = null;
            }
        }
        return {
            is_member: isMember,
            member_expires_at: memberExpiresAt,
            available_times: availableTimes
        };
    }
    // 激活套餐（用于易支付回调）
    static async activatePackage(userId, packageId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // 获取套餐信息
            const [packageRows] = await connection.execute('SELECT * FROM packages WHERE id = ? AND is_active = 1', [packageId]);
            if (packageRows.length === 0) {
                throw new Error('套餐不存在或已停用');
            }
            const packageInfo = packageRows[0];
            // 计算到期时间
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + packageInfo.validity_days);
            // 创建用户套餐记录
            await connection.execute(`INSERT INTO user_packages (user_id, package_id, times_remaining, expires_at, status)
         VALUES (?, ?, ?, ?, 'active')`, [userId, packageId, packageInfo.usage_count, expiresAt]);
            // 升级用户为会员
            await this.upgradeMember(userId, expiresAt);
            await connection.commit();
            console.log(`用户 ${userId} 套餐 ${packageId} 激活成功`);
        }
        catch (error) {
            await connection.rollback();
            console.error('激活套餐失败:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
}
//# sourceMappingURL=PackageService.js.map