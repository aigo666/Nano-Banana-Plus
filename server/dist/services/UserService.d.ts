import type { User, UserBalance, JWTPayload, RegisterRequest, AuthRequest, PaginationQuery, PaginatedResponse } from '../types/index.js';
export declare class UserService {
    private static readonly JWT_SECRET;
    private static readonly JWT_EXPIRES_IN;
    static register(userData: RegisterRequest): Promise<{
        user: Omit<User, 'password_hash'>;
        token: string;
    }>;
    static login(loginData: AuthRequest): Promise<{
        user: Omit<User, 'password_hash'>;
        token: string;
    }>;
    static getUserById(id: number): Promise<User | null>;
    static getUsers(query: PaginationQuery & {
        vipStatus?: 'all' | 'vip' | 'normal';
        status?: 'all' | 'active' | 'inactive' | 'banned';
    }): Promise<PaginatedResponse<Omit<User, 'password_hash'>>>;
    static updateUserStatus(userId: number, status: 'active' | 'inactive' | 'banned'): Promise<void>;
    static updateUserRole(userId: number, role: 'user' | 'admin'): Promise<void>;
    static updateUser(id: number, updateData: {
        username?: string;
        email?: string;
        is_member?: boolean;
        member_expires_at?: string | null;
        available_times?: number;
        role?: 'user' | 'admin';
        status?: 'active' | 'inactive' | 'banned';
        newPassword?: string;
    }): Promise<void>;
    static deleteUser(userId: number): Promise<void>;
    static getUserBalance(userId: number): Promise<UserBalance | null>;
    static verifyToken(token: string): JWTPayload;
    private static generateToken;
    private static updateLastLogin;
    private static grantNewUserFreeCredits;
    static createDefaultAdmin(): Promise<void>;
}
//# sourceMappingURL=UserService.d.ts.map