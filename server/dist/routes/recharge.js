import express from 'express';
import { RechargeService } from '../services/RechargeService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateRequest, validateZodQuery } from '../middleware/validation.js';
import { z } from 'zod';
const router = express.Router();
// 查询参数验证schema
const rechargeQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
    payment_method: z.string().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    min_amount: z.coerce.number().min(0).optional(),
    max_amount: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['created_at', 'amount', 'status']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
});
// 创建充值记录schema
const createRechargeSchema = z.object({
    amount: z.number().min(0.01).max(99999.99),
    payment_method: z.string().min(1).max(50),
    transaction_id: z.string().max(100).optional()
});
// 更新状态schema
const updateStatusSchema = z.object({
    status: z.enum(['pending', 'completed', 'failed', 'refunded']),
    transaction_id: z.string().max(100).optional()
});
// 退款schema
const refundSchema = z.object({
    reason: z.string().min(1).max(500)
});
// 图表数据查询schema
const chartQuerySchema = z.object({
    days: z.coerce.number().min(1).max(365).default(30)
});
// ==================== 管理员接口 ====================
// 获取充值记录列表（管理员）
router.get('/admin/records', authenticateToken, requireAdmin, validateZodQuery(rechargeQuerySchema), async (req, res) => {
    try {
        const query = req.query;
        const result = await RechargeService.getRechargeRecords(query);
        res.json({
            success: true,
            message: '获取充值记录成功',
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取充值记录失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 获取充值统计数据（管理员）
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await RechargeService.getRechargeStats();
        res.json({
            success: true,
            message: '获取统计数据成功',
            data: stats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取统计数据失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 获取充值趋势图表数据（管理员）
router.get('/admin/chart-data', authenticateToken, requireAdmin, validateZodQuery(chartQuerySchema), async (req, res) => {
    try {
        const { days } = req.query;
        const chartData = await RechargeService.getChartData(days);
        res.json({
            success: true,
            message: '获取图表数据成功',
            data: chartData
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取图表数据失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 获取支付方式统计（管理员）
router.get('/admin/payment-stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const paymentStats = await RechargeService.getPaymentMethodStats();
        res.json({
            success: true,
            message: '获取支付方式统计成功',
            data: paymentStats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取支付方式统计失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 获取充值记录详情（管理员）
router.get('/admin/records/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的记录ID'
            });
        }
        const record = await RechargeService.getRechargeRecordById(id);
        if (!record) {
            return res.status(404).json({
                success: false,
                message: '充值记录不存在'
            });
        }
        res.json({
            success: true,
            message: '获取充值记录详情成功',
            data: record
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取充值记录详情失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 更新充值记录状态（管理员）
router.patch('/admin/records/:id/status', authenticateToken, requireAdmin, validateRequest(updateStatusSchema), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status, transaction_id } = req.body;
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的记录ID'
            });
        }
        // 检查记录是否存在
        const record = await RechargeService.getRechargeRecordById(id);
        if (!record) {
            return res.status(404).json({
                success: false,
                message: '充值记录不存在'
            });
        }
        await RechargeService.updateRechargeStatus(id, status, transaction_id);
        res.json({
            success: true,
            message: '充值记录状态更新成功'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '更新充值记录状态失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 处理退款（管理员）
router.post('/admin/records/:id/refund', authenticateToken, requireAdmin, validateRequest(refundSchema), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { reason } = req.body;
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的记录ID'
            });
        }
        await RechargeService.processRefund(id, reason);
        res.json({
            success: true,
            message: '退款处理成功'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '退款处理失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 导出充值记录（管理员）
router.get('/admin/export', authenticateToken, requireAdmin, validateZodQuery(rechargeQuerySchema), async (req, res) => {
    try {
        const query = req.query;
        const csvContent = await RechargeService.exportRechargeRecords(query);
        // 设置响应头
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="recharge_records_${new Date().toISOString().split('T')[0]}.csv"`);
        // 添加BOM以支持中文
        res.send('\uFEFF' + csvContent);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '导出充值记录失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// ==================== 用户接口 ====================
// 获取个人充值记录
router.get('/my-records', authenticateToken, validateZodQuery(rechargeQuerySchema), async (req, res) => {
    try {
        const query = { ...req.query, user_id: req.user?.userId };
        const result = await RechargeService.getRechargeRecords(query);
        res.json({
            success: true,
            message: '获取个人充值记录成功',
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取个人充值记录失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 创建充值记录
router.post('/create', authenticateToken, validateRequest(createRechargeSchema), async (req, res) => {
    try {
        const { amount, payment_method, transaction_id } = req.body;
        const user_id = req.user?.userId;
        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: '用户未登录'
            });
        }
        const rechargeId = await RechargeService.createRechargeRecord({
            user_id,
            amount,
            payment_method,
            transaction_id
        });
        res.json({
            success: true,
            message: '充值记录创建成功',
            data: { id: rechargeId }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '创建充值记录失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 获取个人充值记录详情
router.get('/my-records/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const user_id = req.user?.userId;
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的记录ID'
            });
        }
        const record = await RechargeService.getRechargeRecordById(id);
        if (!record) {
            return res.status(404).json({
                success: false,
                message: '充值记录不存在'
            });
        }
        // 检查是否为用户自己的记录
        if (record.user_id !== user_id) {
            return res.status(403).json({
                success: false,
                message: '无权访问此记录'
            });
        }
        res.json({
            success: true,
            message: '获取充值记录详情成功',
            data: record
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取充值记录详情失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
export default router;
//# sourceMappingURL=recharge.js.map