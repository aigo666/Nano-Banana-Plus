import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { testConnection, initDatabase } from './config/database.js';
import { UserService } from './services/UserService.js';
import { ConfigService } from './services/ConfigService.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import packageRoutes from './routes/packages.js';
import configRoutes from './routes/config.js';
import generateRoutes from './routes/generate.js';
import rechargeRoutes from './routes/recharge.js';
import historyRoutes from './routes/history.js';
import uploadRoutes from './routes/upload.js';
import epayRoutes from './routes/epay.js';
// 加载环境变量
dotenv.config();
const app = express();
const PORT = process.env.BACKEND_PORT || 8000;
// 信任代理 - 用于处理 Nginx 反向代理
// 只信任来自容器内部的代理
app.set('trust proxy', ['127.0.0.1', '::1', '172.17.0.0/16', '172.18.0.0/16', '172.19.0.0/16', '172.20.0.0/16']);
// 安全中间件
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// CORS配置
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-domain.com'] // 生产环境域名
        : ['http://localhost:3000', 'http://127.0.0.1:3000'], // 开发环境
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 限制每个IP在窗口时间内最多100个请求
    message: {
        success: false,
        message: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);
// 更严格的认证相关接口限制
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 50, // 限制每个IP在窗口时间内最多50次认证请求（开发环境放宽限制）
    message: {
        success: false,
        message: '认证请求过于频繁，请稍后再试'
    }
});
// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// 静态文件服务 - 提供上传的图片
app.use('/uploads', express.static('uploads'));
// 健康检查端点
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Nano Banana服务器运行正常',
        timestamp: new Date().toISOString()
    });
});
// API路由
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/config', configRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment/epay', epayRoutes);
// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在'
    });
});
// 全局错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    // Joi验证错误
    if (err.isJoi) {
        return res.status(400).json({
            success: false,
            message: '数据验证失败',
            error: err.details[0].message
        });
    }
    // JWT错误
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: '无效的访问令牌'
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: '访问令牌已过期'
        });
    }
    // 数据库错误
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
            success: false,
            message: '数据已存在'
        });
    }
    // 默认错误
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
    });
});
// 启动服务器
async function startServer() {
    try {
        console.log('🚀 启动Nano Banana服务器...');
        // 测试数据库连接
        const dbConnected = await testConnection();
        if (!dbConnected) {
            throw new Error('数据库连接失败');
        }
        // 初始化数据库表
        await initDatabase();
        // 创建默认管理员账户
        await UserService.createDefaultAdmin();
        // 初始化默认系统配置
        await ConfigService.initDefaultConfigs();
        // 启动服务器
        app.listen(PORT, () => {
            console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
            console.log(`📚 API文档: http://localhost:${PORT}/health`);
            console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
        });
    }
    catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}
// 优雅关闭
process.on('SIGTERM', () => {
    console.log('🔄 收到SIGTERM信号，正在关闭服务器...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('🔄 收到SIGINT信号，正在关闭服务器...');
    process.exit(0);
});
// 移除定时维护任务，改为实时检查
startServer();
//# sourceMappingURL=index.js.map