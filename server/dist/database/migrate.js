import { testConnection, initDatabase } from '../config/database.js';
import { UserService } from '../services/UserService.js';
async function migrate() {
    console.log('🚀 开始数据库迁移...');
    try {
        // 测试数据库连接
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        // 初始化数据库表
        await initDatabase();
        // 创建默认管理员账户
        await UserService.createDefaultAdmin();
        console.log('✅ 数据库迁移完成！');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ 数据库迁移失败:', error);
        process.exit(1);
    }
}
migrate();
//# sourceMappingURL=migrate.js.map