/**
 * MastraAuthWorkos - WorkOS authentication provider for Mastra.
 *
 * Uses @workos/authkit-session for session management with encrypted
 * cookie-based sessions that persist across server restarts.
 */

import { verifyJwks } from '@mastra/auth';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';
import type {
  IUserProvider,
  ISSOProvider,
  ISessionProvider,
  EEUser,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '@mastra/core/ee';
import { WorkOS } from '@workos-inc/node';
import {
  AuthService,
  CookieSessionStorage,
  sessionEncryption,
  type AuthKitConfig,
  type Session as WorkOSSession,
  type AuthResult,
} from '@workos/authkit-session';
import type { HonoRequest } from 'hono';

import type { WorkOSUser, MastraAuthWorkosOptions, WorkOSSessionConfig } from './types.js';
import { mapWorkOSUserToEEUser } from './types.js';
import { WebSessionStorage } from './session-storage.js';

/**
 * Default cookie password for development (MUST be overridden in production).
 * Generated once per process to ensure consistency during dev.
 */
const DEV_COOKIE_PASSWORD = crypto.randomUUID() + crypto.randomUUID(); // 72 chars

/**
 * Mastra authentication provider for WorkOS.
 *
 * Uses WorkOS AuthKit with encrypted cookie-based sessions.
 * Sessions are stored in cookies, so they persist across server restarts.
 *
 * @example Basic usage with SSO
 * ```typescript
 * import { MastraAuthWorkos } from '@mastra/auth-workos';
 *
 * const auth = new MastraAuthWorkos({
 *   apiKey: process.env.WORKOS_API_KEY,
 *   clientId: process.env.WORKOS_CLIENT_ID,
 *   redirectUri: 'https://myapp.com/auth/callback',
 *   cookiePassword: process.env.WORKOS_COOKIE_PASSWORD, // min 32 chars
 * });
 * ```
 */
export class MastraAuthWorkos
  extends MastraAuthProvider<WorkOSUser>
  implements IUserProvider<EEUser>, ISSOProvider<EEUser>, ISessionProvider<Session>
{
  protected workos: WorkOS;
  protected clientId: string;
  protected redirectUri: string;
  protected ssoConfig: MastraAuthWorkosOptions['sso'];
  protected authService: AuthService<Request, Response>;
  protected config: AuthKitConfig;

  /** Unique identifier for this instance (for debugging) */
  private instanceId = crypto.randomUUID().slice(0, 8);

  constructor(options?: MastraAuthWorkosOptions) {
    super({ name: options?.name ?? 'workos' });

    console.log(`[WorkOS:${this.instanceId}] Constructor called - new instance created`);

    const apiKey = options?.apiKey ?? process.env.WORKOS_API_KEY;
    const clientId = options?.clientId ?? process.env.WORKOS_CLIENT_ID;
    const redirectUri = options?.redirectUri ?? process.env.WORKOS_REDIRECT_URI;
    const cookiePassword =
      options?.session?.cookiePassword ?? process.env.WORKOS_COOKIE_PASSWORD ?? DEV_COOKIE_PASSWORD;

    if (!apiKey || !clientId) {
      throw new Error(
        'WorkOS API key and client ID are required. ' +
          'Provide them in the options or set WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.',
      );
    }

    if (!redirectUri) {
      throw new Error(
        'WorkOS redirect URI is required. ' +
          'Provide it in the options or set WORKOS_REDIRECT_URI environment variable.',
      );
    }

    if (cookiePassword.length < 32) {
      throw new Error(
        'Cookie password must be at least 32 characters. ' +
          'Set WORKOS_COOKIE_PASSWORD environment variable or provide session.cookiePassword option.',
      );
    }

    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.ssoConfig = options?.sso;

    // Create WorkOS client
    this.workos = new WorkOS(apiKey, { clientId });

    // Create AuthKit config
    this.config = {
      clientId,
      apiKey,
      redirectUri,
      cookiePassword,
      cookieName: options?.session?.cookieName ?? 'wos_session',
      cookieMaxAge: options?.session?.maxAge ?? 60 * 60 * 24 * 400, // 400 days
      cookieSameSite: options?.session?.sameSite?.toLowerCase() as 'lax' | 'strict' | 'none' | undefined,
      cookieDomain: undefined,
      apiHttps: true,
    };

    // Create session storage and auth service
    const storage = new WebSessionStorage(this.config);
    this.authService = new AuthService(this.config, storage, this.workos, sessionEncryption);

    this.registerOptions(options as MastraAuthProviderOptions<WorkOSUser>);

    if (cookiePassword === DEV_COOKIE_PASSWORD) {
      console.warn(
        '[WorkOS] Using auto-generated cookie password for development. ' +
          'Sessions will not persist across server restarts. ' +
          'Set WORKOS_COOKIE_PASSWORD for persistent sessions.',
      );
    }
  }

  // ============================================================================
  // MastraAuthProvider Implementation
  // ============================================================================

  /**
   * Authenticate a bearer token or session cookie.
   *
   * Uses AuthKit's withAuth() for cookie-based sessions, falls back to
   * JWT verification for bearer tokens.
   */
  async authenticateToken(token: string, request: HonoRequest): Promise<WorkOSUser | null> {
    console.log(`[WorkOS:${this.instanceId}] authenticateToken called`);

    try {
      // First try session-based auth via AuthKit
      const { auth } = await this.authService.withAuth(request.raw);

      if (auth.user) {
        console.log(`[WorkOS:${this.instanceId}] authenticateToken: session valid for user ${auth.user.id}`);
        return {
          ...mapWorkOSUserToEEUser(auth.user),
          workosId: auth.user.id,
          organizationId: auth.organizationId,
          // Note: memberships not available from session, fetch if needed
        };
      }

      // Fall back to JWT verification for bearer tokens
      if (token) {
        const jwksUri = this.workos.userManagement.getJwksUrl(this.clientId);
        const payload = await verifyJwks(token, jwksUri);

        if (payload?.sub) {
          console.log(`[WorkOS:${this.instanceId}] authenticateToken: JWT valid for user ${payload.sub}`);
          const user = await this.workos.userManagement.getUser(payload.sub);
          const memberships = await this.workos.userManagement.listOrganizationMemberships({
            userId: user.id,
          });

          return {
            ...mapWorkOSUserToEEUser(user),
            workosId: user.id,
            organizationId: memberships.data[0]?.organizationId,
            memberships: memberships.data,
          };
        }
      }

      return null;
    } catch (error) {
      console.log(`[WorkOS:${this.instanceId}] authenticateToken failed:`, error);
      return null;
    }
  }

  /**
   * Authorize a user for access.
   */
  async authorizeUser(user: WorkOSUser): Promise<boolean> {
    return !!user?.id && !!user?.workosId;
  }

  // ============================================================================
  // IUserProvider Implementation
  // ============================================================================

  /**
   * Get the current user from the request using AuthKit session.
   */
  async getCurrentUser(request: Request): Promise<EEUser | null> {
    try {
      const { auth, refreshedSessionData } = await this.authService.withAuth(request);

      if (!auth.user) {
        return null;
      }

      // Get organizationId from JWT claims, or fall back to fetching from memberships
      let organizationId = auth.organizationId;
      if (!organizationId) {
        try {
          const memberships = await this.workos.userManagement.listOrganizationMemberships({
            userId: auth.user.id,
          });
          organizationId = memberships.data[0]?.organizationId;
          console.log(`[WorkOS:${this.instanceId}] getCurrentUser: fetched orgId from memberships: ${organizationId}`);
        } catch {
          // Ignore membership fetch errors
        }
      } else {
        console.log(`[WorkOS:${this.instanceId}] getCurrentUser: orgId from JWT: ${organizationId}`);
      }

      // Build user with session data
      const user: WorkOSUser = {
        ...mapWorkOSUserToEEUser(auth.user),
        workosId: auth.user.id,
        organizationId,
      };

      // If session was refreshed, we should save it
      // Note: This is a side effect, but necessary to persist refreshed tokens
      if (refreshedSessionData) {
        console.log(`[WorkOS:${this.instanceId}] Session refreshed for user ${auth.user.id}`);
        // The caller should handle saving the refreshed session via response headers
        // We attach it to the user object for the handler to access
        (user as any)._refreshedSessionData = refreshedSessionData;
      }

      return user;
    } catch {
      return null;
    }
  }

  /**
   * Get a user by their ID.
   */
  async getUser(userId: string): Promise<WorkOSUser | null> {
    try {
      const user = await this.workos.userManagement.getUser(userId);
      return {
        ...mapWorkOSUserToEEUser(user),
        workosId: user.id,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the URL to the user's profile page.
   */
  getUserProfileUrl(user: EEUser): string {
    return `/profile/${user.id}`;
  }

  // ============================================================================
  // ISSOProvider Implementation
  // ============================================================================

  /**
   * Get the URL to redirect users to for SSO login.
   */
  getLoginUrl(redirectUri: string, state: string): string {
    const baseOptions = {
      clientId: this.clientId,
      redirectUri: redirectUri || this.redirectUri,
      state,
    };

    if (this.ssoConfig?.connection) {
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        connectionId: this.ssoConfig.connection,
      });
    } else if (this.ssoConfig?.provider) {
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        provider: this.ssoConfig.provider,
      });
    } else if (this.ssoConfig?.defaultOrganization) {
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        organizationId: this.ssoConfig.defaultOrganization,
      });
    }

    return this.workos.userManagement.getAuthorizationUrl({
      ...baseOptions,
      provider: 'authkit',
    });
  }

  /**
   * Handle the OAuth callback from WorkOS.
   *
   * Uses AuthKit's handleCallback for proper session creation.
   */
  async handleCallback(code: string, _state: string): Promise<SSOCallbackResult<EEUser>> {
    // Use AuthService's handleCallback for session creation
    const result = await this.authService.handleCallback(
      new Request('http://localhost'), // Dummy request, not used
      new Response(), // Dummy response to get headers
      { code, state: _state },
    );

    const user: WorkOSUser = {
      ...mapWorkOSUserToEEUser(result.authResponse.user),
      workosId: result.authResponse.user.id,
      organizationId: result.authResponse.organizationId,
    };

    // Extract session cookie from headers
    const sessionCookie = result.headers?.['Set-Cookie'];
    const cookies = sessionCookie ? (Array.isArray(sessionCookie) ? sessionCookie : [sessionCookie]) : undefined;

    return {
      user,
      tokens: {
        accessToken: result.authResponse.accessToken,
        refreshToken: result.authResponse.refreshToken,
      },
      cookies,
    };
  }

  /**
   * Get the URL to redirect users to for logout.
   */
  getLogoutUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
    });
    return `https://api.workos.com/user_management/logout?${params.toString()}`;
  }

  /**
   * Get the configuration for rendering the login button.
   */
  getLoginButtonConfig(): SSOLoginConfig {
    let text = 'Sign in with SSO';
    if (this.ssoConfig?.provider) {
      const providerNames: Record<string, string> = {
        GoogleOAuth: 'Google',
        MicrosoftOAuth: 'Microsoft',
        GitHubOAuth: 'GitHub',
        AppleOAuth: 'Apple',
      };
      text = `Sign in with ${providerNames[this.ssoConfig.provider] || 'SSO'}`;
    }

    return {
      provider: 'workos',
      text,
    };
  }

  // ============================================================================
  // ISessionProvider Implementation
  // ============================================================================

  /**
   * Create a new session for a user.
   *
   * Note: With AuthKit, sessions are created via handleCallback.
   * This method is kept for interface compatibility.
   */
  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.cookieMaxAge * 1000);

    return {
      id: sessionId,
      userId,
      createdAt: now,
      expiresAt,
      metadata,
    };
  }

  /**
   * Validate a session.
   *
   * With AuthKit, sessions are validated via withAuth().
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    // AuthKit handles validation internally via withAuth()
    // This method is kept for interface compatibility
    return null;
  }

  /**
   * Destroy a session.
   */
  async destroySession(sessionId: string): Promise<void> {
    // AuthKit handles session clearing via signOut()
    // The actual cookie clearing happens in the response headers
  }

  /**
   * Refresh a session.
   */
  async refreshSession(sessionId: string): Promise<Session | null> {
    // AuthKit handles refresh automatically in withAuth()
    return null;
  }

  /**
   * Extract session ID from a request.
   */
  getSessionIdFromRequest(request: Request): string | null {
    // With AuthKit, we don't expose the session ID directly
    // The session is managed via encrypted cookies
    return null;
  }

  /**
   * Get response headers to set the session cookie.
   */
  getSessionHeaders(session: Session): Record<string, string> {
    // AuthKit handles cookie setting via saveSession()
    // Check for _sessionCookie from handleCallback
    const sessionCookie = (session as any)._sessionCookie;
    if (sessionCookie) {
      return { 'Set-Cookie': Array.isArray(sessionCookie) ? sessionCookie[0] : sessionCookie };
    }
    return {};
  }

  /**
   * Get response headers to clear the session cookie.
   */
  getClearSessionHeaders(): Record<string, string> {
    const cookieParts = [`${this.config.cookieName}=`, 'Path=/', 'Max-Age=0', 'HttpOnly'];
    return { 'Set-Cookie': cookieParts.join('; ') };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the underlying WorkOS client.
   */
  getWorkOS(): WorkOS {
    return this.workos;
  }

  /**
   * Get the AuthKit AuthService.
   */
  getAuthService(): AuthService<Request, Response> {
    return this.authService;
  }

  /**
   * Get the configured client ID.
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Get the configured redirect URI.
   */
  getRedirectUri(): string {
    return this.redirectUri;
  }
}
