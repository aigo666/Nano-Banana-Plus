import { pool } from '../config/database.js';
export class RechargeService {
    /**
     * 获取充值记录列表（支持筛选和分页）
     */
    static async getRechargeRecords(query) {
        const { page = 1, limit = 20, search, status, payment_method, start_date, end_date, min_amount, max_amount, user_id, sortBy = 'created_at', sortOrder = 'desc' } = query;
        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];
        // 构建查询条件
        if (search) {
            conditions.push(`(
        u.username LIKE ? OR 
        u.email LIKE ? OR 
        r.transaction_id LIKE ?
      )`);
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        if (status) {
            conditions.push('r.status = ?');
            params.push(status);
        }
        if (payment_method) {
            conditions.push('r.payment_method = ?');
            params.push(payment_method);
        }
        if (start_date) {
            conditions.push('DATE(r.created_at) >= ?');
            params.push(start_date);
        }
        if (end_date) {
            conditions.push('DATE(r.created_at) <= ?');
            params.push(end_date);
        }
        if (min_amount !== undefined) {
            conditions.push('r.amount >= ?');
            params.push(min_amount);
        }
        if (max_amount !== undefined) {
            conditions.push('r.amount <= ?');
            params.push(max_amount);
        }
        if (user_id) {
            conditions.push('r.user_id = ?');
            params.push(user_id);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        // 获取总数
        const countQuery = `
      SELECT COUNT(*) as total
      FROM recharge_records r
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
    `;
        const [countResult] = await pool.execute(countQuery, params);
        const total = countResult[0].total;
        // 获取记录列表
        const listQuery = `
      SELECT 
        r.*,
        u.username,
        u.email
      FROM recharge_records r
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY r.${sortBy} ${sortOrder}
      LIMIT ${limit} OFFSET ${offset}
    `;
        const [records] = await pool.execute(listQuery, params);
        return {
            records: records,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    /**
     * 获取充值统计数据
     */
    static async getRechargeStats() {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        // 总收入和总订单数
        const [totalResult] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as totalRevenue,
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingOrders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedOrders,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedOrders,
        SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refundedOrders
      FROM recharge_records
    `);
        // 今日数据
        const [todayResult] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as todayRevenue,
        COUNT(*) as todayOrders
      FROM recharge_records
      WHERE DATE(created_at) = ?
    `, [today]);
        // 本月数据
        const [monthResult] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as monthRevenue,
        COUNT(*) as monthOrders
      FROM recharge_records
      WHERE DATE(created_at) >= ?
    `, [monthStartStr]);
        const stats = totalResult[0];
        const todayStats = todayResult[0];
        const monthStats = monthResult[0];
        return {
            totalRevenue: Number(stats.totalRevenue) || 0,
            todayRevenue: Number(todayStats.todayRevenue) || 0,
            monthRevenue: Number(monthStats.monthRevenue) || 0,
            totalOrders: stats.totalOrders || 0,
            todayOrders: todayStats.todayOrders || 0,
            monthOrders: monthStats.monthOrders || 0,
            pendingOrders: stats.pendingOrders || 0,
            completedOrders: stats.completedOrders || 0,
            failedOrders: stats.failedOrders || 0,
            refundedOrders: stats.refundedOrders || 0,
            avgOrderAmount: stats.totalOrders > 0 ? Number(stats.totalRevenue) / stats.completedOrders : 0
        };
    }
    /**
     * 获取充值趋势图表数据
     */
    static async getChartData(days = 30) {
        const [result] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as revenue,
        COUNT(*) as orders
      FROM recharge_records
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
        return result.map(row => ({
            date: row.date,
            revenue: Number(row.revenue),
            orders: row.orders
        }));
    }
    /**
     * 获取支付方式统计
     */
    static async getPaymentMethodStats() {
        const [result] = await pool.execute(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as revenue
      FROM recharge_records
      GROUP BY payment_method
      ORDER BY revenue DESC
    `);
        return result.map(row => ({
            payment_method: row.payment_method,
            count: row.count,
            revenue: Number(row.revenue)
        }));
    }
    /**
     * 创建充值记录
     */
    static async createRechargeRecord(data) {
        const { user_id, amount, payment_method, transaction_id } = data;
        const [result] = await pool.execute(`
      INSERT INTO recharge_records (user_id, amount, payment_method, transaction_id)
      VALUES (?, ?, ?, ?)
    `, [user_id, amount, payment_method, transaction_id]);
        return result.insertId;
    }
    /**
     * 更新充值记录状态
     */
    static async updateRechargeStatus(id, status, transaction_id) {
        let query = 'UPDATE recharge_records SET status = ?';
        const params = [status];
        if (transaction_id) {
            query += ', transaction_id = ?';
            params.push(transaction_id);
        }
        query += ' WHERE id = ?';
        params.push(id);
        await pool.execute(query, params);
        // 如果充值成功，更新用户余额
        if (status === 'completed') {
            await this.updateUserBalance(id);
        }
    }
    /**
     * 处理退款
     */
    static async processRefund(id, reason) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // 获取充值记录
            const [records] = await connection.execute('SELECT * FROM recharge_records WHERE id = ? AND status = "completed"', [id]);
            if (records.length === 0) {
                throw new Error('充值记录不存在或状态不允许退款');
            }
            const record = records[0];
            // 更新充值记录状态为已退款
            await connection.execute('UPDATE recharge_records SET status = "refunded" WHERE id = ?', [id]);
            // 扣除用户余额
            await connection.execute(`
        UPDATE user_balances 
        SET 
          balance = balance - ?,
          total_recharged = total_recharged - ?
        WHERE user_id = ?
      `, [record.amount, record.amount, record.user_id]);
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
    /**
     * 更新用户余额（充值成功时调用）
     */
    static async updateUserBalance(rechargeId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // 获取充值记录
            const [records] = await connection.execute('SELECT * FROM recharge_records WHERE id = ?', [rechargeId]);
            if (records.length === 0) {
                throw new Error('充值记录不存在');
            }
            const record = records[0];
            // 更新或创建用户余额记录
            await connection.execute(`
        INSERT INTO user_balances (user_id, balance, total_recharged)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          balance = balance + VALUES(balance),
          total_recharged = total_recharged + VALUES(total_recharged)
      `, [record.user_id, record.amount, record.amount]);
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
    /**
     * 获取充值记录详情
     */
    static async getRechargeRecordById(id) {
        const [result] = await pool.execute(`
      SELECT 
        r.*,
        u.username,
        u.email
      FROM recharge_records r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [id]);
        return result.length > 0 ? result[0] : null;
    }
    /**
     * 根据交易号获取充值记录
     */
    static async getRechargeRecordByTransactionId(transactionId) {
        const [result] = await pool.execute(`
      SELECT 
        r.*,
        u.username,
        u.email
      FROM recharge_records r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.transaction_id = ?
    `, [transactionId]);
        return result.length > 0 ? result[0] : null;
    }
    /**
     * 导出充值记录为CSV格式
     */
    static async exportRechargeRecords(query) {
        // 获取所有符合条件的记录（不分页）
        const { records } = await this.getRechargeRecords({ ...query, limit: 999999, page: 1 });
        // 生成CSV内容
        const headers = [
            'ID', '用户名', '邮箱', '充值金额', '支付方式', '交易号', '状态', '创建时间', '更新时间'
        ];
        const csvRows = [
            headers.join(','),
            ...records.map(record => [
                record.id,
                `"${record.username || ''}"`,
                `"${record.email || ''}"`,
                record.amount,
                `"${record.payment_method}"`,
                `"${record.transaction_id || ''}"`,
                `"${record.status}"`,
                `"${record.created_at}"`,
                `"${record.updated_at}"`
            ].join(','))
        ];
        return csvRows.join('\n');
    }
}
//# sourceMappingURL=RechargeService.js.map