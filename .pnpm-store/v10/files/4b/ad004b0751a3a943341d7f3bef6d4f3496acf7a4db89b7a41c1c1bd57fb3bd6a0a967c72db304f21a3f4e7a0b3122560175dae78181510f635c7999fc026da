import type { SignUpStatus } from '@clerk/types';
import type { ActorTokenStatus, AllowlistIdentifierType, BlocklistIdentifierType, DomainsEnrollmentModes, InvitationStatus, OrganizationDomainVerificationStatus, OrganizationDomainVerificationStrategy, OrganizationEnrollmentMode, OrganizationInvitationStatus, OrganizationMembershipRole, SignInStatus, SignUpVerificationNextAction, WaitlistEntryStatus } from './Enums';
export declare const ObjectType: {
    readonly AccountlessApplication: "accountless_application";
    readonly ActorToken: "actor_token";
    readonly AllowlistIdentifier: "allowlist_identifier";
    readonly BlocklistIdentifier: "blocklist_identifier";
    readonly Client: "client";
    readonly Cookies: "cookies";
    readonly Domain: "domain";
    readonly Email: "email";
    readonly EmailAddress: "email_address";
    readonly ExternalAccount: "external_account";
    readonly FacebookAccount: "facebook_account";
    readonly GoogleAccount: "google_account";
    readonly Instance: "instance";
    readonly InstanceRestrictions: "instance_restrictions";
    readonly InstanceSettings: "instance_settings";
    readonly Invitation: "invitation";
    readonly JwtTemplate: "jwt_template";
    readonly OauthAccessToken: "oauth_access_token";
    readonly OAuthApplication: "oauth_application";
    readonly Organization: "organization";
    readonly OrganizationDomain: "organization_domain";
    readonly OrganizationInvitation: "organization_invitation";
    readonly OrganizationMembership: "organization_membership";
    readonly OrganizationSettings: "organization_settings";
    readonly PhoneNumber: "phone_number";
    readonly ProxyCheck: "proxy_check";
    readonly RedirectUrl: "redirect_url";
    readonly SamlAccount: "saml_account";
    readonly SamlConnection: "saml_connection";
    readonly Session: "session";
    readonly SignInAttempt: "sign_in_attempt";
    readonly SignInToken: "sign_in_token";
    readonly SignUpAttempt: "sign_up_attempt";
    readonly SmsMessage: "sms_message";
    readonly User: "user";
    readonly WaitlistEntry: "waitlist_entry";
    readonly Web3Wallet: "web3_wallet";
    readonly Token: "token";
    readonly TotalCount: "total_count";
    readonly TestingToken: "testing_token";
    readonly Role: "role";
    readonly Permission: "permission";
};
export type ObjectType = (typeof ObjectType)[keyof typeof ObjectType];
export interface ClerkResourceJSON {
    object: ObjectType;
    id: string;
}
export interface CookiesJSON {
    object: typeof ObjectType.Cookies;
    cookies: string[];
}
export interface TokenJSON {
    object: typeof ObjectType.Token;
    jwt: string;
}
export interface AccountlessApplicationJSON extends ClerkResourceJSON {
    object: typeof ObjectType.AccountlessApplication;
    publishable_key: string;
    secret_key: string;
    claim_url: string;
    api_keys_url: string;
}
export interface ActorTokenJSON extends ClerkResourceJSON {
    object: typeof ObjectType.ActorToken;
    id: string;
    status: ActorTokenStatus;
    user_id: string;
    actor: Record<string, unknown> | null;
    token?: string | null;
    url?: string | null;
    created_at: number;
    updated_at: number;
}
export interface AllowlistIdentifierJSON extends ClerkResourceJSON {
    object: typeof ObjectType.AllowlistIdentifier;
    identifier: string;
    identifier_type: AllowlistIdentifierType;
    instance_id?: string;
    invitation_id?: string;
    created_at: number;
    updated_at: number;
}
export interface BlocklistIdentifierJSON extends ClerkResourceJSON {
    object: typeof ObjectType.BlocklistIdentifier;
    identifier: string;
    identifier_type: BlocklistIdentifierType;
    instance_id?: string;
    created_at: number;
    updated_at: number;
}
export interface ClientJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Client;
    session_ids: string[];
    sessions: SessionJSON[];
    sign_in_id: string | null;
    sign_up_id: string | null;
    last_active_session_id: string | null;
    created_at: number;
    updated_at: number;
}
export interface CnameTargetJSON {
    host: string;
    value: string;
    /**
     * Denotes whether this CNAME target is required to be set in order for the domain to be considered deployed.
     */
    required: boolean;
}
export interface DomainJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Domain;
    id: string;
    name: string;
    is_satellite: boolean;
    frontend_api_url: string;
    /**
     * null for satellite domains
     */
    accounts_portal_url?: string | null;
    proxy_url?: string;
    development_origin: string;
    cname_targets: CnameTargetJSON[];
}
export interface EmailJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Email;
    slug?: string | null;
    from_email_name: string;
    to_email_address?: string;
    email_address_id: string | null;
    user_id?: string | null;
    subject?: string;
    body?: string;
    body_plain?: string | null;
    status?: string;
    data?: Record<string, any> | null;
    delivered_by_clerk: boolean;
}
export interface EmailAddressJSON extends ClerkResourceJSON {
    object: typeof ObjectType.EmailAddress;
    email_address: string;
    verification: VerificationJSON | null;
    linked_to: IdentificationLinkJSON[];
}
export interface ExternalAccountJSON extends ClerkResourceJSON {
    object: typeof ObjectType.ExternalAccount;
    provider: string;
    identification_id: string;
    provider_user_id: string;
    approved_scopes: string;
    email_address: string;
    first_name: string;
    last_name: string;
    image_url?: string;
    username: string | null;
    phone_number: string | null;
    public_metadata?: Record<string, unknown> | null;
    label: string | null;
    verification: VerificationJSON | null;
}
export interface JwksJSON {
    keys?: JwksKeyJSON[];
}
export interface JwksKeyJSON {
    use: string;
    kty: string;
    kid: string;
    alg: string;
    n: string;
    e: string;
}
export interface JwtTemplateJSON extends ClerkResourceJSON {
    object: typeof ObjectType.JwtTemplate;
    id: string;
    name: string;
    claims: object;
    lifetime: number;
    allowed_clock_skew: number;
    custom_signing_key: boolean;
    signing_algorithm: string;
    created_at: number;
    updated_at: number;
}
export interface SamlAccountJSON extends ClerkResourceJSON {
    object: typeof ObjectType.SamlAccount;
    provider: string;
    provider_user_id: string | null;
    active: boolean;
    email_address: string;
    first_name: string;
    last_name: string;
    verification: VerificationJSON | null;
    saml_connection: SamlAccountConnectionJSON | null;
}
export interface IdentificationLinkJSON extends ClerkResourceJSON {
    type: string;
}
export interface OrganizationSettingsJSON extends ClerkResourceJSON {
    object: typeof ObjectType.OrganizationSettings;
    enabled: boolean;
    max_allowed_memberships: number;
    max_allowed_roles: number;
    max_allowed_permissions: number;
    creator_role: string;
    admin_delete_enabled: boolean;
    domains_enabled: boolean;
    domains_enrollment_modes: Array<DomainsEnrollmentModes>;
    domains_default_role: string;
}
export interface InstanceJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Instance;
    id: string;
    environment_type: string;
    allowed_origins: Array<string> | null;
}
export interface InstanceRestrictionsJSON extends ClerkResourceJSON {
    object: typeof ObjectType.InstanceRestrictions;
    allowlist: boolean;
    blocklist: boolean;
    block_email_subaddresses: boolean;
    block_disposable_email_domains: boolean;
    ignore_dots_for_gmail_addresses: boolean;
}
export interface InstanceSettingsJSON extends ClerkResourceJSON {
    object: typeof ObjectType.InstanceSettings;
    id: string;
    restricted_to_allowlist: boolean;
    from_email_address: string;
    progressive_sign_up: boolean;
    enhanced_email_deliverability: boolean;
}
export interface InvitationJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Invitation;
    email_address: string;
    public_metadata: Record<string, unknown> | null;
    revoked?: boolean;
    status: InvitationStatus;
    url?: string;
    created_at: number;
    updated_at: number;
}
export interface OauthAccessTokenJSON {
    external_account_id: string;
    object: typeof ObjectType.OauthAccessToken;
    token: string;
    provider: string;
    public_metadata: Record<string, unknown>;
    label: string | null;
    scopes?: string[];
    token_secret?: string;
    expires_at?: number;
}
export interface OAuthApplicationJSON extends ClerkResourceJSON {
    object: typeof ObjectType.OAuthApplication;
    id: string;
    instance_id: string;
    name: string;
    client_id: string;
    public: boolean;
    scopes: string;
    redirect_uris: Array<string>;
    authorize_url: string;
    token_fetch_url: string;
    user_info_url: string;
    discovery_url: string;
    token_introspection_url: string;
    created_at: number;
    updated_at: number;
    client_secret?: string;
}
export interface OrganizationJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Organization;
    name: string;
    slug: string;
    image_url?: string;
    has_image: boolean;
    members_count?: number;
    pending_invitations_count?: number;
    max_allowed_memberships: number;
    admin_delete_enabled: boolean;
    public_metadata: OrganizationPublicMetadata | null;
    private_metadata?: OrganizationPrivateMetadata;
    created_by?: string;
    created_at: number;
    updated_at: number;
}
export interface OrganizationDomainJSON extends ClerkResourceJSON {
    object: typeof ObjectType.OrganizationDomain;
    id: string;
    name: string;
    organization_id: string;
    enrollment_mode: OrganizationEnrollmentMode;
    verification: OrganizationDomainVerificationJSON | null;
    affiliation_email_address: string | null;
    created_at: number;
    updated_at: number;
    total_pending_invitations: number;
    total_pending_suggestions: number;
}
export interface OrganizationDomainVerificationJSON {
    status: OrganizationDomainVerificationStatus;
    strategy: OrganizationDomainVerificationStrategy;
    attempts: number;
    expires_at: number;
}
export interface OrganizationInvitationJSON extends ClerkResourceJSON {
    email_address: string;
    role: OrganizationMembershipRole;
    role_name: string;
    organization_id: string;
    public_organization_data?: PublicOrganizationDataJSON | null;
    status?: OrganizationInvitationStatus;
    public_metadata: OrganizationInvitationPublicMetadata;
    private_metadata: OrganizationInvitationPrivateMetadata;
    url: string | null;
    created_at: number;
    updated_at: number;
    expires_at: number;
}
export interface PublicOrganizationDataJSON extends ClerkResourceJSON {
    name: string;
    slug: string;
    image_url?: string;
    has_image: boolean;
}
export interface OrganizationMembershipJSON extends ClerkResourceJSON {
    object: typeof ObjectType.OrganizationMembership;
    public_metadata: OrganizationMembershipPublicMetadata;
    private_metadata?: OrganizationMembershipPrivateMetadata;
    role: OrganizationMembershipRole;
    permissions: string[];
    created_at: number;
    updated_at: number;
    organization: OrganizationJSON;
    public_user_data: OrganizationMembershipPublicUserDataJSON;
}
export interface OrganizationMembershipPublicUserDataJSON {
    identifier: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    has_image: boolean;
    user_id: string;
}
export interface PhoneNumberJSON extends ClerkResourceJSON {
    object: typeof ObjectType.PhoneNumber;
    phone_number: string;
    reserved_for_second_factor: boolean;
    default_second_factor: boolean;
    reserved: boolean;
    verification: VerificationJSON | null;
    linked_to: IdentificationLinkJSON[];
    backup_codes: string[];
}
export type ProxyCheckJSON = {
    object: typeof ObjectType.ProxyCheck;
    id: string;
    domain_id: string;
    last_run_at: number | null;
    proxy_url: string;
    successful: boolean;
    created_at: number;
    updated_at: number;
};
export interface RedirectUrlJSON extends ClerkResourceJSON {
    object: typeof ObjectType.RedirectUrl;
    url: string;
    created_at: number;
    updated_at: number;
}
export interface SessionActivityJSON extends ClerkResourceJSON {
    id: string;
    device_type?: string;
    is_mobile: boolean;
    browser_name?: string;
    browser_version?: string;
    ip_address?: string;
    city?: string;
    country?: string;
}
export interface SessionJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Session;
    client_id: string;
    user_id: string;
    status: string;
    last_active_organization_id?: string;
    actor: Record<string, unknown> | null;
    latest_activity?: SessionActivityJSON;
    last_active_at: number;
    expire_at: number;
    abandon_at: number;
    created_at: number;
    updated_at: number;
}
export interface SignInJSON extends ClerkResourceJSON {
    object: typeof ObjectType.SignInToken;
    status: SignInStatus;
    identifier: string;
    created_session_id: string | null;
}
export interface SignInTokenJSON extends ClerkResourceJSON {
    object: typeof ObjectType.SignInToken;
    user_id: string;
    token: string;
    status: 'pending' | 'accepted' | 'revoked';
    url: string;
    created_at: number;
    updated_at: number;
}
export interface SignUpJSON extends ClerkResourceJSON {
    object: typeof ObjectType.SignUpAttempt;
    id: string;
    status: SignUpStatus;
    required_fields: string[];
    optional_fields: string[];
    missing_fields: string[];
    unverified_fields: string[];
    verifications: SignUpVerificationsJSON;
    username: string | null;
    email_address: string | null;
    phone_number: string | null;
    web3_wallet: string | null;
    password_enabled: boolean;
    first_name: string | null;
    last_name: string | null;
    public_metadata?: Record<string, unknown> | null;
    unsafe_metadata?: Record<string, unknown> | null;
    custom_action: boolean;
    external_id: string | null;
    created_session_id: string | null;
    created_user_id: string | null;
    abandon_at: number | null;
    legal_accepted_at: number | null;
    /**
     * @deprecated Please use `verifications.external_account` instead
     */
    external_account: object | null;
}
export interface SignUpVerificationsJSON {
    email_address: SignUpVerificationJSON;
    phone_number: SignUpVerificationJSON;
    web3_wallet: SignUpVerificationJSON;
    external_account: VerificationJSON;
}
export interface SignUpVerificationJSON {
    next_action: SignUpVerificationNextAction;
    supported_strategies: string[];
}
export interface SMSMessageJSON extends ClerkResourceJSON {
    object: typeof ObjectType.SmsMessage;
    from_phone_number: string;
    to_phone_number: string;
    phone_number_id: string | null;
    user_id?: string;
    message: string;
    status: string;
    slug?: string | null;
    data?: Record<string, any> | null;
    delivered_by_clerk: boolean;
}
export interface UserJSON extends ClerkResourceJSON {
    object: typeof ObjectType.User;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    has_image: boolean;
    primary_email_address_id: string | null;
    primary_phone_number_id: string | null;
    primary_web3_wallet_id: string | null;
    password_enabled: boolean;
    two_factor_enabled: boolean;
    totp_enabled: boolean;
    backup_code_enabled: boolean;
    email_addresses: EmailAddressJSON[];
    phone_numbers: PhoneNumberJSON[];
    web3_wallets: Web3WalletJSON[];
    organization_memberships: OrganizationMembershipJSON[] | null;
    external_accounts: ExternalAccountJSON[];
    saml_accounts: SamlAccountJSON[];
    password_last_updated_at: number | null;
    public_metadata: UserPublicMetadata;
    private_metadata: UserPrivateMetadata;
    unsafe_metadata: UserUnsafeMetadata;
    external_id: string | null;
    last_sign_in_at: number | null;
    banned: boolean;
    locked: boolean;
    lockout_expires_in_seconds: number | null;
    verification_attempts_remaining: number | null;
    created_at: number;
    updated_at: number;
    last_active_at: number | null;
    create_organization_enabled: boolean;
    create_organizations_limit: number | null;
    delete_self_enabled: boolean;
    legal_accepted_at: number | null;
}
export interface VerificationJSON extends ClerkResourceJSON {
    status: string;
    strategy: string;
    attempts: number | null;
    expire_at: number | null;
    verified_at_client?: string;
    external_verification_redirect_url?: string | null;
    nonce?: string | null;
    message?: string | null;
}
export interface WaitlistEntryJSON extends ClerkResourceJSON {
    object: typeof ObjectType.WaitlistEntry;
    id: string;
    status: WaitlistEntryStatus;
    email_address: string;
    invitation: InvitationJSON | null;
    is_locked: boolean;
    created_at: number;
    updated_at: number;
}
export interface Web3WalletJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Web3Wallet;
    web3_wallet: string;
    verification: VerificationJSON | null;
}
export interface DeletedObjectJSON {
    object: string;
    id?: string;
    slug?: string;
    deleted: boolean;
}
export interface PaginatedResponseJSON {
    data: object[];
    total_count?: number;
}
export interface SamlConnectionJSON extends ClerkResourceJSON {
    object: typeof ObjectType.SamlConnection;
    name: string;
    domain: string;
    organization_id: string | null;
    idp_entity_id: string;
    idp_sso_url: string;
    idp_certificate: string;
    idp_metadata_url: string;
    idp_metadata: string;
    acs_url: string;
    sp_entity_id: string;
    sp_metadata_url: string;
    active: boolean;
    provider: string;
    user_count: number;
    sync_user_attributes: boolean;
    allow_subdomains: boolean;
    allow_idp_initiated: boolean;
    created_at: number;
    updated_at: number;
    attribute_mapping: AttributeMappingJSON;
}
export interface AttributeMappingJSON {
    user_id: string;
    email_address: string;
    first_name: string;
    last_name: string;
}
export interface TestingTokenJSON {
    object: typeof ObjectType.TestingToken;
    token: string;
    expires_at: number;
}
export interface RoleJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Role;
    key: string;
    name: string;
    description: string;
    permissions: PermissionJSON[];
    is_creator_eligible: boolean;
    created_at: number;
    updated_at: number;
}
export interface PermissionJSON extends ClerkResourceJSON {
    object: typeof ObjectType.Permission;
    key: string;
    name: string;
    description: string;
    created_at: number;
    updated_at: number;
}
export interface SamlAccountConnectionJSON extends ClerkResourceJSON {
    id: string;
    name: string;
    domain: string;
    active: boolean;
    provider: string;
    sync_user_attributes: boolean;
    allow_subdomains: boolean;
    allow_idp_initiated: boolean;
    disable_additional_identifications: boolean;
    created_at: number;
    updated_at: number;
}
export interface WebhooksSvixJSON {
    svix_url: string;
}
//# sourceMappingURL=JSON.d.ts.map