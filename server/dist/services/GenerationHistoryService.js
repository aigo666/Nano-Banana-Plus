import { pool } from '../config/database.js';
export class GenerationHistoryService {
    /**
     * 创建生成历史记录
     */
    static async createHistory(data) {
        const { user_id, prompt, original_images = [], style_template = null, consumed_times = 1 } = data;
        const [result] = await pool.execute(`INSERT INTO generation_history 
       (user_id, prompt, original_images, style_template, consumed_times, status) 
       VALUES (?, ?, ?, ?, ?, 'processing')`, [
            user_id,
            prompt,
            original_images.length > 0 ? JSON.stringify(original_images) : null,
            style_template,
            consumed_times
        ]);
        const createdHistory = await this.getHistoryById(result.insertId);
        if (!createdHistory) {
            throw new Error('创建生成历史记录失败');
        }
        return createdHistory;
    }
    /**
     * 根据ID获取生成历史记录
     */
    static async getHistoryById(id) {
        const [rows] = await pool.execute('SELECT * FROM generation_history WHERE id = ?', [id]);
        if (rows.length === 0) {
            return null;
        }
        const history = rows[0];
        // 解析JSON字段
        if (history.original_images && typeof history.original_images === 'string') {
            try {
                history.original_images = JSON.parse(history.original_images);
            }
            catch (error) {
                console.error('解析original_images失败:', error);
                history.original_images = null;
            }
        }
        return history;
    }
    /**
     * 更新生成历史记录
     */
    static async updateHistory(id, data) {
        const updates = [];
        const values = [];
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (updates.length === 0) {
            throw new Error('没有要更新的数据');
        }
        values.push(id);
        await pool.execute(`UPDATE generation_history SET ${updates.join(', ')} WHERE id = ?`, values);
        const updatedHistory = await this.getHistoryById(id);
        if (!updatedHistory) {
            throw new Error('更新生成历史记录失败');
        }
        return updatedHistory;
    }
    /**
     * 获取用户的生成历史记录（分页）
     */
    static async getUserHistory(userId, page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;
            console.log(`获取用户 ${userId} 的历史记录，页码: ${page}, 每页: ${limit}, 偏移: ${offset}`);
            // 获取总数
            const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM generation_history WHERE user_id = ?', [userId]);
            const total = countResult[0].total;
            console.log(`用户 ${userId} 总共有 ${total} 条历史记录`);
            // 获取历史记录列表
            const [histories] = await pool.execute(`SELECT id, user_id, prompt, original_images, generated_image, 
                consumed_times, style_template, status, error_message, 
                created_at, updated_at 
         FROM generation_history 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`, [userId, limit, offset]);
            console.log(`成功获取 ${histories.length} 条历史记录`);
            // 处理JSON字段
            const processedHistories = histories.map(history => {
                if (history.original_images && typeof history.original_images === 'string') {
                    try {
                        history.original_images = JSON.parse(history.original_images);
                    }
                    catch (error) {
                        console.error('解析original_images失败:', error);
                        history.original_images = null;
                    }
                }
                return history;
            });
            return {
                items: processedHistories,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        }
        catch (error) {
            console.error('getUserHistory 数据库操作失败:', error);
            throw new Error('数据库查询失败，请稍后重试');
        }
    }
    /**
     * 获取用户的生成统计信息
     */
    static async getUserStats(userId) {
        try {
            console.log(`获取用户 ${userId} 的统计信息`);
            const [stats] = await pool.execute(`SELECT 
           COUNT(*) as total_generations,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_generations,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_generations,
           SUM(CASE WHEN status = 'completed' THEN consumed_times ELSE 0 END) as total_consumed_times
         FROM generation_history 
         WHERE user_id = ?`, [userId]);
            const result = {
                total_generations: stats[0].total_generations || 0,
                successful_generations: stats[0].successful_generations || 0,
                failed_generations: stats[0].failed_generations || 0,
                total_consumed_times: stats[0].total_consumed_times || 0
            };
            console.log(`用户 ${userId} 统计信息:`, result);
            return result;
        }
        catch (error) {
            console.error('getUserStats 数据库操作失败:', error);
            throw new Error('获取统计信息失败，请稍后重试');
        }
    }
    /**
     * 删除生成历史记录
     */
    static async deleteHistory(id, userId) {
        const [result] = await pool.execute('DELETE FROM generation_history WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            throw new Error('记录不存在或无权限删除');
        }
    }
    /**
     * 获取管理员的所有生成历史记录（分页）- 支持多种筛选条件
     */
    static async getAllHistory(page = 1, limit = 20, filters) {
        const offset = (page - 1) * limit;
        const whereConditions = [];
        const params = [];
        // 构建筛选条件
        if (filters?.status) {
            whereConditions.push('gh.status = ?');
            params.push(filters.status);
        }
        if (filters?.username) {
            whereConditions.push('u.username LIKE ?');
            params.push(`%${filters.username}%`);
        }
        if (filters?.email) {
            whereConditions.push('u.email LIKE ?');
            params.push(`%${filters.email}%`);
        }
        if (filters?.startDate) {
            whereConditions.push('gh.created_at >= ?');
            params.push(filters.startDate);
        }
        if (filters?.endDate) {
            whereConditions.push('gh.created_at <= ?');
            params.push(filters.endDate + ' 23:59:59'); // 包含整天
        }
        if (filters?.prompt) {
            whereConditions.push('gh.prompt LIKE ?');
            params.push(`%${filters.prompt}%`);
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        // 获取总数和统计信息
        const [countResult] = await pool.execute(`SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN gh.status = 'completed' THEN 1 ELSE 0 END) as successful_generations,
         SUM(CASE WHEN gh.status = 'failed' THEN 1 ELSE 0 END) as failed_generations,
         SUM(CASE WHEN gh.status = 'completed' THEN gh.consumed_times ELSE 0 END) as total_consumed_times
       FROM generation_history gh 
       LEFT JOIN users u ON gh.user_id = u.id 
       ${whereClause}`, params);
        const total = countResult[0].total || 0;
        const stats = {
            total_generations: total,
            successful_generations: countResult[0].successful_generations || 0,
            failed_generations: countResult[0].failed_generations || 0,
            total_consumed_times: countResult[0].total_consumed_times || 0
        };
        // 获取历史记录列表
        const [histories] = await pool.execute(`SELECT gh.*, u.username, u.email 
       FROM generation_history gh 
       LEFT JOIN users u ON gh.user_id = u.id 
       ${whereClause}
       ORDER BY gh.created_at DESC 
       LIMIT ? OFFSET ?`, [...params, limit, offset]);
        // 处理JSON字段
        const processedHistories = histories.map(history => {
            if (history.original_images && typeof history.original_images === 'string') {
                try {
                    history.original_images = JSON.parse(history.original_images);
                }
                catch (error) {
                    console.error('解析original_images失败:', error);
                    history.original_images = null;
                }
            }
            return history;
        });
        return {
            items: processedHistories,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            stats
        };
    }
}
//# sourceMappingURL=GenerationHistoryService.js.map