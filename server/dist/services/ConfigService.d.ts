export interface ApiToken {
    id: number;
    name: string;
    token: string;
    provider: string;
    model?: string;
    max_requests_per_minute: number;
    max_requests_per_day: number;
    priority: number;
    status: 'active' | 'inactive' | 'error';
    last_used_at?: string;
    error_count: number;
    total_requests: number;
    created_at: string;
    updated_at: string;
}
export interface SystemConfig {
    id: number;
    config_key: string;
    config_value: string;
    description?: string;
    config_type: 'string' | 'number' | 'boolean' | 'json';
    created_at: string;
    updated_at: string;
}
export interface CreateApiTokenRequest {
    name: string;
    token: string;
}
export interface UpdateApiTokenRequest {
    name?: string;
    token?: string;
    provider?: string;
    model?: string;
    max_requests_per_minute?: number;
    max_requests_per_day?: number;
    priority?: number;
    status?: 'active' | 'inactive' | 'error';
}
export declare class ConfigService {
    /**
     * 获取所有API令牌
     */
    static getAllApiTokens(): Promise<ApiToken[]>;
    /**
     * 获取活跃的API令牌（按优先级排序）
     */
    static getActiveApiTokens(): Promise<ApiToken[]>;
    /**
     * 根据ID获取API令牌
     */
    static getApiTokenById(id: number): Promise<ApiToken | null>;
    /**
     * 创建API令牌（简化版，使用固定默认值）
     */
    static createApiToken(data: {
        name: string;
        token: string;
    }): Promise<ApiToken>;
    /**
     * 更新API令牌
     */
    static updateApiToken(id: number, data: UpdateApiTokenRequest): Promise<ApiToken>;
    /**
     * 删除API令牌
     */
    static deleteApiToken(id: number): Promise<void>;
    /**
     * 获取可用的API令牌（负载均衡）
     */
    static getAvailableApiToken(): Promise<ApiToken | null>;
    /**
     * 更新令牌使用统计
     */
    static updateTokenUsage(id: number, success?: boolean): Promise<void>;
    /**
     * 获取所有系统配置
     */
    static getAllConfigs(): Promise<SystemConfig[]>;
    /**
     * 根据键获取配置
     */
    static getConfig(key: string): Promise<string | null>;
    /**
     * 设置配置
     */
    static setConfig(key: string, value: string, description?: string, type?: 'string' | 'number' | 'boolean' | 'json'): Promise<void>;
    /**
     * 批量设置配置
     */
    static setConfigs(configs: Array<{
        key: string;
        value: string;
        description?: string;
        type?: 'string' | 'number' | 'boolean' | 'json';
    }>): Promise<void>;
    /**
     * 删除配置
     */
    static deleteConfig(key: string): Promise<void>;
    /**
     * 初始化默认系统配置（只在配置不存在时设置）
     */
    static initDefaultConfigs(): Promise<void>;
    /**
     * 只设置不存在的默认配置项
     */
    static setDefaultConfigsIfNotExists(configs: Array<{
        key: string;
        value: string;
        description?: string;
        type?: 'string' | 'number' | 'boolean' | 'json';
    }>): Promise<void>;
    /**
     * 获取支付配置（包含易支付和余额支付）
     */
    static getPaymentConfig(): Promise<{
        epayEnabled: boolean;
        pid: string;
        key: string;
        apiUrl: string;
        returnUrl: string;
        notifyUrl: string;
        wxpayEnabled: boolean;
        alipayEnabled: boolean;
        balanceEnabled: boolean;
    }>;
    /**
     * 获取易支付配置（保持向后兼容）
     */
    static getEpayConfig(): Promise<{
        enabled: boolean;
        pid: string;
        key: string;
        apiUrl: string;
        returnUrl: string;
        notifyUrl: string;
        wxpayEnabled: boolean;
        alipayEnabled: boolean;
    }>;
    /**
     * 获取网站基础信息
     */
    static getSiteInfo(): Promise<{
        siteName: string;
        siteDescription: string;
        siteLogo: string;
        inputPlaceholderText: string;
    }>;
}
//# sourceMappingURL=ConfigService.d.ts.map