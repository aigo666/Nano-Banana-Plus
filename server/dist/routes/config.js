import express from 'express';
import { ConfigService } from '../services/ConfigService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { z } from 'zod';
const router = express.Router();
// ==================== API令牌管理路由 ====================
// 创建API令牌验证模式（简化版）
const createApiTokenSchema = z.object({
    name: z.string().min(1, '令牌名称不能为空').max(100, '令牌名称不能超过100个字符'),
    token: z.string().min(1, 'API令牌不能为空').max(500, 'API令牌不能超过500个字符')
});
// 更新API令牌验证模式（简化版）
const updateApiTokenSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    token: z.string().min(1).max(500).optional(),
    status: z.enum(['active', 'inactive']).optional()
});
/**
 * @route GET /api/config/tokens
 * @desc 获取所有API令牌
 * @access Admin
 */
router.get('/tokens', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const tokens = await ConfigService.getAllApiTokens();
        // 隐藏敏感的令牌信息，只显示前几位和后几位
        const safeTokens = tokens.map(token => ({
            ...token,
            token: token.token.length > 10
                ? `${token.token.substring(0, 6)}...${token.token.substring(token.token.length - 4)}`
                : '***已配置***'
        }));
        const response = {
            success: true,
            message: '获取API令牌列表成功',
            data: safeTokens
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取API令牌列表失败:', error);
        const response = {
            success: false,
            message: '获取API令牌列表失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
/**
 * @route GET /api/config/tokens/:id
 * @desc 获取单个API令牌详情
 * @access Admin
 */
router.get('/tokens/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            const response = {
                success: false,
                message: '无效的令牌ID'
            };
            return res.status(400).json(response);
        }
        const token = await ConfigService.getApiTokenById(id);
        if (!token) {
            const response = {
                success: false,
                message: 'API令牌不存在'
            };
            return res.status(404).json(response);
        }
        // 隐藏敏感信息
        const safeToken = {
            ...token,
            token: token.token.length > 10
                ? `${token.token.substring(0, 6)}...${token.token.substring(token.token.length - 4)}`
                : '***已配置***'
        };
        const response = {
            success: true,
            message: '获取API令牌详情成功',
            data: safeToken
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取API令牌详情失败:', error);
        const response = {
            success: false,
            message: '获取API令牌详情失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
/**
 * @route POST /api/config/tokens
 * @desc 创建API令牌
 * @access Admin
 */
router.post('/tokens', authenticateToken, requireAdmin, validateRequest(createApiTokenSchema), async (req, res) => {
    try {
        const tokenData = req.body;
        const newToken = await ConfigService.createApiToken(tokenData);
        // 隐藏敏感信息
        const safeToken = {
            ...newToken,
            token: newToken.token.length > 10
                ? `${newToken.token.substring(0, 6)}...${newToken.token.substring(newToken.token.length - 4)}`
                : '***已配置***'
        };
        const response = {
            success: true,
            message: '创建API令牌成功',
            data: safeToken
        };
        res.status(201).json(response);
    }
    catch (error) {
        console.error('创建API令牌失败:', error);
        const response = {
            success: false,
            message: '创建API令牌失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
/**
 * @route PUT /api/config/tokens/:id
 * @desc 更新API令牌
 * @access Admin
 */
router.put('/tokens/:id', authenticateToken, requireAdmin, validateRequest(updateApiTokenSchema), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            const response = {
                success: false,
                message: '无效的令牌ID'
            };
            return res.status(400).json(response);
        }
        const updateData = req.body;
        const updatedToken = await ConfigService.updateApiToken(id, updateData);
        // 隐藏敏感信息
        const safeToken = {
            ...updatedToken,
            token: updatedToken.token.length > 10
                ? `${updatedToken.token.substring(0, 6)}...${updatedToken.token.substring(updatedToken.token.length - 4)}`
                : '***已配置***'
        };
        const response = {
            success: true,
            message: '更新API令牌成功',
            data: safeToken
        };
        res.json(response);
    }
    catch (error) {
        console.error('更新API令牌失败:', error);
        const response = {
            success: false,
            message: '更新API令牌失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
/**
 * @route DELETE /api/config/tokens/:id
 * @desc 删除API令牌
 * @access Admin
 */
router.delete('/tokens/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            const response = {
                success: false,
                message: '无效的令牌ID'
            };
            return res.status(400).json(response);
        }
        await ConfigService.deleteApiToken(id);
        const response = {
            success: true,
            message: '删除API令牌成功'
        };
        res.json(response);
    }
    catch (error) {
        console.error('删除API令牌失败:', error);
        const response = {
            success: false,
            message: '删除API令牌失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
// ==================== 系统配置管理路由 ====================
// 系统配置验证模式
const systemConfigSchema = z.object({
    configs: z.array(z.object({
        key: z.string().min(1),
        value: z.string(),
        description: z.string().optional(),
        type: z.enum(['string', 'number', 'boolean', 'json']).optional()
    }))
});
/**
 * @route GET /api/config/system
 * @desc 获取所有系统配置
 * @access Admin
 */
router.get('/system', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const configs = await ConfigService.getAllConfigs();
        const response = {
            success: true,
            message: '获取系统配置成功',
            data: configs
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取系统配置失败:', error);
        const response = {
            success: false,
            message: '获取系统配置失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
/**
 * @route GET /api/config/system/:key
 * @desc 获取单个系统配置
 * @access Admin
 */
router.get('/system/:key', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const value = await ConfigService.getConfig(key);
        if (value === null) {
            const response = {
                success: false,
                message: '配置不存在'
            };
            return res.status(404).json(response);
        }
        const response = {
            success: true,
            message: '获取配置成功',
            data: { key, value }
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取配置失败:', error);
        const response = {
            success: false,
            message: '获取配置失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
/**
 * @route PUT /api/config/system
 * @desc 批量更新系统配置
 * @access Admin
 */
router.put('/system', authenticateToken, requireAdmin, validateRequest(systemConfigSchema), async (req, res) => {
    try {
        const { configs } = req.body;
        await ConfigService.setConfigs(configs);
        const response = {
            success: true,
            message: '更新系统配置成功'
        };
        res.json(response);
    }
    catch (error) {
        console.error('更新系统配置失败:', error);
        const response = {
            success: false,
            message: '更新系统配置失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
/**
 * @route GET /api/config/site-info
 * @desc 获取网站基础信息（公开接口）
 * @access Public
 */
router.get('/site-info', async (req, res) => {
    try {
        const siteInfo = await ConfigService.getSiteInfo();
        const response = {
            success: true,
            message: '获取网站信息成功',
            data: siteInfo
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取网站信息失败:', error);
        const response = {
            success: false,
            message: '获取网站信息失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
/**
 * @route GET /api/config/available-token
 * @desc 获取可用的API令牌（内部接口）
 * @access Private
 */
router.get('/available-token', async (req, res) => {
    try {
        const token = await ConfigService.getAvailableApiToken();
        if (!token) {
            const response = {
                success: false,
                message: '没有可用的API令牌'
            };
            return res.status(404).json(response);
        }
        const response = {
            success: true,
            message: '获取可用令牌成功',
            data: token
        };
        res.json(response);
    }
    catch (error) {
        console.error('获取可用令牌失败:', error);
        const response = {
            success: false,
            message: '获取可用令牌失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
export default router;
//# sourceMappingURL=config.js.map