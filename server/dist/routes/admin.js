import express from 'express';
import { UserService } from '../services/UserService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validate, validateQuery, updateUserStatusSchema, updateUserRoleSchema, paginationSchema } from '../middleware/validation.js';
const router = express.Router();
router.use(authenticateToken, requireAdmin);
router.get('/users', validateQuery(paginationSchema), async (req, res) => {
    try {
        const query = req.query;
        const result = await UserService.getUsers(query);
        res.json({
            success: true,
            message: '获取用户列表成功',
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取用户列表失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.get('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID'
            });
        }
        const user = await UserService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        const balance = await UserService.getUserBalance(userId);
        const { password_hash, ...userWithoutPassword } = user;
        res.json({
            success: true,
            message: '获取用户详情成功',
            data: {
                user: userWithoutPassword,
                balance
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取用户详情失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.patch('/users/:id/status', validate(updateUserStatusSchema), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { status } = req.body;
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID'
            });
        }
        const user = await UserService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        if (req.user && req.user.userId === userId) {
            return res.status(400).json({
                success: false,
                message: '不能修改自己的状态'
            });
        }
        await UserService.updateUserStatus(userId, status);
        res.json({
            success: true,
            message: '用户状态更新成功'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '更新用户状态失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.patch('/users/:id/role', validate(updateUserRoleSchema), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID'
            });
        }
        const user = await UserService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        if (req.user && req.user.userId === userId) {
            return res.status(400).json({
                success: false,
                message: '不能修改自己的角色'
            });
        }
        await UserService.updateUserRole(userId, role);
        res.json({
            success: true,
            message: '用户角色更新成功'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '更新用户角色失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.patch('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const updateData = req.body;
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID'
            });
        }
        const user = await UserService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        if (req.user && req.user.userId === userId) {
            delete updateData.role;
            delete updateData.status;
        }
        if (updateData.newPassword) {
            if (typeof updateData.newPassword !== 'string' || updateData.newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: '密码长度至少6位'
                });
            }
        }
        await UserService.updateUser(userId, updateData);
        res.json({
            success: true,
            message: '用户信息更新成功'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '更新用户信息失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID'
            });
        }
        const user = await UserService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        if (req.user && req.user.userId === userId) {
            return res.status(400).json({
                success: false,
                message: '不能删除自己的账户'
            });
        }
        await UserService.deleteUser(userId);
        res.json({
            success: true,
            message: '用户删除成功'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '删除用户失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const totalUsersQuery = await UserService.getUsers({ page: 1, limit: 1 });
        const totalUsers = totalUsersQuery.pagination.total;
        res.json({
            success: true,
            message: '获取统计信息成功',
            data: {
                totalUsers,
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取统计信息失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
export default router;
