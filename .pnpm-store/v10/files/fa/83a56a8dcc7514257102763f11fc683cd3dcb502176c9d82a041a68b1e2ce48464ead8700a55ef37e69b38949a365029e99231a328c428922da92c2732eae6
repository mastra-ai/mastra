import type { OrganizationCustomRoleKey } from '@clerk/types';
export type OAuthProvider = 'facebook' | 'google' | 'hubspot' | 'github' | 'tiktok' | 'gitlab' | 'discord' | 'twitter' | 'twitch' | 'linkedin' | 'linkedin_oidc' | 'dropbox' | 'bitbucket' | 'microsoft' | 'notion' | 'apple' | 'x';
export type OAuthStrategy = `oauth_${OAuthProvider}`;
export type OrganizationInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type OrganizationDomainVerificationStatus = 'unverified' | 'verified';
export type OrganizationDomainVerificationStrategy = 'email_code';
export type OrganizationEnrollmentMode = 'manual_invitation' | 'automatic_invitation' | 'automatic_suggestion';
export type OrganizationMembershipRole = OrganizationCustomRoleKey;
export type SignInStatus = 'needs_identifier' | 'needs_factor_one' | 'needs_factor_two' | 'complete';
export type SignUpVerificationNextAction = 'needs_prepare' | 'needs_attempt' | '';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export declare const DomainsEnrollmentModes: {
    readonly ManualInvitation: "manual_invitation";
    readonly AutomaticInvitation: "automatic_invitation";
    readonly AutomaticSuggestion: "automatic_suggestion";
};
export type DomainsEnrollmentModes = (typeof DomainsEnrollmentModes)[keyof typeof DomainsEnrollmentModes];
export declare const ActorTokenStatus: {
    readonly Pending: "pending";
    readonly Accepted: "accepted";
    readonly Revoked: "revoked";
};
export type ActorTokenStatus = (typeof ActorTokenStatus)[keyof typeof ActorTokenStatus];
export type AllowlistIdentifierType = 'email_address' | 'phone_number' | 'web3_wallet';
export type BlocklistIdentifierType = AllowlistIdentifierType;
export type WaitlistEntryStatus = 'pending' | 'invited' | 'completed' | 'rejected';
//# sourceMappingURL=Enums.d.ts.map