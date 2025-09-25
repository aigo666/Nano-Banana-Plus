import type { Package, CreatePackageRequest, UpdatePackageRequest, UserPackage, PurchasePackageRequest, PaginationQuery, PaginatedResponse } from '../types/index.js';
export declare class PackageService {
    static getPackages(query?: PaginationQuery): Promise<PaginatedResponse<Package>>;
    static getActivePackages(): Promise<Package[]>;
    static getPackageById(id: number): Promise<Package | null>;
    static createPackage(packageData: CreatePackageRequest): Promise<Package>;
    static updatePackage(id: number, updateData: UpdatePackageRequest): Promise<Package>;
    static deletePackage(id: number): Promise<void>;
    static purchasePackage(userId: number, purchaseData: PurchasePackageRequest): Promise<UserPackage>;
    static getUserPackages(userId: number): Promise<UserPackage[]>;
    static getUserActivePackages(userId: number): Promise<UserPackage[]>;
    static usePackageTimes(userId: number, times?: number): Promise<boolean>;
    static checkUserAvailableTimes(userId: number): Promise<number>;
    static upgradeMember(userId: number, memberExpiresAt: Date): Promise<void>;
    static getUserMemberInfo(userId: number): Promise<{
        is_member: boolean;
        member_expires_at?: string;
        available_times: number;
    }>;
    static activatePackage(userId: number, packageId: number): Promise<void>;
}
//# sourceMappingURL=PackageService.d.ts.map