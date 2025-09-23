import type { RechargeRecord, PaginationQuery } from '../types/index.js';
export interface RechargeQuery extends Omit<PaginationQuery, 'status'> {
    search?: string;
    status?: 'pending' | 'completed' | 'failed' | 'refunded';
    payment_method?: string;
    start_date?: string;
    end_date?: string;
    min_amount?: number;
    max_amount?: number;
    user_id?: number;
    sortBy?: 'created_at' | 'amount' | 'status';
    sortOrder?: 'asc' | 'desc';
}
export interface RechargeStats {
    totalRevenue: number;
    todayRevenue: number;
    monthRevenue: number;
    totalOrders: number;
    todayOrders: number;
    monthOrders: number;
    pendingOrders: number;
    completedOrders: number;
    failedOrders: number;
    refundedOrders: number;
    avgOrderAmount: number;
}
export interface ChartData {
    date: string;
    revenue: number;
    orders: number;
}
export interface PaymentMethodStats {
    payment_method: string;
    count: number;
    revenue: number;
}
export declare class RechargeService {
    /**
     * 获取充值记录列表（支持筛选和分页）
     */
    static getRechargeRecords(query: RechargeQuery): Promise<{
        records: (RechargeRecord & {
            username: string;
            email: string;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
        };
    }>;
    /**
     * 获取充值统计数据
     */
    static getRechargeStats(): Promise<RechargeStats>;
    /**
     * 获取充值趋势图表数据
     */
    static getChartData(days?: number): Promise<ChartData[]>;
    /**
     * 获取支付方式统计
     */
    static getPaymentMethodStats(): Promise<PaymentMethodStats[]>;
    /**
     * 创建充值记录
     */
    static createRechargeRecord(data: {
        user_id: number;
        amount: number;
        payment_method: string;
        transaction_id?: string;
    }): Promise<number>;
    /**
     * 更新充值记录状态
     */
    static updateRechargeStatus(id: number, status: 'pending' | 'completed' | 'failed' | 'refunded', transaction_id?: string): Promise<void>;
    /**
     * 处理退款
     */
    static processRefund(id: number, reason: string): Promise<void>;
    /**
     * 更新用户余额（充值成功时调用）
     */
    private static updateUserBalance;
    /**
     * 获取充值记录详情
     */
    static getRechargeRecordById(id: number): Promise<(RechargeRecord & {
        username: string;
        email: string;
    }) | null>;
    /**
     * 根据交易号获取充值记录
     */
    static getRechargeRecordByTransactionId(transactionId: string): Promise<(RechargeRecord & {
        username: string;
        email: string;
    }) | null>;
    /**
     * 导出充值记录为CSV格式
     */
    static exportRechargeRecords(query: RechargeQuery): Promise<string>;
}
//# sourceMappingURL=RechargeService.d.ts.map