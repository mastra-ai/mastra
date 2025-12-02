export interface OAuthResult {
    accessToken: string;
    accessTokenExpiresAt: Date;
    userInfo: {
        id: string;
        name: string;
        fullname: string;
        email?: string;
        emailVerified?: boolean;
        avatarUrl: string;
        websiteUrl?: string;
        isPro: boolean;
        canPay?: boolean;
        orgs: Array<{
            id: string;
            name: string;
            isEnterprise: boolean;
            canPay?: boolean;
            avatarUrl: string;
            roleInOrg?: string;
        }>;
    };
    /**
     * State passed to the OAuth provider in the original request to the OAuth provider.
     */
    state?: string;
    /**
     * Granted scope
     */
    scope: string;
}
/**
 * To call after the OAuth provider redirects back to the app.
 *
 * There is also a helper function {@link oauthHandleRedirectIfPresent}, which will call `oauthHandleRedirect` if the URL contains an oauth code
 * in the query parameters and return `false` otherwise.
 */
export declare function oauthHandleRedirect(opts?: {
    hubUrl?: string;
}): Promise<OAuthResult>;
/**
 * To call after the OAuth provider redirects back to the app.
 *
 * It returns false if the URL does not contain an oauth code in the query parameters, otherwise
 * it calls {@link oauthHandleRedirect}.
 *
 * Depending on your app, you may want to call {@link oauthHandleRedirect} directly instead.
 */
export declare function oauthHandleRedirectIfPresent(opts?: {
    hubUrl?: string;
}): Promise<OAuthResult | false>;
//# sourceMappingURL=oauth-handle-redirect.d.ts.map