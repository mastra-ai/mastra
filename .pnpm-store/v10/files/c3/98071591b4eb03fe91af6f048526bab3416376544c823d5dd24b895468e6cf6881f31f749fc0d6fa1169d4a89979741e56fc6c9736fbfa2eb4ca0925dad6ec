import { AuthenticationResponse } from './authentication-response.interface';
import { Impersonator } from './impersonator.interface';
import { User } from './user.interface';
export interface AuthenticateWithSessionCookieOptions {
    sessionData: string;
    cookiePassword?: string;
}
export interface AccessToken {
    sid: string;
    org_id?: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
    entitlements?: string[];
    feature_flags?: string[];
}
export type SessionCookieData = Pick<AuthenticationResponse, 'accessToken' | 'impersonator' | 'organizationId' | 'refreshToken' | 'user'>;
export declare enum AuthenticateWithSessionCookieFailureReason {
    INVALID_JWT = "invalid_jwt",
    INVALID_SESSION_COOKIE = "invalid_session_cookie",
    NO_SESSION_COOKIE_PROVIDED = "no_session_cookie_provided"
}
export type AuthenticateWithSessionCookieFailedResponse = {
    authenticated: false;
    reason: AuthenticateWithSessionCookieFailureReason;
};
export type AuthenticateWithSessionCookieSuccessResponse = {
    authenticated: true;
    sessionId: string;
    organizationId?: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
    entitlements?: string[];
    featureFlags?: string[];
    user: User;
    impersonator?: Impersonator;
    accessToken: string;
};
