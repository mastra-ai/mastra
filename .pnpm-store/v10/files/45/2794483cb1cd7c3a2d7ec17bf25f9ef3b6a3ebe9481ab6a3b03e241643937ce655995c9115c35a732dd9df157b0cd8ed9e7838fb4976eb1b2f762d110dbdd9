import { AuthenticateWithSessionCookieFailedResponse, AuthenticateWithSessionCookieSuccessResponse, RefreshSessionResponse } from './interfaces';
import { UserManagement } from './user-management';
type RefreshOptions = {
    cookiePassword?: string;
    organizationId?: string;
};
export declare class CookieSession {
    private jwks;
    private userManagement;
    private ironSessionProvider;
    private cookiePassword;
    private sessionData;
    constructor(userManagement: UserManagement, sessionData: string, cookiePassword: string);
    /**
     * Authenticates a user with a session cookie.
     *
     * @returns An object indicating whether the authentication was successful or not. If successful, it will include the user's session data.
     */
    authenticate(): Promise<AuthenticateWithSessionCookieSuccessResponse | AuthenticateWithSessionCookieFailedResponse>;
    /**
     * Refreshes the user's session.
     *
     * @param options - Optional options for refreshing the session.
     * @param options.cookiePassword - The password to use for the new session cookie.
     * @param options.organizationId - The organization ID to use for the new session cookie.
     * @returns An object indicating whether the refresh was successful or not. If successful, it will include the new sealed session data.
     */
    refresh(options?: RefreshOptions): Promise<RefreshSessionResponse>;
    /**
     * Gets the URL to redirect the user to for logging out.
     *
     * @returns The URL to redirect the user to for logging out.
     */
    getLogoutUrl({ returnTo, }?: {
        returnTo?: string;
    }): Promise<string>;
    private isValidJwt;
}
export {};
