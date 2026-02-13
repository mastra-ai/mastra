/**
 * MastraCloudAuthProvider - Server integration for Mastra Cloud authentication.
 *
 * Extends MastraAuthProvider and implements ISSOProvider, ISessionProvider,
 * and IUserProvider interfaces to integrate with Mastra server middleware.
 *
 * @packageDocumentation
 */

import type {
  IUserProvider,
  ISSOProvider,
  ISessionProvider,
  EEUser,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '@mastra/core/auth';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';
import type { HonoRequest } from 'hono';

import { MastraCloudAuth } from './client';
import { parseSessionCookie } from './session/cookie';
import type { CloudUser } from './types';

/**
 * Configuration options for MastraCloudAuthProvider.
 */
export interface MastraCloudAuthProviderOptions extends MastraAuthProviderOptions<CloudUser> {
  /** Mastra Cloud project ID */
  projectId: string;
  /** Base URL of Mastra Cloud API (e.g., https://cloud.mastra.ai) */
  cloudBaseUrl: string;
  /** OAuth callback URL for your application */
  callbackUrl: string;
  /** Whether running in production (adds Secure flag to cookies) */
  isProduction?: boolean;
}

/**
 * Mastra Cloud authentication provider for server integration.
 *
 * Wraps the MastraCloudAuth client and implements the required interfaces
 * for Mastra server middleware. Provides SSO login, session management,
 * and user awareness.
 *
 * @example
 * ```typescript
 * import { MastraCloudAuthProvider } from '@mastra/auth-cloud';
 *
 * const auth = new MastraCloudAuthProvider({
 *   cloudBaseUrl: 'https://cloud.mastra.ai',
 *   callbackUrl: 'https://myapp.com/auth/callback',
 * });
 *
 * const mastra = new Mastra({
 *   auth,
 *   // ...
 * });
 * ```
 */
export class MastraCloudAuthProvider
  extends MastraAuthProvider<CloudUser>
  implements IUserProvider<EEUser>, ISSOProvider<EEUser>, ISessionProvider<Session>
{
  private client: MastraCloudAuth;

  /** Marker for EE license exemption - MastraCloudAuth is exempt */
  readonly isMastraCloudAuth = true;

  /**
   * Cookie header for handleCallback PKCE validation.
   * Set via setCallbackCookieHeader() before handleCallback() is called.
   * @internal
   */
  private _lastCallbackCookieHeader: string | null = null;

  constructor(options: MastraCloudAuthProviderOptions) {
    super({ name: options?.name ?? 'cloud' });

    this.client = new MastraCloudAuth({
      projectId: options.projectId,
      cloudBaseUrl: options.cloudBaseUrl,
      callbackUrl: options.callbackUrl,
      isProduction: options.isProduction,
    });

    this.registerOptions(options);
  }

  /**
   * Set cookie header for handleCallback PKCE validation.
   * Must be called before handleCallback() to pass cookie header.
   *
   * @param cookieHeader - Cookie header from original request
   */
  setCallbackCookieHeader(cookieHeader: string | null): void {
    this._lastCallbackCookieHeader = cookieHeader;
  }

  // ============================================================================
  // MastraAuthProvider Implementation
  // ============================================================================

  /**
   * Authenticate a bearer token or session cookie.
   *
   * Checks session cookie first, falls back to bearer token for API clients.
   *
   * @param token - Bearer token (from Authorization header)
   * @param request - Hono or raw Request
   * @returns Authenticated user with role, or null if invalid
   */
  async authenticateToken(token: string, request: HonoRequest | Request): Promise<CloudUser | null> {
    try {
      // Get raw Request for cookie access
      const rawRequest = 'raw' in request ? request.raw : request;
      const cookieHeader = rawRequest.headers.get('cookie');

      // Parse session token from cookie
      const sessionToken = parseSessionCookie(cookieHeader);

      if (sessionToken) {
        // Verify session token with Cloud API
        const { user, role } = await this.client.verifyToken(sessionToken);
        return { ...user, role };
      }

      // Fall back to bearer token if no cookie
      if (token) {
        const { user, role } = await this.client.verifyToken(token);
        return { ...user, role };
      }

      return null;
    } catch {
      // Per Phase 10 decision: return null on any error
      return null;
    }
  }

  /**
   * Authorize a user for access.
   *
   * Simple validation - detailed permission checking happens in server
   * middleware via checkRoutePermission(), not authorizeUser().
   *
   * @param user - Authenticated user
   * @returns True if user has valid id
   */
  authorizeUser(user: CloudUser): boolean {
    return !!user?.id;
  }

  // ============================================================================
  // ISSOProvider Implementation
  // ============================================================================

  /**
   * Cached login result for getLoginCookies() to retrieve cookies.
   * @internal
   */
  private _lastLoginResult: { url: string; cookies: string[] } | null = null;

  /**
   * Get URL to redirect user to for SSO login.
   *
   * @param redirectUri - Callback URL after authentication
   * @param state - State parameter (format: uuid|encodedPostLoginRedirect)
   * @returns Full authorization URL
   */
  getLoginUrl(redirectUri: string, state: string): string {
    // Extract postLoginRedirect from state (format: uuid|encodedPostLoginRedirect)
    let postLoginRedirect = '/';
    if (state && state.includes('|')) {
      const parts = state.split('|', 2);
      const encodedRedirect = parts[1];
      if (encodedRedirect) {
        try {
          postLoginRedirect = decodeURIComponent(encodedRedirect);
        } catch {
          postLoginRedirect = '/';
        }
      }
    }

    // Parse origin from redirectUri for PKCE cookie origin validation
    const redirectUrl = new URL(redirectUri);
    const origin = redirectUrl.origin;

    // Generate login URL with PKCE
    const result = this.client.getLoginUrl({
      returnTo: postLoginRedirect,
      requestOrigin: origin,
    });

    // Cache result for getLoginCookies() to retrieve
    this._lastLoginResult = result;

    return result.url;
  }

  /**
   * Get cookies to set during login redirect (PKCE verifier).
   * Must be called after getLoginUrl() in same request.
   *
   * @returns Array of Set-Cookie header values
   */
  getLoginCookies(): string[] | undefined {
    const cookies = this._lastLoginResult?.cookies;
    this._lastLoginResult = null; // Clear after retrieval
    return cookies;
  }

  /**
   * Handle OAuth callback, exchange code for tokens and user.
   *
   * @param code - Authorization code from callback
   * @param state - State parameter for CSRF validation
   * @returns User, tokens, and session cookies
   */
  async handleCallback(code: string, state: string): Promise<SSOCallbackResult<EEUser>> {
    // Get cookie header for PKCE validation, then clear
    const cookieHeader = this._lastCallbackCookieHeader;
    this._lastCallbackCookieHeader = null;

    // Exchange code for tokens and get user (includes /auth/verify call)
    const result = await this.client.handleCallback({
      code,
      state,
      cookieHeader,
    });

    // Build session cookie
    const sessionCookie = this.client.setSessionCookie(result.accessToken);

    return {
      user: result.user, // Already has role from handleCallback
      tokens: {
        accessToken: result.accessToken,
      },
      cookies: [...result.cookies, sessionCookie],
    };
  }

  /**
   * Get configuration for rendering login button in UI.
   *
   * @returns Login button configuration
   */
  getLoginButtonConfig(): SSOLoginConfig {
    return {
      provider: 'mastra',
      text: 'Sign in with Mastra Cloud',
    };
  }

  /**
   * Get logout URL for client-side redirect.
   * Requires the request to extract the session token for id_token_hint.
   *
   * @param redirectUri - URL to redirect to after logout
   * @param request - Request to extract session token from
   * @returns Logout URL with redirect and token parameters, or null if no session
   */
  getLogoutUrl(redirectUri: string, request?: Request): string | null {
    // Get session token from request cookies for id_token_hint
    const sessionToken = request ? this.getSessionIdFromRequest(request) : null;
    if (!sessionToken) {
      return null; // No active session, nothing to logout
    }
    return this.client.getLogoutUrl(redirectUri, sessionToken);
  }

  // ============================================================================
  // ISessionProvider Implementation
  // ============================================================================

  /**
   * Create a new session for a user.
   *
   * For Cloud auth, sessions are created via handleCallback.
   * This method builds a Session object for interface compatibility.
   *
   * @param userId - User to create session for
   * @param metadata - Optional metadata (accessToken can be passed here)
   * @returns Session object
   */
  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      id: (metadata?.accessToken as string) ?? crypto.randomUUID(),
      userId,
      createdAt: now,
      expiresAt,
      metadata,
    };
  }

  /**
   * Validate a session and return it if valid.
   *
   * @param sessionId - Session token to validate
   * @returns Session object or null if invalid/expired
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = await this.client.validateSession(sessionId);
    if (!session) return null;

    return {
      id: sessionId,
      userId: session.userId,
      createdAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt),
    };
  }

  /**
   * Destroy a session (logout).
   *
   * @param sessionId - Session token to destroy
   */
  async destroySession(sessionId: string): Promise<void> {
    await this.client.destroySession(sessionId);
  }

  /**
   * Refresh a session, extending its expiry.
   * Cloud handles refresh internally, so just validate.
   *
   * @param sessionId - Session token to refresh
   * @returns Session object or null if invalid
   */
  async refreshSession(sessionId: string): Promise<Session | null> {
    return this.validateSession(sessionId);
  }

  /**
   * Extract session ID from an incoming request.
   *
   * @param request - Incoming HTTP request
   * @returns Session token or null if not present
   */
  getSessionIdFromRequest(request: Request): string | null {
    return parseSessionCookie(request.headers.get('cookie'));
  }

  /**
   * Create response headers to set session cookie.
   *
   * @param session - Session to encode (id is the access token)
   * @returns Headers object with Set-Cookie
   */
  getSessionHeaders(session: Session): Record<string, string> {
    return { 'Set-Cookie': this.client.setSessionCookie(session.id) };
  }

  /**
   * Create response headers to clear session (for logout).
   *
   * @returns Headers object to clear session cookie
   */
  getClearSessionHeaders(): Record<string, string> {
    return { 'Set-Cookie': this.client.clearSessionCookie() };
  }

  // ============================================================================
  // IUserProvider Implementation
  // ============================================================================

  /**
   * Get current user from request (session cookie).
   *
   * @param request - Incoming HTTP request
   * @returns User with role or null if not authenticated
   */
  async getCurrentUser(request: Request): Promise<CloudUser | null> {
    const sessionToken = this.getSessionIdFromRequest(request);
    if (!sessionToken) return null;

    try {
      const { user, role } = await this.client.verifyToken(sessionToken);
      return { ...user, role };
    } catch {
      return null;
    }
  }

  /**
   * Get user by ID.
   * Cloud API doesn't have a /users/:id endpoint.
   *
   * @returns Always null (not supported)
   */
  async getUser(_userId: string): Promise<CloudUser | null> {
    return null;
  }
}
