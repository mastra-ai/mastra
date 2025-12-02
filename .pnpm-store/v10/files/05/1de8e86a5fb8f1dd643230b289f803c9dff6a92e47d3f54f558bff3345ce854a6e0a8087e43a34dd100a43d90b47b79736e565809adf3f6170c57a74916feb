/**
 * Use "Sign in with Hub" to authenticate a user, and get oauth user info / access token.
 *
 * Returns an url to redirect to. After the user is redirected back to your app, call `oauthHandleRedirect` to get the oauth user info / access token.
 *
 * When called from inside a static Space with OAuth enabled, it will load the config from the space, otherwise you need to at least specify
 * the client ID of your OAuth App.
 *
 * @example
 * ```ts
 * import { oauthLoginUrl, oauthHandleRedirectIfPresent } from "@huggingface/hub";
 *
 * const oauthResult = await oauthHandleRedirectIfPresent();
 *
 * if (!oauthResult) {
 *   // If the user is not logged in, redirect to the login page
 *   window.location.href = await oauthLoginUrl();
 * }
 *
 * // You can use oauthResult.accessToken, oauthResult.accessTokenExpiresAt and oauthResult.userInfo
 * console.log(oauthResult);
 * ```
 *
 * (Theoretically, this function could be used to authenticate a user for any OAuth provider supporting PKCE and OpenID Connect by changing `hubUrl`,
 * but it is currently only tested with the Hugging Face Hub.)
 */
export declare function oauthLoginUrl(opts?: {
    /**
     * OAuth client ID.
     *
     * For static Spaces, you can omit this and it will be loaded from the Space config, as long as `hf_oauth: true` is present in the README.md's metadata.
     * For other Spaces, it is available to the backend in the OAUTH_CLIENT_ID environment variable, as long as `hf_oauth: true` is present in the README.md's metadata.
     *
     * You can also create a Developer Application at https://huggingface.co/settings/connected-applications and use its client ID.
     */
    clientId?: string;
    hubUrl?: string;
    /**
     * OAuth scope, a list of space separate scopes.
     *
     * For static Spaces, you can omit this and it will be loaded from the Space config, as long as `hf_oauth: true` is present in the README.md's metadata.
     * For other Spaces, it is available to the backend in the OAUTH_SCOPES environment variable, as long as `hf_oauth: true` is present in the README.md's metadata.
     *
     * Defaults to "openid profile".
     *
     * You can also create a Developer Application at https://huggingface.co/settings/connected-applications and use its scopes.
     *
     * See https://huggingface.co/docs/hub/oauth for a list of available scopes.
     */
    scopes?: string;
    /**
     * Redirect URI, defaults to the current URL.
     *
     * For Spaces, any URL within the Space is allowed.
     *
     * For Developer Applications, you can add any URL you want to the list of allowed redirect URIs at https://huggingface.co/settings/connected-applications.
     */
    redirectUrl?: string;
    /**
     * State to pass to the OAuth provider, which will be returned in the call to `oauthLogin` after the redirect.
     */
    state?: string;
}): Promise<string>;
//# sourceMappingURL=oauth-login-url.d.ts.map