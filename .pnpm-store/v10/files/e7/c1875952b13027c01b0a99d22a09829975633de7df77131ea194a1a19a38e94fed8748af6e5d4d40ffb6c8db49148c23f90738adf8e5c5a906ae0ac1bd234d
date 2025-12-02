import type { OrganizationInvitationStatus, OrganizationMembershipRole } from './Enums';
import type { OrganizationInvitationJSON, PublicOrganizationDataJSON } from './JSON';
export declare class OrganizationInvitation {
    readonly id: string;
    readonly emailAddress: string;
    readonly role: OrganizationMembershipRole;
    readonly roleName: string;
    readonly organizationId: string;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly expiresAt: number;
    readonly url: string | null;
    readonly status?: OrganizationInvitationStatus | undefined;
    readonly publicMetadata: OrganizationInvitationPublicMetadata;
    readonly privateMetadata: OrganizationInvitationPrivateMetadata;
    readonly publicOrganizationData?: (PublicOrganizationDataJSON | null) | undefined;
    private _raw;
    get raw(): OrganizationInvitationJSON | null;
    constructor(id: string, emailAddress: string, role: OrganizationMembershipRole, roleName: string, organizationId: string, createdAt: number, updatedAt: number, expiresAt: number, url: string | null, status?: OrganizationInvitationStatus | undefined, publicMetadata?: OrganizationInvitationPublicMetadata, privateMetadata?: OrganizationInvitationPrivateMetadata, publicOrganizationData?: (PublicOrganizationDataJSON | null) | undefined);
    static fromJSON(data: OrganizationInvitationJSON): OrganizationInvitation;
}
//# sourceMappingURL=OrganizationInvitation.d.ts.map