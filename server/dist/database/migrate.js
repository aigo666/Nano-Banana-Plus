import { testConnection, initDatabase } from '../config/database.js';
import { UserService } from '../services/UserService.js';
async function migrate() {
    console.log('🚀 开始数据库迁移...');
    try {
        const connected = await testConnection();
        if (!connected) {
            throw new Error('数据库连接失败');
        }
        await initDatabase();
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
