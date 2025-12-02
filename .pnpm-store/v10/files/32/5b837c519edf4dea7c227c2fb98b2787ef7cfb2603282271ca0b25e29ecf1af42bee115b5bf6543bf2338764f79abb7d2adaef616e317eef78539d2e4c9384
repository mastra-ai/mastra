import { RoleResponse } from '../../roles/interfaces/';
export type OrganizationMembershipStatus = 'active' | 'inactive' | 'pending';
export interface OrganizationMembership {
    object: 'organization_membership';
    id: string;
    organizationId: string;
    organizationName: string;
    status: OrganizationMembershipStatus;
    userId: string;
    createdAt: string;
    updatedAt: string;
    role: RoleResponse;
    roles?: RoleResponse[];
}
export interface OrganizationMembershipResponse {
    object: 'organization_membership';
    id: string;
    organization_id: string;
    organization_name: string;
    status: OrganizationMembershipStatus;
    user_id: string;
    created_at: string;
    updated_at: string;
    role: RoleResponse;
    roles?: RoleResponse[];
}
