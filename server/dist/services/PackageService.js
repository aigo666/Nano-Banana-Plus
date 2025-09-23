import { pool } from '../config/database.js';
export class PackageService {
    static async getPackages(query = {}) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(100, Math.max(1, query.limit || 10));
        const offset = (page - 1) * limit;
        let whereClause = '';
        let orderClause = 'ORDER BY sort_order ASC, created_at DESC';
        const queryParams = [];
        if (query.search) {
            whereClause = 'WHERE name LIKE ?';
            queryParams.push(`%${query.search}%`);
        }
        if (query.sortBy) {
            const allowedSortFields = ['name', 'times', 'validity_days', 'price', 'sort_order', 'created_at'];
            if (allowedSortFields.includes(query.sortBy)) {
                const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
                orderClause = `ORDER BY ${query.sortBy} ${sortOrder}`;
            }
        }
        const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM packages ${whereClause}`, queryParams);
        const total = countResult[0].total;
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
    static async getActivePackages() {
        const [rows] = await pool.execute('SELECT * FROM packages WHERE is_active = ? ORDER BY sort_order ASC, price ASC', [1]);
        return rows;
    }
    static async getPackageById(id) {
        const [rows] = await pool.execute('SELECT * FROM packages WHERE id = ?', [id]);
        return rows.length > 0 ? rows[0] : null;
    }
    static async createPackage(packageData) {
        const { name, description, usage_count, validity_days, price, sort_order = 0 } = packageData;
        const [existingRows] = await pool.execute('SELECT id FROM packages WHERE name = ?', [name]);
        if (existingRows.length > 0) {
            throw new Error('套餐名称已存在');
        }
        const [result] = await pool.execute(`INSERT INTO packages (name, description, usage_count, validity_days, price, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?)`, [name, description || null, usage_count, validity_days, price, sort_order]);
        const newPackage = await this.getPackageById(result.insertId);
        if (!newPackage) {
            throw new Error('创建套餐失败');
        }
        return newPackage;
    }
    static async updatePackage(id, updateData) {
        const existingPackage = await this.getPackageById(id);
        if (!existingPackage) {
            throw new Error('套餐不存在');
        }
        if (updateData.name && updateData.name !== existingPackage.name) {
            const [existingRows] = await pool.execute('SELECT id FROM packages WHERE name = ? AND id != ?', [updateData.name, id]);
            if (existingRows.length > 0) {
                throw new Error('套餐名称已存在');
            }
        }
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
    static async deletePackage(id) {
        const existingPackage = await this.getPackageById(id);
        if (!existingPackage) {
            throw new Error('套餐不存在');
        }
        await pool.execute('UPDATE user_packages SET package_id = NULL WHERE package_id = ?', [id]);
        await pool.execute('DELETE FROM packages WHERE id = ?', [id]);
    }
    static async purchasePackage(userId, purchaseData) {
        const { package_id, payment_method } = purchaseData;
        const packageInfo = await this.getPackageById(package_id);
        if (!packageInfo) {
            throw new Error('套餐不存在');
        }
        if (!packageInfo.is_active) {
            throw new Error('套餐已下架');
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + packageInfo.validity_days);
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
        await pool.execute(`INSERT INTO recharge_records (user_id, amount, payment_method, status) 
       VALUES (?, ?, ?, ?)`, [userId, packageInfo.price, payment_method, 'completed']);
        await pool.execute(`UPDATE user_balances 
       SET total_recharged = total_recharged + ? 
       WHERE user_id = ?`, [packageInfo.price, userId]);
        await this.upgradeMember(userId, expiresAt);
        const [userPackageRows] = await pool.execute('SELECT * FROM user_packages WHERE id = ?', [result.insertId]);
        return userPackageRows[0];
    }
    static async getUserPackages(userId) {
        const [rows] = await pool.execute(`SELECT * FROM user_packages 
       WHERE user_id = ? 
       ORDER BY created_at DESC`, [userId]);
        return rows;
    }
    static async getUserActivePackages(userId) {
        const [rows] = await pool.execute(`SELECT * FROM user_packages 
       WHERE user_id = ? 
       AND status = 'active' 
       AND times_remaining > 0 
       AND expires_at > NOW() 
       ORDER BY expires_at ASC`, [userId]);
        return rows;
    }
    static async usePackageTimes(userId, times = 1) {
        const activePackages = await this.getUserActivePackages(userId);
        let remainingTimes = times;
        for (const userPackage of activePackages) {
            if (remainingTimes <= 0)
                break;
            const useTimes = Math.min(remainingTimes, userPackage.times_remaining);
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
    static async checkUserAvailableTimes(userId) {
        const [rows] = await pool.execute(`SELECT SUM(times_remaining) as total_times 
       FROM user_packages 
       WHERE user_id = ? 
       AND status = 'active' 
       AND times_remaining > 0 
       AND expires_at > NOW()`, [userId]);
        return rows[0]?.total_times || 0;
    }
    static async upgradeMember(userId, memberExpiresAt) {
        const [userRows] = await pool.execute('SELECT member_expires_at FROM users WHERE id = ?', [userId]);
        let newExpiresAt = memberExpiresAt;
        if (userRows.length > 0 && userRows[0].member_expires_at) {
            const currentExpiresAt = new Date(userRows[0].member_expires_at);
            const now = new Date();
            if (currentExpiresAt > now) {
                const packageDays = Math.ceil((memberExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                newExpiresAt = new Date(currentExpiresAt);
                newExpiresAt.setDate(newExpiresAt.getDate() + packageDays);
            }
        }
        await pool.execute(`UPDATE users 
       SET is_member = 1, member_expires_at = ? 
       WHERE id = ?`, [newExpiresAt, userId]);
    }
    static async getUserMemberInfo(userId) {
        const [userRows] = await pool.execute('SELECT is_member, member_expires_at FROM users WHERE id = ?', [userId]);
        const availableTimes = await this.checkUserAvailableTimes(userId);
        const user = userRows[0];
        let isMember = user?.is_member || false;
        let memberExpiresAt = user?.member_expires_at;
        if (isMember && memberExpiresAt) {
            const expiresAt = new Date(memberExpiresAt);
            const now = new Date();
            if (expiresAt <= now) {
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
    static async activatePackage(userId, packageId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [packageRows] = await connection.execute('SELECT * FROM packages WHERE id = ? AND is_active = 1', [packageId]);
            if (packageRows.length === 0) {
                throw new Error('套餐不存在或已停用');
            }
            const packageInfo = packageRows[0];
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + packageInfo.validity_days);
            await connection.execute(`INSERT INTO user_packages (user_id, package_id, times_remaining, expires_at, status)
         VALUES (?, ?, ?, ?, 'active')`, [userId, packageId, packageInfo.usage_count, expiresAt]);
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
