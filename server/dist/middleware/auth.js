import { UserService } from '../services/UserService.js';
// JWT认证中间件
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        return res.status(401).json({
            success: false,
            message: '访问令牌缺失'
        });
    }
    try {
        const user = UserService.verifyToken(token);
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(403).json({
            success: false,
            message: '无效的访问令牌'
        });
    }
};
// 管理员权限检查中间件
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: '未认证的访问'
        });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: '需要管理员权限'
        });
    }
    next();
};
// 用户状态检查中间件
export const checkUserStatus = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: '未认证的访问'
        });
    }
    try {
        const user = await UserService.getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        if (user.status === 'banned') {
            return res.status(403).json({
                success: false,
                message: '账户已被封禁'
            });
        }
        if (user.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: '账户已被禁用'
            });
        }
        next();
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
};
//# sourceMappingURL=auth.js.map