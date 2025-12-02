import type { OrganizationDomainVerificationJSON, VerificationJSON } from './JSON';
export declare class Verification {
    readonly status: string;
    readonly strategy: string;
    readonly externalVerificationRedirectURL: URL | null;
    readonly attempts: number | null;
    readonly expireAt: number | null;
    readonly nonce: string | null;
    readonly message: string | null;
    constructor(status: string, strategy: string, externalVerificationRedirectURL?: URL | null, attempts?: number | null, expireAt?: number | null, nonce?: string | null, message?: string | null);
    static fromJSON(data: VerificationJSON): Verification;
}
export declare class OrganizationDomainVerification {
    readonly status: string;
    readonly strategy: string;
    readonly attempts: number | null;
    readonly expireAt: number | null;
    constructor(status: string, strategy: string, attempts?: number | null, expireAt?: number | null);
    static fromJSON(data: OrganizationDomainVerificationJSON): OrganizationDomainVerification;
}
//# sourceMappingURL=Verification.d.ts.map