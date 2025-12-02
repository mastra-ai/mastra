import { AuthenticateWithSessionCookieSuccessResponse } from './authenticate-with-session-cookie.interface';
import { AuthenticationResponse } from './authentication-response.interface';
export declare enum RefreshAndSealSessionDataFailureReason {
    /**
     * @deprecated To be removed in a future major version.
     */
    INVALID_SESSION_COOKE = "invalid_session_cookie",
    INVALID_SESSION_COOKIE = "invalid_session_cookie",
    NO_SESSION_COOKIE_PROVIDED = "no_session_cookie_provided",
    INVALID_GRANT = "invalid_grant",
    MFA_ENROLLMENT = "mfa_enrollment",
    SSO_REQUIRED = "sso_required",
    /**
     * @deprecated To be removed in a future major version.
     */
    ORGANIZATION_NOT_AUTHORIZED = "organization_not_authorized"
}
type RefreshSessionFailedResponse = {
    authenticated: false;
    reason: RefreshAndSealSessionDataFailureReason;
};
/**
 * @deprecated To be removed in a future major version along with `refreshAndSealSessionData`.
 */
type RefreshAndSealSessionDataSuccessResponse = {
    authenticated: true;
    session?: AuthenticationResponse;
    sealedSession?: string;
};
export type RefreshAndSealSessionDataResponse = RefreshSessionFailedResponse | RefreshAndSealSessionDataSuccessResponse;
type RefreshSessionSuccessResponse = Omit<AuthenticateWithSessionCookieSuccessResponse, 'accessToken'> & {
    authenticated: true;
    session?: AuthenticationResponse;
    sealedSession?: string;
};
export type RefreshSessionResponse = RefreshSessionFailedResponse | RefreshSessionSuccessResponse;
export {};
