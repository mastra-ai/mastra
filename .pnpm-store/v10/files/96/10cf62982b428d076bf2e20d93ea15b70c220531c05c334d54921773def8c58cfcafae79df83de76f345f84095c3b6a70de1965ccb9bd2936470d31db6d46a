import { createRemoteJWKSet } from 'jose';
import { IronSessionProvider } from '../common/iron-session/iron-session-provider';
import { AutoPaginatable } from '../common/utils/pagination';
import { Challenge } from '../mfa/interfaces';
import { FeatureFlag } from '../feature-flags/interfaces/feature-flag.interface';
import { WorkOS } from '../workos';
import { AuthenticateWithCodeOptions, AuthenticateWithCodeAndVerifierOptions, AuthenticateWithMagicAuthOptions, AuthenticateWithPasswordOptions, AuthenticateWithRefreshTokenOptions, AuthenticateWithTotpOptions, AuthenticationResponse, CreateMagicAuthOptions, CreatePasswordResetOptions, CreateUserOptions, EmailVerification, EnrollAuthFactorOptions, ListAuthFactorsOptions, ListSessionsOptions, ListUsersOptions, ListUserFeatureFlagsOptions, MagicAuth, PasswordReset, ResetPasswordOptions, SendMagicAuthCodeOptions, SendPasswordResetEmailOptions, SendVerificationEmailOptions, Session, UpdateUserOptions, User, VerifyEmailOptions } from './interfaces';
import { AuthenticateWithEmailVerificationOptions } from './interfaces/authenticate-with-email-verification-options.interface';
import { AuthenticateWithOrganizationSelectionOptions } from './interfaces/authenticate-with-organization-selection.interface';
import { AuthenticateWithSessionCookieFailedResponse, AuthenticateWithSessionCookieOptions, AuthenticateWithSessionCookieSuccessResponse, SessionCookieData } from './interfaces/authenticate-with-session-cookie.interface';
import { UserManagementAuthorizationURLOptions } from './interfaces/authorization-url-options.interface';
import { CreateOrganizationMembershipOptions } from './interfaces/create-organization-membership-options.interface';
import { Factor, FactorWithSecrets } from './interfaces/factor.interface';
import { Identity } from './interfaces/identity.interface';
import { Invitation } from './interfaces/invitation.interface';
import { ListInvitationsOptions } from './interfaces/list-invitations-options.interface';
import { ListOrganizationMembershipsOptions } from './interfaces/list-organization-memberships-options.interface';
import { OrganizationMembership } from './interfaces/organization-membership.interface';
import { RefreshAndSealSessionDataResponse } from './interfaces/refresh-and-seal-session-data.interface';
import { RevokeSessionOptions } from './interfaces/revoke-session-options.interface';
import { SendInvitationOptions } from './interfaces/send-invitation-options.interface';
import { SessionHandlerOptions } from './interfaces/session-handler-options.interface';
import { UpdateOrganizationMembershipOptions } from './interfaces/update-organization-membership-options.interface';
import { CookieSession } from './session';
export declare class UserManagement {
    private readonly workos;
    private _jwks;
    clientId: string | undefined;
    ironSessionProvider: IronSessionProvider;
    constructor(workos: WorkOS, ironSessionProvider: IronSessionProvider);
    get jwks(): ReturnType<typeof createRemoteJWKSet> | undefined;
    /**
     * Loads a sealed session using the provided session data and cookie password.
     *
     * @param options - The options for loading the sealed session.
     * @param options.sessionData - The sealed session data.
     * @param options.cookiePassword - The password used to encrypt the session data.
     * @returns The session class.
     */
    loadSealedSession(options: {
        sessionData: string;
        cookiePassword: string;
    }): CookieSession;
    getUser(userId: string): Promise<User>;
    getUserByExternalId(externalId: string): Promise<User>;
    listUsers(options?: ListUsersOptions): Promise<AutoPaginatable<User>>;
    createUser(payload: CreateUserOptions): Promise<User>;
    authenticateWithMagicAuth(payload: AuthenticateWithMagicAuthOptions): Promise<AuthenticationResponse>;
    authenticateWithPassword(payload: AuthenticateWithPasswordOptions): Promise<AuthenticationResponse>;
    authenticateWithCode(payload: AuthenticateWithCodeOptions): Promise<AuthenticationResponse>;
    authenticateWithCodeAndVerifier(payload: AuthenticateWithCodeAndVerifierOptions): Promise<AuthenticationResponse>;
    authenticateWithRefreshToken(payload: AuthenticateWithRefreshTokenOptions): Promise<AuthenticationResponse>;
    authenticateWithTotp(payload: AuthenticateWithTotpOptions): Promise<AuthenticationResponse>;
    authenticateWithEmailVerification(payload: AuthenticateWithEmailVerificationOptions): Promise<AuthenticationResponse>;
    authenticateWithOrganizationSelection(payload: AuthenticateWithOrganizationSelectionOptions): Promise<AuthenticationResponse>;
    authenticateWithSessionCookie({ sessionData, cookiePassword, }: AuthenticateWithSessionCookieOptions): Promise<AuthenticateWithSessionCookieSuccessResponse | AuthenticateWithSessionCookieFailedResponse>;
    private isValidJwt;
    /**
     * @deprecated This method is deprecated and will be removed in a future major version.
     * Please use the new `loadSealedSession` helper and its corresponding methods instead.
     */
    refreshAndSealSessionData({ sessionData, organizationId, cookiePassword, }: SessionHandlerOptions): Promise<RefreshAndSealSessionDataResponse>;
    private prepareAuthenticationResponse;
    private sealSessionDataFromAuthenticationResponse;
    getSessionFromCookie({ sessionData, cookiePassword, }: SessionHandlerOptions): Promise<SessionCookieData | undefined>;
    getEmailVerification(emailVerificationId: string): Promise<EmailVerification>;
    sendVerificationEmail({ userId, }: SendVerificationEmailOptions): Promise<{
        user: User;
    }>;
    getMagicAuth(magicAuthId: string): Promise<MagicAuth>;
    createMagicAuth(options: CreateMagicAuthOptions): Promise<MagicAuth>;
    /**
     * @deprecated Please use `createMagicAuth` instead.
     * This method will be removed in a future major version.
     */
    sendMagicAuthCode(options: SendMagicAuthCodeOptions): Promise<void>;
    verifyEmail({ code, userId, }: VerifyEmailOptions): Promise<{
        user: User;
    }>;
    getPasswordReset(passwordResetId: string): Promise<PasswordReset>;
    createPasswordReset(options: CreatePasswordResetOptions): Promise<PasswordReset>;
    /**
     * @deprecated Please use `createPasswordReset` instead. This method will be removed in a future major version.
     */
    sendPasswordResetEmail(payload: SendPasswordResetEmailOptions): Promise<void>;
    resetPassword(payload: ResetPasswordOptions): Promise<{
        user: User;
    }>;
    updateUser(payload: UpdateUserOptions): Promise<User>;
    enrollAuthFactor(payload: EnrollAuthFactorOptions): Promise<{
        authenticationFactor: FactorWithSecrets;
        authenticationChallenge: Challenge;
    }>;
    listAuthFactors(options: ListAuthFactorsOptions): Promise<AutoPaginatable<Factor>>;
    listUserFeatureFlags(options: ListUserFeatureFlagsOptions): Promise<AutoPaginatable<FeatureFlag>>;
    listSessions(userId: string, options?: ListSessionsOptions): Promise<AutoPaginatable<Session>>;
    deleteUser(userId: string): Promise<void>;
    getUserIdentities(userId: string): Promise<Identity[]>;
    getOrganizationMembership(organizationMembershipId: string): Promise<OrganizationMembership>;
    listOrganizationMemberships(options: ListOrganizationMembershipsOptions): Promise<AutoPaginatable<OrganizationMembership>>;
    createOrganizationMembership(options: CreateOrganizationMembershipOptions): Promise<OrganizationMembership>;
    updateOrganizationMembership(organizationMembershipId: string, options: UpdateOrganizationMembershipOptions): Promise<OrganizationMembership>;
    deleteOrganizationMembership(organizationMembershipId: string): Promise<void>;
    deactivateOrganizationMembership(organizationMembershipId: string): Promise<OrganizationMembership>;
    reactivateOrganizationMembership(organizationMembershipId: string): Promise<OrganizationMembership>;
    getInvitation(invitationId: string): Promise<Invitation>;
    findInvitationByToken(invitationToken: string): Promise<Invitation>;
    listInvitations(options: ListInvitationsOptions): Promise<AutoPaginatable<Invitation>>;
    sendInvitation(payload: SendInvitationOptions): Promise<Invitation>;
    acceptInvitation(invitationId: string): Promise<Invitation>;
    revokeInvitation(invitationId: string): Promise<Invitation>;
    revokeSession(payload: RevokeSessionOptions): Promise<void>;
    getAuthorizationUrl({ connectionId, codeChallenge, codeChallengeMethod, context, clientId, domainHint, loginHint, organizationId, provider, providerQueryParams, providerScopes, prompt, redirectUri, state, screenHint, }: UserManagementAuthorizationURLOptions): string;
    getLogoutUrl({ sessionId, returnTo, }: {
        sessionId: string;
        returnTo?: string;
    }): string;
    /**
     * @deprecated This method is deprecated and will be removed in a future major version.
     * Please use the `loadSealedSession` helper and its `getLogoutUrl` method instead.
     *
     * getLogoutUrlFromSessionCookie takes in session cookie data, unseals the cookie, decodes the JWT claims,
     * and uses the session ID to generate the logout URL.
     *
     * Use this over `getLogoutUrl` if you'd like to the SDK to handle session cookies for you.
     */
    getLogoutUrlFromSessionCookie({ sessionData, cookiePassword, }: SessionHandlerOptions): Promise<string>;
    getJwksUrl(clientId: string): string;
}
