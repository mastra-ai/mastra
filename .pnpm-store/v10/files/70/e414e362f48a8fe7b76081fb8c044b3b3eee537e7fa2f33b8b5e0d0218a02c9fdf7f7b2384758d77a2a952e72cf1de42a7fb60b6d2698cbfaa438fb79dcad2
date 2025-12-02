import * as _clerk_types from '@clerk/types';
import { CheckAuthorizationWithCustomPermissions, ReverificationConfig, SessionVerificationLevel, SessionStatusClaim, JwtPayload, ActClaim, OrganizationCustomRoleKey, OrganizationCustomPermissionKey, GetToken, SignOut, PendingSessionOptions, UseAuthReturn } from '@clerk/types';

type AuthorizationOptions = {
    userId: string | null | undefined;
    orgId: string | null | undefined;
    orgRole: string | null | undefined;
    orgPermissions: string[] | null | undefined;
    factorVerificationAge: [number, number] | null;
    features: string | null | undefined;
    plans: string | null | undefined;
};
declare const splitByScope: (fea: string | null | undefined) => {
    org: string[];
    user: string[];
};
declare const validateReverificationConfig: (config: ReverificationConfig | undefined | null) => false | (() => {
    level: SessionVerificationLevel;
    afterMinutes: _clerk_types.SessionVerificationAfterMinutes;
});
/**
 * Creates a function for comprehensive user authorization checks.
 * Combines organization-level and reverification authentication checks.
 * The returned function authorizes if both checks pass, or if at least one passes
 * when the other is indeterminate. Fails if userId is missing.
 */
declare const createCheckAuthorization: (options: AuthorizationOptions) => CheckAuthorizationWithCustomPermissions;
type AuthStateOptions = {
    authObject: {
        userId?: string | null;
        sessionId?: string | null;
        sessionStatus?: SessionStatusClaim | null;
        sessionClaims?: JwtPayload | null;
        actor?: ActClaim | null;
        orgId?: string | null;
        orgRole?: OrganizationCustomRoleKey | null;
        orgSlug?: string | null;
        orgPermissions?: OrganizationCustomPermissionKey[] | null;
        getToken: GetToken;
        signOut: SignOut;
        has: (params: Parameters<CheckAuthorizationWithCustomPermissions>[0]) => boolean;
    };
    options: PendingSessionOptions;
};
/**
 * Shared utility function that centralizes auth state resolution logic,
 * preventing duplication across different packages.
 * @internal
 */
declare const resolveAuthState: ({ authObject: { sessionId, sessionStatus, userId, actor, orgId, orgRole, orgSlug, signOut, getToken, has, sessionClaims, }, options: { treatPendingAsSignedOut }, }: AuthStateOptions) => UseAuthReturn | undefined;

export { createCheckAuthorization, resolveAuthState, splitByScope, validateReverificationConfig };
