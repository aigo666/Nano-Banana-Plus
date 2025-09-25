import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
export const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nano_banana',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};
// 创建数据库连接池
export const pool = mysql.createPool(dbConfig);
// 测试数据库连接
export async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ 数据库连接成功');
        connection.release();
        return true;
    }
    catch (error) {
        console.error('❌ 数据库连接失败:', error);
        return false;
    }
}
// 初始化数据库表
export async function initDatabase() {
    try {
        // 用户表
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) DEFAULT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
        is_member TINYINT(1) DEFAULT 0 COMMENT '是否会员',
        member_expires_at TIMESTAMP NULL DEFAULT NULL COMMENT '会员过期时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_email (email),
        INDEX idx_username (username),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // 生成历史表
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS generation_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        prompt TEXT NOT NULL,
        original_images JSON DEFAULT NULL,
        generated_image VARCHAR(255) DEFAULT NULL,
        style_template VARCHAR(100) DEFAULT NULL,
        consumed_times INT DEFAULT 1 COMMENT '消耗次数',
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        error_message TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // 会员充值记录表
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS recharge_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        transaction_id VARCHAR(100) UNIQUE DEFAULT NULL,
        status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_transaction_id (transaction_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // 用户余额表
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        balance DECIMAL(10,2) DEFAULT 0.00,
        total_recharged DECIMAL(10,2) DEFAULT 0.00,
        total_consumed DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // 套餐表
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT '套餐名称',
        times INT NOT NULL COMMENT '使用次数',
        validity_days INT NOT NULL COMMENT '有效期（天数）',
        price DECIMAL(10,2) NOT NULL COMMENT '套餐价格',
        status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '套餐状态',
        sort_order INT DEFAULT 0 COMMENT '排序顺序',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_sort_order (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // 用户套餐购买记录表
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        package_id INT NULL,
        package_name VARCHAR(100) NOT NULL COMMENT '套餐名称快照',
        times_total INT NOT NULL COMMENT '总次数',
        times_used INT DEFAULT 0 COMMENT '已使用次数',
        times_remaining INT NOT NULL COMMENT '剩余次数',
        price DECIMAL(10,2) NOT NULL COMMENT '购买价格',
        expires_at TIMESTAMP NULL DEFAULT NULL COMMENT '过期时间，NULL表示永不过期',
        status ENUM('active', 'expired', 'exhausted') DEFAULT 'active' COMMENT '状态',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_package_id (package_id),
        INDEX idx_status (status),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // API令牌配置表
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT '令牌名称',
        token VARCHAR(500) NOT NULL COMMENT 'API令牌',
        provider VARCHAR(50) NOT NULL COMMENT '服务提供商',
        model VARCHAR(100) DEFAULT NULL COMMENT '支持的模型',
        max_requests_per_minute INT DEFAULT 60 COMMENT '每分钟最大请求数',
        max_requests_per_day INT DEFAULT 1000 COMMENT '每天最大请求数',
        priority INT DEFAULT 0 COMMENT '优先级，数字越大优先级越高',
        status ENUM('active', 'inactive', 'error') DEFAULT 'active' COMMENT '状态',
        last_used_at TIMESTAMP NULL DEFAULT NULL COMMENT '最后使用时间',
        error_count INT DEFAULT 0 COMMENT '错误次数',
        total_requests INT DEFAULT 0 COMMENT '总请求次数',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_provider (provider)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // 系统配置表
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS system_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL COMMENT '配置键',
        config_value TEXT COMMENT '配置值',
        description VARCHAR(255) DEFAULT NULL COMMENT '配置描述',
        config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' COMMENT '配置类型',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_config_key (config_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('✅ 数据库表初始化成功');
    }
    catch (error) {
        console.error('❌ 数据库表初始化失败:', error);
        throw error;
    }
}
//# sourceMappingURL=database.js.map