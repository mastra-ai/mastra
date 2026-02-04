/**
 * SSO provider interface for EE authentication.
 * Enables single sign-on flows in Studio.
 */

/**
 * Configuration for rendering a login button.
 */
export interface SSOLoginConfig {
  /** Provider identifier (e.g., 'mastra', 'auth0', 'okta') */
  provider: string;
  /** Button text (e.g., 'Sign in with Mastra') */
  text: string;
  /** Optional icon URL */
  icon?: string;
}

/**
 * Result of an SSO callback exchange.
 */
export interface SSOCallbackResult<TUser> {
  /** Authenticated user */
  user: TUser;
  /** OAuth tokens */
  tokens: {
    /** Access token for API calls */
    accessToken: string;
    /** Refresh token for token renewal */
    refreshToken?: string;
    /** ID token with user claims */
    idToken?: string;
    /** Token expiration time */
    expiresAt?: Date;
  };
  /**
   * Session cookies to set in the response.
   * Providers using encrypted cookie sessions (like AuthKit) should populate this.
   */
  cookies?: string[];
}

/**
 * Provider interface for SSO authentication.
 *
 * Implement this interface to enable:
 * - SSO login button in Studio
 * - OAuth/OIDC redirect flows
 * - Token exchange on callback
 *
 * @example
 * ```typescript
 * class Auth0SSOProvider implements ISSOProvider {
 *   getLoginUrl(redirectUri: string, state: string) {
 *     const params = new URLSearchParams({
 *       client_id: this.clientId,
 *       redirect_uri: redirectUri,
 *       response_type: 'code',
 *       scope: 'openid profile email',
 *       state,
 *     });
 *     return `https://${this.domain}/authorize?${params}`;
 *   }
 *
 *   async handleCallback(code: string, state: string) {
 *     const tokens = await this.exchangeCode(code);
 *     const user = await this.getUserInfo(tokens.accessToken);
 *     return { user, tokens };
 *   }
 *
 *   getLoginButtonConfig() {
 *     return { provider: 'auth0', text: 'Sign in with Auth0' };
 *   }
 * }
 * ```
 */
export interface ISSOProvider<TUser = unknown> {
  /**
   * Get URL to redirect user to for login.
   *
   * @param redirectUri - Callback URL after authentication
   * @param state - CSRF protection state parameter
   * @returns Full URL to redirect user to
   */
  getLoginUrl(redirectUri: string, state: string): string;

  /**
   * Handle OAuth callback, exchange code for tokens and user.
   *
   * @param code - Authorization code from callback
   * @param state - State parameter for CSRF validation
   * @returns User and tokens
   */
  handleCallback(code: string, state: string): Promise<SSOCallbackResult<TUser>>;

  /**
   * Optional: Get logout URL if provider supports it.
   *
   * @param redirectUri - URL to redirect to after logout
   * @param request - Optional request to extract session info (e.g., for WorkOS sid)
   * @returns Logout URL, null if no active session, or undefined if not implemented
   */
  getLogoutUrl?(redirectUri: string, request?: Request): string | null | Promise<string | null>;

  /**
   * Get configuration for rendering login button in UI.
   *
   * @returns Login button configuration
   */
  getLoginButtonConfig(): SSOLoginConfig;
}
