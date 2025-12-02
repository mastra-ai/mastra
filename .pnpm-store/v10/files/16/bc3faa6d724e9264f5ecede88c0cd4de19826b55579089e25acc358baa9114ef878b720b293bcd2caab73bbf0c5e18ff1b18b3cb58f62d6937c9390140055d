import { Organization } from '../resources';
import type { OrganizationMembershipRole } from './Enums';
import type { OrganizationMembershipJSON, OrganizationMembershipPublicUserDataJSON } from './JSON';
export declare class OrganizationMembership {
    readonly id: string;
    readonly role: OrganizationMembershipRole;
    readonly permissions: string[];
    readonly publicMetadata: OrganizationMembershipPublicMetadata;
    readonly privateMetadata: OrganizationMembershipPrivateMetadata;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly organization: Organization;
    readonly publicUserData?: (OrganizationMembershipPublicUserData | null) | undefined;
    private _raw;
    get raw(): OrganizationMembershipJSON | null;
    constructor(id: string, role: OrganizationMembershipRole, permissions: string[], publicMetadata: OrganizationMembershipPublicMetadata | undefined, privateMetadata: OrganizationMembershipPrivateMetadata | undefined, createdAt: number, updatedAt: number, organization: Organization, publicUserData?: (OrganizationMembershipPublicUserData | null) | undefined);
    static fromJSON(data: OrganizationMembershipJSON): OrganizationMembership;
}
export declare class OrganizationMembershipPublicUserData {
    readonly identifier: string;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly imageUrl: string;
    readonly hasImage: boolean;
    readonly userId: string;
    constructor(identifier: string, firstName: string | null, lastName: string | null, imageUrl: string, hasImage: boolean, userId: string);
    static fromJSON(data: OrganizationMembershipPublicUserDataJSON): OrganizationMembershipPublicUserData;
}
//# sourceMappingURL=OrganizationMembership.d.ts.map