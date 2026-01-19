/**
 * SSO (Single Sign-On) provider interface for OAuth/OIDC authentication flows.
 * @module ee/interfaces/sso
 */

/**
 * Configuration for rendering SSO login buttons in the UI.
 */
export interface SSOLoginConfig {
  /** Provider identifier (e.g., 'google', 'workos', 'okta') */
  provider: string;
  /** Display text for the login button (e.g., 'Sign in with Google') */
  text: string;
  /** Optional icon URL or identifier for the provider logo */
  icon?: string;
  /** The authorization URL to redirect to when the button is clicked */
  url: string;
}

/**
 * Tokens returned from successful SSO callback.
 */
export interface SSOTokens {
  /** OAuth access token for API calls */
  accessToken: string;
  /** Optional refresh token for extending session */
  refreshToken?: string;
  /** Optional OIDC ID token containing user claims */
  idToken?: string;
  /** Token expiration timestamp (Unix milliseconds) */
  expiresAt?: number;
}

/**
 * Result returned from successful SSO callback handling.
 * @template TUser - The user type extending EEUser
 */
export interface SSOCallbackResult<TUser> {
  /** Authenticated user information */
  user: TUser;
  /** OAuth/OIDC tokens */
  tokens: SSOTokens;
  /** Optional cookies to set in the response (e.g., session cookies) */
  cookies?: Record<string, string>;
}

/**
 * SSO provider interface for handling OAuth 2.0 and OIDC authentication flows.
 *
 * Supports standard OAuth redirect flows:
 * 1. Generate authorization URL with state parameter
 * 2. Redirect user to provider login
 * 3. Handle callback with authorization code
 * 4. Exchange code for tokens and user info
 * 5. Optionally support logout redirect
 *
 * @template TUser - The user type extending EEUser
 *
 * @example
 * ```typescript
 * class GoogleSSOProvider implements ISSOProvider<MyUser> {
 *   getLoginUrl(redirectUri: string, state?: string) {
 *     return `https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=${redirectUri}&state=${state}`;
 *   }
 *
 *   async handleCallback(code: string, state?: string) {
 *     const tokens = await exchangeCodeForTokens(code);
 *     const user = await fetchUserFromGoogle(tokens.accessToken);
 *     return { user, tokens };
 *   }
 *
 *   getLoginButtonConfig() {
 *     return {
 *       provider: 'google',
 *       text: 'Sign in with Google',
 *       icon: 'https://google.com/favicon.ico',
 *       url: this.getLoginUrl('/api/auth/callback')
 *     };
 *   }
 * }
 * ```
 */
export interface ISSOProvider<TUser> {
  /**
   * Generate the OAuth authorization URL for initiating SSO login.
   *
   * @param redirectUri - The callback URL where the provider will redirect after authentication
   * @param state - Optional state parameter for CSRF protection and context preservation
   * @returns The full authorization URL to redirect the user to
   *
   * @example
   * ```typescript
   * const loginUrl = provider.getLoginUrl(
   *   'https://myapp.com/api/auth/callback',
   *   'csrf-token-123'
   * );
   * // Returns: https://provider.com/oauth/authorize?client_id=...&redirect_uri=...&state=csrf-token-123
   * ```
   */
  getLoginUrl(redirectUri: string, state?: string): string;

  /**
   * Handle the OAuth callback after user authenticates with the provider.
   * Exchanges the authorization code for tokens and retrieves user information.
   *
   * @param code - Authorization code from the OAuth callback
   * @param state - State parameter to validate against CSRF attacks
   * @returns User information and authentication tokens
   * @throws {Error} If code exchange fails or state validation fails
   *
   * @example
   * ```typescript
   * const result = await provider.handleCallback(
   *   'authorization_code_xyz',
   *   'csrf-token-123'
   * );
   * // result.user = { id: '123', email: 'user@example.com', ... }
   * // result.tokens = { accessToken: '...', refreshToken: '...', expiresAt: 1234567890 }
   * ```
   */
  handleCallback(code: string, state?: string): Promise<SSOCallbackResult<TUser>>;

  /**
   * Optional method to get the logout URL for the SSO provider.
   * Not all providers support federated logout.
   *
   * @param redirectUri - Optional URL to redirect to after logout
   * @returns The logout URL, or undefined if provider doesn't support logout
   *
   * @example
   * ```typescript
   * const logoutUrl = provider.getLogoutUrl?.('https://myapp.com/');
   * if (logoutUrl) {
   *   // Redirect to provider logout to clear provider session
   * }
   * ```
   */
  getLogoutUrl?(redirectUri?: string): string | undefined;

  /**
   * Get the configuration for rendering the SSO login button in the UI.
   * Used by the frontend to display provider-specific branding.
   *
   * @returns Configuration object with provider branding and authorization URL
   *
   * @example
   * ```typescript
   * const config = provider.getLoginButtonConfig();
   * // Render: <button onClick={() => window.location.href = config.url}>
   * //           <img src={config.icon} /> {config.text}
   * //         </button>
   * ```
   */
  getLoginButtonConfig(): SSOLoginConfig;
}
