import type { CheckAuthorizationFromSessionClaims, JwtPayload, ServerGetToken, SessionStatusClaim, SharedSignedInAuthObjectProperties } from '@clerk/types';
import type { CreateBackendApiOptions } from '../api';
import type { AuthenticateContext } from './authenticateContext';
type AuthObjectDebugData = Record<string, any>;
type AuthObjectDebug = () => AuthObjectDebugData;
/**
 * @internal
 */
export type SignedInAuthObjectOptions = CreateBackendApiOptions & {
    token: string;
};
/**
 * @internal
 */
export type SignedInAuthObject = SharedSignedInAuthObjectProperties & {
    getToken: ServerGetToken;
    has: CheckAuthorizationFromSessionClaims;
    debug: AuthObjectDebug;
};
/**
 * @internal
 */
export type SignedOutAuthObject = {
    sessionClaims: null;
    sessionId: null;
    sessionStatus: SessionStatusClaim | null;
    actor: null;
    userId: null;
    orgId: null;
    orgRole: null;
    orgSlug: null;
    orgPermissions: null;
    /**
     * Factor Verification Age
     * Each item represents the minutes that have passed since the last time a first or second factor were verified.
     * [fistFactorAge, secondFactorAge]
     */
    factorVerificationAge: null;
    getToken: ServerGetToken;
    has: CheckAuthorizationFromSessionClaims;
    debug: AuthObjectDebug;
};
/**
 * @internal
 */
export type AuthObject = SignedInAuthObject | SignedOutAuthObject;
/**
 * @internal
 */
export declare function signedInAuthObject(authenticateContext: AuthenticateContext, sessionToken: string, sessionClaims: JwtPayload): SignedInAuthObject;
/**
 * @internal
 */
export declare function signedOutAuthObject(debugData?: AuthObjectDebugData, initialSessionStatus?: SessionStatusClaim): SignedOutAuthObject;
/**
 * Auth objects moving through the server -> client boundary need to be serializable
 * as we need to ensure that they can be transferred via the network as pure strings.
 * Some frameworks like Remix or Next (/pages dir only) handle this serialization by simply
 * ignoring any non-serializable keys, however Nextjs /app directory is stricter and
 * throws an error if a non-serializable value is found.
 * @internal
 */
export declare const makeAuthObjectSerializable: <T extends Record<string, unknown>>(obj: T) => T;
export {};
//# sourceMappingURL=authObjects.d.ts.map