import express from 'express';
import { GenerationHistoryService } from '../services/GenerationHistoryService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { z } from 'zod';
const router = express.Router();
const historyQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(['pending', 'processing', 'completed', 'failed']).optional()
});
const adminHistoryQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
    username: z.string().optional(),
    email: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    prompt: z.string().optional()
});
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20 } = req.query;
        console.log(`用户 ${userId} 请求历史记录，页码: ${page}, 每页: ${limit}`);
        const result = await GenerationHistoryService.getUserHistory(userId, Number(page), Number(limit));
        const response = {
            success: true,
            message: '获取历史记录成功',
            data: result
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取用户历史记录失败:', error);
        const response = {
            success: false,
            message: '获取历史记录失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.get('/user/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log(`用户 ${userId} 请求统计信息`);
        const stats = await GenerationHistoryService.getUserStats(userId);
        const response = {
            success: true,
            message: '获取统计信息成功',
            data: stats
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取用户统计信息失败:', error);
        const response = {
            success: false,
            message: '获取统计信息失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page, limit, status, username, email, startDate, endDate, prompt } = req.query;
        const filters = {};
        if (status)
            filters.status = status;
        if (username)
            filters.username = username;
        if (email)
            filters.email = email;
        if (startDate)
            filters.startDate = startDate;
        if (endDate)
            filters.endDate = endDate;
        if (prompt)
            filters.prompt = prompt;
        console.log(`管理员请求所有历史记录，页码: ${page}, 每页: ${limit}`, Object.keys(filters).length > 0 ? `, 筛选条件: ${JSON.stringify(filters)}` : '');
        const result = await GenerationHistoryService.getAllHistory(page, limit, Object.keys(filters).length > 0 ? filters : undefined);
        const response = {
            success: true,
            message: '获取历史记录成功',
            data: result
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取所有历史记录失败:', error);
        const response = {
            success: false,
            message: '获取历史记录失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
export default router;
