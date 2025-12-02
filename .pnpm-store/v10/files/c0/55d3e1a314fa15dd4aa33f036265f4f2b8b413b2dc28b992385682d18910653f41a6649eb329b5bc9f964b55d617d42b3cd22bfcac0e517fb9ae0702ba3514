import * as _clerk_types from '@clerk/types';
import { Resources, InitialState, UserResource, SignedInSessionResource, JwtPayload, OrganizationResource } from '@clerk/types';

/**
 * Derives authentication state based on the current rendering context (SSR or client-side).
 */
declare const deriveState: (clerkOperational: boolean, state: Resources, initialState: InitialState | undefined) => {
    userId: string | null | undefined;
    user: UserResource | null | undefined;
    sessionId: string | null | undefined;
    session: SignedInSessionResource | null | undefined;
    sessionStatus: "active" | "pending" | undefined;
    sessionClaims: JwtPayload | null | undefined;
    organization: OrganizationResource | null | undefined;
    orgId: string | null | undefined;
    orgRole: string | null | undefined;
    orgSlug: string | null | undefined;
    orgPermissions: _clerk_types.Autocomplete<_clerk_types.OrganizationSystemPermissionKey, string>[] | null | undefined;
    actor: _clerk_types.ActClaim | null | undefined;
    factorVerificationAge: [number, number] | null;
};

export { deriveState };
