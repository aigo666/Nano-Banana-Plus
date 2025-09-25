export interface User {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    avatar?: string;
    role: 'user' | 'admin';
    status: 'active' | 'inactive' | 'banned';
    is_member: boolean;
    member_expires_at?: string;
    created_at: string;
    updated_at: string;
    last_login?: string;
}
export interface UserBalance {
    id: number;
    user_id: number;
    balance: number;
    total_recharged: number;
    total_consumed: number;
    created_at: string;
    updated_at: string;
}
export interface GenerationHistory {
    id: number;
    user_id: number;
    prompt: string;
    original_images?: string[];
    generated_image?: string;
    style_template?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error_message?: string;
    created_at: string;
    updated_at: string;
}
export interface RechargeRecord {
    id: number;
    user_id: number;
    amount: number;
    payment_method: string;
    transaction_id?: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    created_at: string;
    updated_at: string;
}
export interface AuthRequest {
    email: string;
    password: string;
}
export interface RegisterRequest extends AuthRequest {
    username: string;
    confirmPassword: string;
}
export interface JWTPayload {
    userId: number;
    email: string;
    role: string;
}
export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    vipStatus?: 'all' | 'vip' | 'normal';
    status?: 'all' | 'active' | 'inactive' | 'banned';
}
export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface Package {
    id: number;
    name: string;
    times: number;
    validity_days: number;
    price: number;
    status: 'active' | 'inactive';
    sort_order: number;
    created_at: string;
    updated_at: string;
}
export interface CreatePackageRequest {
    name: string;
    usage_count: number;
    validity_days: number;
    price: number;
    sort_order?: number;
}
export interface UpdatePackageRequest extends Partial<CreatePackageRequest> {
    status?: 'active' | 'inactive';
}
export interface UserPackage {
    id: number;
    user_id: number;
    package_id: number | null;
    package_name: string;
    times_total: number;
    times_used: number;
    times_remaining: number;
    price: number;
    expires_at: string;
    status: 'active' | 'expired' | 'exhausted';
    created_at: string;
    updated_at: string;
}
export interface PurchasePackageRequest {
    package_id: number;
    payment_method: string;
}
//# sourceMappingURL=index.d.ts.map