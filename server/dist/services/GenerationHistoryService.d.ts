export interface GenerationHistory {
    id: number;
    user_id: number;
    prompt: string;
    original_images: string[] | null;
    generated_image: string | null;
    consumed_times: number;
    style_template: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error_message: string | null;
    created_at: string;
    updated_at: string;
}
export interface CreateGenerationHistoryRequest {
    user_id: number;
    prompt: string;
    original_images?: string[];
    style_template?: string;
    consumed_times?: number;
}
export interface UpdateGenerationHistoryRequest {
    generated_image?: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    error_message?: string;
    consumed_times?: number;
}
export interface GenerationHistoryListResponse {
    items: GenerationHistory[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export declare class GenerationHistoryService {
    /**
     * 创建生成历史记录
     */
    static createHistory(data: CreateGenerationHistoryRequest): Promise<GenerationHistory>;
    /**
     * 根据ID获取生成历史记录
     */
    static getHistoryById(id: number): Promise<GenerationHistory | null>;
    /**
     * 更新生成历史记录
     */
    static updateHistory(id: number, data: UpdateGenerationHistoryRequest): Promise<GenerationHistory>;
    /**
     * 获取用户的生成历史记录（分页）
     */
    static getUserHistory(userId: number, page?: number, limit?: number): Promise<GenerationHistoryListResponse>;
    /**
     * 获取用户的生成统计信息
     */
    static getUserStats(userId: number): Promise<{
        total_generations: number;
        successful_generations: number;
        failed_generations: number;
        total_consumed_times: number;
    }>;
    /**
     * 删除生成历史记录
     */
    static deleteHistory(id: number, userId: number): Promise<void>;
    /**
     * 获取管理员的所有生成历史记录（分页）- 支持多种筛选条件
     */
    static getAllHistory(page?: number, limit?: number, filters?: {
        status?: string;
        username?: string;
        email?: string;
        startDate?: string;
        endDate?: string;
        prompt?: string;
    }): Promise<GenerationHistoryListResponse & {
        stats: {
            total_generations: number;
            successful_generations: number;
            failed_generations: number;
            total_consumed_times: number;
        };
    }>;
}
//# sourceMappingURL=GenerationHistoryService.d.ts.map