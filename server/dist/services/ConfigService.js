import { pool } from '../config/database.js';
export class ConfigService {
    // ==================== API令牌管理 ====================
    /**
     * 获取所有API令牌
     */
    static async getAllApiTokens() {
        const [rows] = await pool.execute('SELECT * FROM api_tokens ORDER BY priority DESC, created_at DESC');
        return rows;
    }
    /**
     * 获取活跃的API令牌（按优先级排序）
     */
    static async getActiveApiTokens() {
        const [rows] = await pool.execute('SELECT * FROM api_tokens WHERE status = ? ORDER BY priority DESC, created_at DESC', ['active']);
        return rows;
    }
    /**
     * 根据ID获取API令牌
     */
    static async getApiTokenById(id) {
        const [rows] = await pool.execute('SELECT * FROM api_tokens WHERE id = ?', [id]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * 创建API令牌（简化版，使用固定默认值）
     */
    static async createApiToken(data) {
        const { name, token } = data;
        // 使用固定的默认值，适用于nano-banana接口
        const [result] = await pool.execute(`INSERT INTO api_tokens 
       (name, token, provider, model, max_requests_per_minute, max_requests_per_day, priority) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [name, token, 'nano-banana', 'nano-banana', 60, 1000, 0]);
        const createdToken = await this.getApiTokenById(result.insertId);
        if (!createdToken) {
            throw new Error('创建API令牌失败');
        }
        return createdToken;
    }
    /**
     * 更新API令牌
     */
    static async updateApiToken(id, data) {
        const updates = [];
        const values = [];
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (updates.length === 0) {
            throw new Error('没有要更新的数据');
        }
        values.push(id);
        await pool.execute(`UPDATE api_tokens SET ${updates.join(', ')} WHERE id = ?`, values);
        const updatedToken = await this.getApiTokenById(id);
        if (!updatedToken) {
            throw new Error('更新API令牌失败');
        }
        return updatedToken;
    }
    /**
     * 删除API令牌
     */
    static async deleteApiToken(id) {
        const [result] = await pool.execute('DELETE FROM api_tokens WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            throw new Error('API令牌不存在');
        }
    }
    /**
     * 获取可用的API令牌（负载均衡）
     */
    static async getAvailableApiToken() {
        // 获取活跃的令牌，按优先级和错误次数排序
        const [rows] = await pool.execute(`SELECT * FROM api_tokens 
       WHERE status = 'active' 
       ORDER BY priority DESC, error_count ASC, total_requests ASC 
       LIMIT 1`, []);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * 更新令牌使用统计
     */
    static async updateTokenUsage(id, success = true) {
        if (success) {
            await pool.execute('UPDATE api_tokens SET total_requests = total_requests + 1, last_used_at = NOW() WHERE id = ?', [id]);
        }
        else {
            await pool.execute('UPDATE api_tokens SET error_count = error_count + 1, last_used_at = NOW() WHERE id = ?', [id]);
        }
    }
    // ==================== 系统配置管理 ====================
    /**
     * 获取所有系统配置
     */
    static async getAllConfigs() {
        const [rows] = await pool.execute('SELECT * FROM system_configs ORDER BY config_key');
        return rows;
    }
    /**
     * 根据键获取配置
     */
    static async getConfig(key) {
        const [rows] = await pool.execute('SELECT config_value FROM system_configs WHERE config_key = ?', [key]);
        return rows.length > 0 ? rows[0].config_value : null;
    }
    /**
     * 设置配置
     */
    static async setConfig(key, value, description, type = 'string') {
        await pool.execute(`INSERT INTO system_configs (config_key, config_value, description, config_type) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       config_value = VALUES(config_value), 
       description = VALUES(description), 
       config_type = VALUES(config_type)`, [key, value, description || null, type]);
    }
    /**
     * 批量设置配置
     */
    static async setConfigs(configs) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            for (const config of configs) {
                await connection.execute(`INSERT INTO system_configs (config_key, config_value, description, config_type) 
           VALUES (?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
           config_value = VALUES(config_value), 
           description = VALUES(description), 
           config_type = VALUES(config_type)`, [config.key, config.value, config.description || null, config.type || 'string']);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * 删除配置
     */
    static async deleteConfig(key) {
        const [result] = await pool.execute('DELETE FROM system_configs WHERE config_key = ?', [key]);
        if (result.affectedRows === 0) {
            throw new Error('配置不存在');
        }
    }
    // ==================== 初始化默认配置 ====================
    /**
     * 初始化默认系统配置（只在配置不存在时设置）
     */
    static async initDefaultConfigs() {
        const defaultConfigs = [
            { key: 'site_name', value: 'Nano Banana', description: '网站名称', type: 'string' },
            { key: 'site_description', value: 'AI图片生成服务平台', description: '网站描述', type: 'string' },
            { key: 'site_logo', value: '', description: '网站Logo图片地址', type: 'string' },
            { key: 'allow_registration', value: 'true', description: '允许用户注册', type: 'boolean' },
            { key: 'initial_balance', value: '10.00', description: '新用户初始余额', type: 'number' },
            { key: 'api_rate_limit', value: '60', description: 'API调用限制（每分钟）', type: 'number' },
            { key: 'enable_user_api_keys', value: 'false', description: '允许用户自定义API密钥', type: 'boolean' },
            { key: 'new_user_free_credits', value: '5', description: '新用户赠送免费次数', type: 'number' },
            { key: 'free_credits_expiry_days', value: '30', description: '免费次数有效期（天）', type: 'number' },
            { key: 'free_credits_never_expire', value: 'false', description: '免费次数永不过期', type: 'boolean' },
            // 易支付配置
            { key: 'epay_enabled', value: 'false', description: '启用易支付', type: 'boolean' },
            { key: 'epay_pid', value: '', description: '易支付商户ID', type: 'string' },
            { key: 'epay_key', value: '', description: '易支付商户密钥', type: 'string' },
            { key: 'epay_api_url', value: '', description: '易支付API地址', type: 'string' },
            // 支付方式开关
            { key: 'payment_wxpay_enabled', value: 'true', description: '启用微信支付', type: 'boolean' },
            { key: 'payment_alipay_enabled', value: 'true', description: '启用支付宝', type: 'boolean' },
            { key: 'payment_balance_enabled', value: 'false', description: '启用余额支付', type: 'boolean' },
            // 界面文本配置
            { key: 'input_placeholder_text', value: '告诉你的设计想法', description: '输入框占位符文本', type: 'string' }
        ];
        // 只设置不存在的配置项，避免覆盖用户已修改的配置
        await this.setDefaultConfigsIfNotExists(defaultConfigs);
    }
    /**
     * 只设置不存在的默认配置项
     */
    static async setDefaultConfigsIfNotExists(configs) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            for (const config of configs) {
                // 检查配置是否已存在
                const [rows] = await connection.execute('SELECT config_key FROM system_configs WHERE config_key = ?', [config.key]);
                // 只有当配置不存在时才插入
                if (rows.length === 0) {
                    await connection.execute(`INSERT INTO system_configs (config_key, config_value, description, config_type) 
             VALUES (?, ?, ?, ?)`, [config.key, config.value, config.description || null, config.type || 'string']);
                }
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    // ==================== 易支付配置获取 ====================
    /**
     * 获取支付配置（包含易支付和余额支付）
     */
    static async getPaymentConfig() {
        const [epayEnabled, pid, key, apiUrl, wxpayEnabled, alipayEnabled, balanceEnabled] = await Promise.all([
            this.getConfig('epay_enabled'),
            this.getConfig('epay_pid'),
            this.getConfig('epay_key'),
            this.getConfig('epay_api_url'),
            this.getConfig('payment_wxpay_enabled'),
            this.getConfig('payment_alipay_enabled'),
            this.getConfig('payment_balance_enabled')
        ]);
        // 动态生成回调地址（基于当前请求的域名）
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        return {
            epayEnabled: epayEnabled === 'true',
            pid: pid || '',
            key: key || '',
            apiUrl: apiUrl || '',
            returnUrl: `${baseUrl}/payment/return`,
            notifyUrl: `${baseUrl}/api/payment/epay/notify`,
            wxpayEnabled: wxpayEnabled === 'true',
            alipayEnabled: alipayEnabled === 'true',
            balanceEnabled: balanceEnabled === 'true'
        };
    }
    /**
     * 获取易支付配置（保持向后兼容）
     */
    static async getEpayConfig() {
        const config = await this.getPaymentConfig();
        return {
            enabled: config.epayEnabled,
            pid: config.pid,
            key: config.key,
            apiUrl: config.apiUrl,
            returnUrl: config.returnUrl,
            notifyUrl: config.notifyUrl,
            wxpayEnabled: config.wxpayEnabled,
            alipayEnabled: config.alipayEnabled
        };
    }
    // ==================== 网站基础信息获取 ====================
    /**
     * 获取网站基础信息
     */
    static async getSiteInfo() {
        const [siteName, siteDescription, siteLogo, inputPlaceholderText] = await Promise.all([
            this.getConfig('site_name'),
            this.getConfig('site_description'),
            this.getConfig('site_logo'),
            this.getConfig('input_placeholder_text')
        ]);
        return {
            siteName: siteName || 'Nano Banana',
            siteDescription: siteDescription || 'AI图片生成服务平台',
            siteLogo: siteLogo || '',
            inputPlaceholderText: inputPlaceholderText || '告诉你的设计想法'
        };
    }
}
//# sourceMappingURL=ConfigService.js.map