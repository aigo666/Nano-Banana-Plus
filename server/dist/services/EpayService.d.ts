export interface EpayConfig {
    pid: string;
    key: string;
    apiUrl: string;
    returnUrl: string;
    notifyUrl: string;
}
export interface CreateOrderParams {
    type: 'wxpay' | 'alipay';
    out_trade_no: string;
    name: string;
    money: string;
    clientip?: string;
    device?: string;
    param?: string;
    return_url?: string;
    notify_url?: string;
}
export interface EpayOrderResponse {
    code: number;
    msg: string;
    trade_no?: string;
    payurl?: string;
    qrcode?: string;
}
export interface EpayNotifyData {
    pid: string;
    trade_no: string;
    out_trade_no: string;
    type: string;
    name: string;
    money: string;
    trade_status: string;
    sign: string;
    [key: string]: any;
}
export declare class EpayService {
    private config;
    constructor(config: EpayConfig);
    /**
     * 生成签名（易支付V1接口标准）
     */
    private generateSign;
    /**
     * 验证签名
     */
    private verifySign;
    /**
     * 创建支付订单（易支付V1接口）
     */
    createOrder(params: CreateOrderParams): Promise<EpayOrderResponse>;
    /**
     * 验证回调通知
     */
    verifyNotify(notifyData: EpayNotifyData): boolean;
    /**
     * 查询订单状态（易支付V1接口）
     */
    queryOrder(outTradeNo: string): Promise<any>;
    /**
     * 获取支付方式配置（根据系统配置动态返回）
     */
    static getPaymentMethods(wxpayEnabled?: boolean, alipayEnabled?: boolean, balanceEnabled?: boolean): {
        type: string;
        name: string;
        icon: string;
        description: string;
    }[];
    /**
     * 生成订单号
     */
    static generateOrderNo(): string;
}
export declare const createEpayService: () => Promise<EpayService>;
//# sourceMappingURL=EpayService.d.ts.map