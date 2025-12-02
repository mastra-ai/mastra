import type { TelemetryCollectorOptions } from '@clerk/shared/telemetry';
import { TelemetryCollector } from '@clerk/shared/telemetry';
import type { SDKMetadata } from '@clerk/types';
import type { ApiClient, CreateBackendApiOptions } from './api';
import type { CreateAuthenticateRequestOptions } from './tokens/factory';
import { createAuthenticateRequest } from './tokens/factory';
export declare const verifyToken: (token: string, options: import("./tokens/verify").VerifyTokenOptions) => Promise<NonNullable<import("@clerk/types").JwtPayload | undefined>>;
export type ClerkOptions = CreateBackendApiOptions & Partial<Pick<CreateAuthenticateRequestOptions['options'], 'audience' | 'jwtKey' | 'proxyUrl' | 'secretKey' | 'publishableKey' | 'domain' | 'isSatellite'>> & {
    sdkMetadata?: SDKMetadata;
    telemetry?: Pick<TelemetryCollectorOptions, 'disabled' | 'debug'>;
};
export type ClerkClient = {
    telemetry: TelemetryCollector;
} & ApiClient & ReturnType<typeof createAuthenticateRequest>;
export declare function createClerkClient(options: ClerkOptions): ClerkClient;
/**
 * General Types
 */
export type { OrganizationMembershipRole } from './api/resources';
export type { VerifyTokenOptions } from './tokens/verify';
/**
 * JSON types
 */
export type { ActorTokenJSON, AccountlessApplicationJSON, ClerkResourceJSON, TokenJSON, AllowlistIdentifierJSON, BlocklistIdentifierJSON, ClientJSON, CnameTargetJSON, DomainJSON, EmailJSON, EmailAddressJSON, ExternalAccountJSON, IdentificationLinkJSON, InstanceJSON, InstanceRestrictionsJSON, InstanceSettingsJSON, InvitationJSON, JwtTemplateJSON, OauthAccessTokenJSON, OAuthApplicationJSON, OrganizationJSON, OrganizationDomainJSON, OrganizationDomainVerificationJSON, OrganizationInvitationJSON, OrganizationSettingsJSON, PublicOrganizationDataJSON, OrganizationMembershipJSON, OrganizationMembershipPublicUserDataJSON, PhoneNumberJSON, ProxyCheckJSON, RedirectUrlJSON, SessionJSON, SignInJSON, SignInTokenJSON, SignUpJSON, SignUpVerificationJSON, SignUpVerificationsJSON, SMSMessageJSON, UserJSON, VerificationJSON, WaitlistEntryJSON, Web3WalletJSON, DeletedObjectJSON, PaginatedResponseJSON, TestingTokenJSON, WebhooksSvixJSON, } from './api/resources/JSON';
/**
 * Resources
 */
export type { ActorToken, AccountlessApplication, AllowlistIdentifier, BlocklistIdentifier, Client, CnameTarget, Domain, EmailAddress, ExternalAccount, Instance, InstanceRestrictions, InstanceSettings, Invitation, JwtTemplate, OauthAccessToken, OAuthApplication, Organization, OrganizationDomain, OrganizationDomainVerification, OrganizationInvitation, OrganizationMembership, OrganizationMembershipPublicUserData, OrganizationSettings, PhoneNumber, Session, SignInToken, SignUpAttempt, SMSMessage, Token, User, TestingToken, } from './api/resources';
/**
 * Webhooks event types
 */
export type { EmailWebhookEvent, OrganizationWebhookEvent, OrganizationDomainWebhookEvent, OrganizationInvitationWebhookEvent, OrganizationMembershipWebhookEvent, RoleWebhookEvent, PermissionWebhookEvent, SessionWebhookEvent, SMSWebhookEvent, UserWebhookEvent, WaitlistEntryWebhookEvent, WebhookEvent, WebhookEventType, } from './api/resources/Webhooks';
/**
 * Auth objects
 */
export type { AuthObject } from './tokens/authObjects';
//# sourceMappingURL=index.d.ts.map