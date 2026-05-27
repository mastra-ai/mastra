/**
 * User provider interface for authentication.
 * Enables user awareness in Studio.
 */

/**
 * Base user type for authentication.
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email?: string;
  /** Display name */
  name?: string;
  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Provider interface for user awareness in Studio.
 *
 * Implement this interface to enable:
 * - Current user display in header
 * - User menu with profile info
 * - User context in API calls
 *
 * @example
 * ```typescript
 * class MyUserProvider implements IUserProvider {
 *   async getCurrentUser(request: Request) {
 *     const session = await this.getSession(request);
 *     if (!session) return null;
 *     return this.db.getUser(session.userId);
 *   }
 *
 *   async getUser(userId: string) {
 *     return this.db.getUser(userId);
 *   }
 * }
 * ```
 */
export interface IUserProvider<TUser extends User = User> {
  /**
   * Get current user from request (session cookie, token, etc.)
   *
   * @param request - Incoming HTTP request
   * @returns User object or null if not authenticated
   */
  getCurrentUser(request: Request): Promise<TUser | null>;

  /**
   * Get user by ID.
   *
   * @param userId - User identifier
   * @returns User object or null if not found
   */
  getUser(userId: string): Promise<TUser | null>;

  /**
   * Optional: Get URL to user's profile page.
   *
   * @param user - User object
   * @returns URL string to profile
   */
  getUserProfileUrl?(user: TUser): string;
}

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
  /** Optional description explaining the auth requirement and what credentials to use */
  description?: string;
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

  /**
   * Optional: Get cookies to set during login redirect.
   * Used by PKCE-enabled providers to store code verifier.
   *
   * @param redirectUri - OAuth callback URL
   * @param state - State parameter
   * @returns Array of Set-Cookie header values, or undefined
   */
  getLoginCookies?(redirectUri: string, state: string): string[] | undefined;
}

/**
 * Credentials provider interface for authentication.
 * Enables email/password sign-in and sign-up in Studio.
 */

/**
 * Result of a successful credentials operation.
 */
export interface CredentialsResult<TUser = User> {
  /** The authenticated user */
  user: TUser;
  /** Optional session token */
  token?: string;
  /** Optional cookies to set on the response (e.g., session cookies) */
  cookies?: string[];
}

/**
 * Provider interface for credentials-based authentication in Studio.
 *
 * Implement this interface to enable:
 * - Email/password sign-in
 * - Email/password sign-up
 * - Password reset (optional)
 *
 * @example
 * ```typescript
 * class MyCredentialsProvider implements ICredentialsProvider {
 *   async signIn(email: string, password: string, request: Request) {
 *     const user = await this.validateCredentials(email, password);
 *     if (!user) throw new Error('Invalid credentials');
 *     return { user };
 *   }
 *
 *   async signUp(email: string, password: string, name: string | undefined, request: Request) {
 *     const user = await this.createUser({ email, password, name });
 *     return { user };
 *   }
 * }
 * ```
 */
export interface ICredentialsProvider<TUser extends User = User> {
  /**
   * Sign in with email and password.
   *
   * @param email - User email
   * @param password - User password
   * @param request - Incoming HTTP request (for setting cookies, etc.)
   * @returns Result with user and optional token
   * @throws Error if credentials are invalid
   */
  signIn(email: string, password: string, request: Request): Promise<CredentialsResult<TUser>>;

  /**
   * Sign up with email and password.
   *
   * @param email - User email
   * @param password - User password
   * @param name - Optional display name
   * @param request - Incoming HTTP request (for setting cookies, etc.)
   * @returns Result with new user and optional token
   * @throws Error if sign up fails (e.g., email already exists)
   */
  signUp(
    email: string,
    password: string,
    name: string | undefined,
    request: Request,
  ): Promise<CredentialsResult<TUser>>;

  /**
   * Optional: Request password reset.
   *
   * @param email - User email
   * @returns Promise that resolves when reset email is sent
   */
  requestPasswordReset?(email: string): Promise<void>;

  /**
   * Optional: Reset password with token.
   *
   * @param token - Reset token from email
   * @param newPassword - New password
   * @returns Promise that resolves when password is reset
   */
  resetPassword?(token: string, newPassword: string): Promise<void>;

  /**
   * Optional: Check if sign-up is enabled.
   * Defaults to true if not implemented.
   *
   * Use this to disable public registration while still allowing sign-in.
   *
   * @returns Whether sign-up is enabled
   */
  isSignUpEnabled?(): boolean;
}

export * from './session';
export * from './provider';
export * from './types';
export * from './ee';
