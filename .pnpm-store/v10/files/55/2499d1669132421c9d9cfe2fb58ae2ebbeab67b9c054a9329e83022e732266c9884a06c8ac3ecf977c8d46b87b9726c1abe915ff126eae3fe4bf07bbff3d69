import type { OrganizationEnrollmentMode } from './Enums';
import type { OrganizationDomainJSON } from './JSON';
import { OrganizationDomainVerification } from './Verification';
export declare class OrganizationDomain {
    readonly id: string;
    readonly organizationId: string;
    readonly name: string;
    readonly enrollmentMode: OrganizationEnrollmentMode;
    readonly verification: OrganizationDomainVerification | null;
    readonly totalPendingInvitations: number;
    readonly totalPendingSuggestions: number;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly affiliationEmailAddress: string | null;
    constructor(id: string, organizationId: string, name: string, enrollmentMode: OrganizationEnrollmentMode, verification: OrganizationDomainVerification | null, totalPendingInvitations: number, totalPendingSuggestions: number, createdAt: number, updatedAt: number, affiliationEmailAddress: string | null);
    static fromJSON(data: OrganizationDomainJSON): OrganizationDomain;
}
//# sourceMappingURL=OrganizationDomain.d.ts.map