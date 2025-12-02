import type { ClerkPaginationRequest, OrganizationEnrollmentMode } from '@clerk/types';
import type { Organization, OrganizationDomain, OrganizationInvitation, OrganizationInvitationStatus, OrganizationMembership } from '../resources';
import type { PaginatedResourceResponse } from '../resources/Deserializer';
import type { OrganizationMembershipRole } from '../resources/Enums';
import { AbstractAPI } from './AbstractApi';
import type { WithSign } from './util-types';
type MetadataParams<TPublic = OrganizationPublicMetadata, TPrivate = OrganizationPrivateMetadata> = {
    publicMetadata?: TPublic;
    privateMetadata?: TPrivate;
};
type GetOrganizationListParams = ClerkPaginationRequest<{
    includeMembersCount?: boolean;
    query?: string;
    orderBy?: WithSign<'name' | 'created_at' | 'members_count'>;
    organizationId?: string[];
}>;
type CreateParams = {
    name: string;
    slug?: string;
    createdBy?: string;
    maxAllowedMemberships?: number;
} & MetadataParams;
type GetOrganizationParams = ({
    organizationId: string;
} | {
    slug: string;
}) & {
    includeMembersCount?: boolean;
};
type UpdateParams = {
    name?: string;
    slug?: string;
    maxAllowedMemberships?: number;
} & MetadataParams;
type UpdateLogoParams = {
    file: Blob | File;
    uploaderUserId?: string;
};
type UpdateMetadataParams = MetadataParams;
type GetOrganizationMembershipListParams = ClerkPaginationRequest<{
    organizationId: string;
    /**
     * Sorts organizations memberships by phone_number, email_address, created_at, first_name, last_name or username.
     * By prepending one of those values with + or -, we can choose to sort in ascending (ASC) or descending (DESC) order.
     */
    orderBy?: WithSign<'phone_number' | 'email_address' | 'created_at' | 'first_name' | 'last_name' | 'username'>;
    /**
     * Returns users with the user ids specified. For each user id, the `+` and `-` can be
     * prepended to the id, which denote whether the respective user id should be included or
     * excluded from the result set. Accepts up to 100 user ids. Any user ids not found are ignored.
     */
    userId?: string[];
    emailAddress?: string[];
    phoneNumber?: string[];
    username?: string[];
    web3Wallet?: string[];
    role?: OrganizationMembershipRole[];
    /**
     * Returns users that match the given query.
     * For possible matches, we check the email addresses, phone numbers, usernames, web3 wallets, user ids, first and last names.
     * The query value doesn't need to match the exact value you are looking for, it is capable of partial matches as well.
     */
    query?: string;
    /**
     * Returns users with emails that match the given query, via case-insensitive partial match.
     * For example, `email_address_query=ello` will match a user with the email `HELLO@example.com`.
     */
    emailAddressQuery?: string;
    /**
     * Returns users with phone numbers that match the given query, via case-insensitive partial match.
     * For example, `phone_number_query=555` will match a user with the phone number `+1555xxxxxxx`.
     */
    phoneNumberQuery?: string;
    /**
     * Returns users with usernames that match the given query, via case-insensitive partial match.
     * For example, `username_query=CoolUser` will match a user with the username `SomeCoolUser`.
     */
    usernameQuery?: string;
    nameQuery?: string;
    /**
     * Returns users whose last session activity was before the given date (with millisecond precision).
     * Example: use 1700690400000 to retrieve users whose last session activity was before 2023-11-23.
     */
    lastActiveAtBefore?: number;
    /**
     * Returns users whose last session activity was after the given date (with millisecond precision).
     * Example: use 1700690400000 to retrieve users whose last session activity was after 2023-11-23.
     */
    lastActiveAtAfter?: number;
    /**
     * Returns users who have been created before the given date (with millisecond precision).
     * Example: use 1730160000000 to retrieve users who have been created before 2024-10-29.
     */
    createdAtBefore?: number;
    /**
     * Returns users who have been created after the given date (with millisecond precision).
     * Example: use 1730160000000 to retrieve users who have been created after 2024-10-29.
     */
    createdAtAfter?: number;
}>;
type GetInstanceOrganizationMembershipListParams = ClerkPaginationRequest<{
    /**
     * Sorts organizations memberships by phone_number, email_address, created_at, first_name, last_name or username.
     * By prepending one of those values with + or -, we can choose to sort in ascending (ASC) or descending (DESC) order.
     */
    orderBy?: WithSign<'phone_number' | 'email_address' | 'created_at' | 'first_name' | 'last_name' | 'username'>;
}>;
type CreateOrganizationMembershipParams = {
    organizationId: string;
    userId: string;
    role: OrganizationMembershipRole;
};
type UpdateOrganizationMembershipParams = CreateOrganizationMembershipParams;
type UpdateOrganizationMembershipMetadataParams = {
    organizationId: string;
    userId: string;
} & MetadataParams<OrganizationMembershipPublicMetadata>;
type DeleteOrganizationMembershipParams = {
    organizationId: string;
    userId: string;
};
type CreateOrganizationInvitationParams = {
    organizationId: string;
    inviterUserId?: string;
    emailAddress: string;
    role: OrganizationMembershipRole;
    redirectUrl?: string;
    publicMetadata?: OrganizationInvitationPublicMetadata;
};
type CreateBulkOrganizationInvitationParams = Array<{
    inviterUserId?: string;
    emailAddress: string;
    role: OrganizationMembershipRole;
    redirectUrl?: string;
    publicMetadata?: OrganizationInvitationPublicMetadata;
}>;
type GetOrganizationInvitationListParams = ClerkPaginationRequest<{
    organizationId: string;
    status?: OrganizationInvitationStatus[];
}>;
type GetOrganizationInvitationParams = {
    organizationId: string;
    invitationId: string;
};
type RevokeOrganizationInvitationParams = {
    organizationId: string;
    invitationId: string;
    requestingUserId?: string;
};
type GetOrganizationDomainListParams = {
    organizationId: string;
    limit?: number;
    offset?: number;
};
type CreateOrganizationDomainParams = {
    organizationId: string;
    name: string;
    enrollmentMode: OrganizationEnrollmentMode;
    verified?: boolean;
};
type UpdateOrganizationDomainParams = {
    organizationId: string;
    domainId: string;
} & Partial<CreateOrganizationDomainParams>;
type DeleteOrganizationDomainParams = {
    organizationId: string;
    domainId: string;
};
export declare class OrganizationAPI extends AbstractAPI {
    getOrganizationList(params?: GetOrganizationListParams): Promise<PaginatedResourceResponse<Organization[]>>;
    createOrganization(params: CreateParams): Promise<Organization>;
    getOrganization(params: GetOrganizationParams): Promise<Organization>;
    updateOrganization(organizationId: string, params: UpdateParams): Promise<Organization>;
    updateOrganizationLogo(organizationId: string, params: UpdateLogoParams): Promise<Organization>;
    deleteOrganizationLogo(organizationId: string): Promise<Organization>;
    updateOrganizationMetadata(organizationId: string, params: UpdateMetadataParams): Promise<Organization>;
    deleteOrganization(organizationId: string): Promise<Organization>;
    getOrganizationMembershipList(params: GetOrganizationMembershipListParams): Promise<PaginatedResourceResponse<OrganizationMembership[]>>;
    getInstanceOrganizationMembershipList(params: GetInstanceOrganizationMembershipListParams): Promise<PaginatedResourceResponse<OrganizationMembership[]>>;
    createOrganizationMembership(params: CreateOrganizationMembershipParams): Promise<OrganizationMembership>;
    updateOrganizationMembership(params: UpdateOrganizationMembershipParams): Promise<OrganizationMembership>;
    updateOrganizationMembershipMetadata(params: UpdateOrganizationMembershipMetadataParams): Promise<OrganizationMembership>;
    deleteOrganizationMembership(params: DeleteOrganizationMembershipParams): Promise<OrganizationMembership>;
    getOrganizationInvitationList(params: GetOrganizationInvitationListParams): Promise<PaginatedResourceResponse<OrganizationInvitation[]>>;
    createOrganizationInvitation(params: CreateOrganizationInvitationParams): Promise<OrganizationInvitation>;
    createOrganizationInvitationBulk(organizationId: string, params: CreateBulkOrganizationInvitationParams): Promise<OrganizationInvitation[]>;
    getOrganizationInvitation(params: GetOrganizationInvitationParams): Promise<OrganizationInvitation>;
    revokeOrganizationInvitation(params: RevokeOrganizationInvitationParams): Promise<OrganizationInvitation>;
    getOrganizationDomainList(params: GetOrganizationDomainListParams): Promise<PaginatedResourceResponse<OrganizationDomain[]>>;
    createOrganizationDomain(params: CreateOrganizationDomainParams): Promise<OrganizationDomain>;
    updateOrganizationDomain(params: UpdateOrganizationDomainParams): Promise<OrganizationDomain>;
    deleteOrganizationDomain(params: DeleteOrganizationDomainParams): Promise<OrganizationDomain>;
}
export {};
//# sourceMappingURL=OrganizationApi.d.ts.map