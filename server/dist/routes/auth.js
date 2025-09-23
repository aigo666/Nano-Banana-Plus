import express from 'express';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/UserService.js';
import { PackageService } from '../services/PackageService.js';
import { validate, registerSchema, loginSchema } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const registerData = req.body;
        const result = await UserService.register(registerData);
        res.status(201).json({
            success: true,
            message: '注册成功',
            data: result
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '注册失败'
        });
    }
});
router.post('/login', validate(loginSchema), async (req, res) => {
    try {
        const loginData = req.body;
        const result = await UserService.login(loginData);
        res.json({
            success: true,
            message: '登录成功',
            data: result
        });
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: error instanceof Error ? error.message : '登录失败'
        });
    }
});
router.get('/me', authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证的访问'
            });
        }
        const user = await UserService.getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        const balance = await UserService.getUserBalance(req.user.userId);
        const { password_hash, ...userWithoutPassword } = user;
        res.json({
            success: true,
            message: '获取用户信息成功',
            data: {
                user: userWithoutPassword,
                balance
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证的访问'
            });
        }
        const user = await UserService.getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        const newToken = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'default_secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.json({
            success: true,
            message: 'Token刷新成功',
            data: {
                token: newToken
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});
router.get('/member-info', authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证的访问'
            });
        }
        const memberInfo = await PackageService.getUserMemberInfo(req.user.userId);
        res.json({
            success: true,
            message: '获取会员信息成功',
            data: memberInfo
        });
    }
    catch (error) {
        console.error('获取会员信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取会员信息失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
export default router;
