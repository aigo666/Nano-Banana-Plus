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
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-domain.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: {
        success: false,
        message: '认证请求过于频繁，请稍后再试'
    }
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Nano Banana服务器运行正常',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/config', configRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment/epay', epayRoutes);
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在'
    });
});
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    if (err.isJoi) {
        return res.status(400).json({
            success: false,
            message: '数据验证失败',
            error: err.details[0].message
        });
    }
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
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
            success: false,
            message: '数据已存在'
        });
    }
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
    });
});
async function startServer() {
    try {
        console.log('🚀 启动Nano Banana服务器...');
        const dbConnected = await testConnection();
        if (!dbConnected) {
            throw new Error('数据库连接失败');
        }
        await initDatabase();
        await UserService.createDefaultAdmin();
        await ConfigService.initDefaultConfigs();
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
process.on('SIGTERM', () => {
    console.log('🔄 收到SIGTERM信号，正在关闭服务器...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('🔄 收到SIGINT信号，正在关闭服务器...');
    process.exit(0);
});
startServer();
