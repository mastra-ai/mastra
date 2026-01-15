/**
 * MastraAuthWorkos - WorkOS authentication provider for Mastra.
 *
 * This class provides a complete authentication solution using WorkOS,
 * implementing SSO, session management, and user provider capabilities
 * for the Mastra framework's Enterprise Edition features.
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
import type { HonoRequest } from 'hono';

import type { WorkOSUser, MastraAuthWorkosOptions, WorkOSSessionConfig } from './types.js';
import { mapWorkOSUserToEEUser } from './types.js';

/**
 * Default session configuration values.
 */
const DEFAULT_SESSION_CONFIG: Required<WorkOSSessionConfig> = {
  cookieName: 'mastra_workos_session',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  sameSite: 'Lax',
};

/**
 * Global session store shared across all MastraAuthWorkos instances.
 * This ensures sessions persist even if multiple instances are created
 * (e.g., during hot reload or dev mode).
 */
const globalSessionStore = new Map<string, WorkOSSession>();
console.log('[WorkOS] Global session store initialized');

/**
 * Internal session storage type for managing session state.
 * WorkOS uses access tokens rather than traditional sessions,
 * so we create a session wrapper around the token data.
 */
interface WorkOSSession extends Session {
  /** WorkOS access token */
  accessToken: string;
  /** WorkOS refresh token */
  refreshToken?: string;
  /** Token expiration timestamp */
  tokenExpiresAt?: Date;
}

/**
 * Mastra authentication provider for WorkOS.
 *
 * WorkOS provides enterprise-ready authentication with support for SSO,
 * Directory Sync, and Admin Portal. This provider integrates WorkOS
 * User Management for authentication and implements the Mastra EE
 * interfaces for SSO, session management, and user awareness.
 *
 * @example Basic usage with SSO
 * ```typescript
 * import { MastraAuthWorkos } from '@mastra/auth-workos';
 *
 * const auth = new MastraAuthWorkos({
 *   apiKey: process.env.WORKOS_API_KEY,
 *   clientId: process.env.WORKOS_CLIENT_ID,
 *   redirectUri: 'https://myapp.com/auth/callback',
 *   sso: {
 *     provider: 'GoogleOAuth',
 *   },
 * });
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth,
 *   },
 * });
 * ```
 *
 * @example SSO with organization selector
 * ```typescript
 * const auth = new MastraAuthWorkos({
 *   sso: {
 *     // User will be prompted to select their organization
 *     // and authenticate via the configured identity provider
 *   },
 * });
 * ```
 *
 * @example Direct connection SSO
 * ```typescript
 * const auth = new MastraAuthWorkos({
 *   sso: {
 *     connection: 'conn_123', // Direct to specific IdP
 *   },
 * });
 * ```
 *
 * @see https://workos.com/docs for WorkOS documentation
 */
export class MastraAuthWorkos
  extends MastraAuthProvider<WorkOSUser>
  implements IUserProvider<EEUser>, ISSOProvider<EEUser>, ISessionProvider<WorkOSSession>
{
  protected workos: WorkOS;
  protected clientId: string;
  protected redirectUri: string;
  protected ssoConfig: MastraAuthWorkosOptions['sso'];
  protected sessionConfig: Required<WorkOSSessionConfig>;

  /**
   * Reference to the global session store.
   * Using a module-level singleton ensures sessions persist across
   * multiple class instances (e.g., during hot reload).
   */
  private get sessions(): Map<string, WorkOSSession> {
    return globalSessionStore;
  }

  /** Unique identifier for this instance (for debugging) */
  private instanceId = crypto.randomUUID().slice(0, 8);

  constructor(options?: MastraAuthWorkosOptions) {
    super({ name: options?.name ?? 'workos' });

    console.log(`[WorkOS:${this.instanceId}] Constructor called - new instance created`);

    const apiKey = options?.apiKey ?? process.env.WORKOS_API_KEY;
    const clientId = options?.clientId ?? process.env.WORKOS_CLIENT_ID;
    const redirectUri = options?.redirectUri ?? process.env.WORKOS_REDIRECT_URI;

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

    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.ssoConfig = options?.sso;
    this.sessionConfig = {
      ...DEFAULT_SESSION_CONFIG,
      ...options?.session,
    };

    this.workos = new WorkOS(apiKey, {
      clientId,
    });

    this.registerOptions(options as MastraAuthProviderOptions<WorkOSUser>);
  }

  // ============================================================================
  // MastraAuthProvider Implementation
  // ============================================================================

  /**
   * Authenticate a bearer token by verifying it against WorkOS JWKS.
   *
   * This method supports both JWT tokens (access tokens from WorkOS)
   * and session-based authentication via cookies.
   *
   * @param token - The bearer token to authenticate
   * @param request - The incoming HTTP request
   * @returns The authenticated user or null if authentication fails
   */
  async authenticateToken(token: string, request: HonoRequest): Promise<WorkOSUser | null> {
    console.log(`[WorkOS:${this.instanceId}] authenticateToken: token=${token ? 'present' : 'empty'}`);
    try {
      // First, try to validate as a JWT using WorkOS JWKS
      const jwksUri = this.workos.userManagement.getJwksUrl(this.clientId);
      const payload = await verifyJwks(token, jwksUri);

      if (payload && payload.sub) {
        console.log(`[WorkOS:${this.instanceId}] authenticateToken: JWT valid for user ${payload.sub}`);
        // Fetch full user details from WorkOS
        const user = await this.workos.userManagement.getUser(payload.sub);

        // Get organization memberships for the user
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

      return null;
    } catch (error) {
      console.log(`[WorkOS:${this.instanceId}] authenticateToken: JWT verification failed, trying session-based auth`);
      // JWT verification failed, try session-based auth
      const sessionId = this.getSessionIdFromRequest(request.raw);
      console.log(`[WorkOS:${this.instanceId}] authenticateToken: sessionId from cookie = ${sessionId || 'none'}`);
      if (sessionId) {
        const session = await this.validateSession(sessionId);
        if (session) {
          console.log(`[WorkOS:${this.instanceId}] authenticateToken: session valid, fetching user ${session.userId}`);
          return this.getUser(session.userId) as Promise<WorkOSUser | null>;
        }
      }

      return null;
    }
  }

  /**
   * Authorize a user for access.
   *
   * By default, any authenticated user with a valid WorkOS ID is authorized.
   * Override this behavior by providing a custom `authorizeUser` function
   * in the constructor options.
   *
   * @param user - The authenticated user
   * @returns True if the user is authorized
   */
  async authorizeUser(user: WorkOSUser): Promise<boolean> {
    return !!user?.id && !!user?.workosId;
  }

  // ============================================================================
  // IUserProvider Implementation
  // ============================================================================

  /**
   * Get the current user from the request.
   *
   * Extracts the user from the session cookie or authorization header.
   *
   * @param request - The incoming HTTP request
   * @returns The current user or null if not authenticated
   */
  async getCurrentUser(request: Request): Promise<EEUser | null> {
    try {
      // Try to get session from cookie
      const sessionId = this.getSessionIdFromRequest(request);
      if (sessionId) {
        const session = await this.validateSession(sessionId);
        if (session) {
          return this.getUser(session.userId);
        }
      }

      // Try to get from Authorization header
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const jwksUri = this.workos.userManagement.getJwksUrl(this.clientId);
        const payload = await verifyJwks(token, jwksUri);

        if (payload?.sub) {
          return this.getUser(payload.sub);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get a user by their ID.
   *
   * Fetches the user from WorkOS User Management.
   *
   * @param userId - The WorkOS user ID
   * @returns The user or null if not found
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
   *
   * @param user - The user object
   * @returns URL to the profile page
   */
  getUserProfileUrl(user: EEUser): string {
    return `/profile/${user.id}`;
  }

  // ============================================================================
  // ISSOProvider Implementation
  // ============================================================================

  /**
   * Get the URL to redirect users to for SSO login.
   *
   * Constructs the WorkOS authorization URL based on the configured
   * SSO options (connection, organization, or OAuth provider).
   *
   * @param redirectUri - The callback URL after authentication
   * @param state - CSRF protection state parameter
   * @returns The authorization URL
   */
  getLoginUrl(redirectUri: string, state: string): string {
    // Build authorization URL options based on SSO configuration
    // WorkOS requires exactly one of: connection, organization, or provider
    const baseOptions = {
      clientId: this.clientId,
      redirectUri: redirectUri || this.redirectUri,
      state,
    };

    // Configure SSO method based on options
    if (this.ssoConfig?.connection) {
      // Direct connection SSO
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        connectionId: this.ssoConfig.connection,
      });
    } else if (this.ssoConfig?.provider) {
      // OAuth provider (Google, Microsoft, GitHub, Apple)
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        provider: this.ssoConfig.provider,
      });
    } else if (this.ssoConfig?.defaultOrganization) {
      // Organization-based SSO
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        organizationId: this.ssoConfig.defaultOrganization,
      });
    }

    // Default: use AuthKit provider if no specific SSO config
    return this.workos.userManagement.getAuthorizationUrl({
      ...baseOptions,
      provider: 'authkit',
    });
  }

  /**
   * Handle the OAuth callback from WorkOS.
   *
   * Exchanges the authorization code for tokens and retrieves the user.
   *
   * @param code - The authorization code from the callback
   * @param _state - The state parameter for CSRF validation (validated by caller)
   * @returns The authenticated user and tokens
   */
  async handleCallback(code: string, _state: string): Promise<SSOCallbackResult<EEUser>> {
    const response = await this.workos.userManagement.authenticateWithCode({
      code,
      clientId: this.clientId,
    });

    const user = mapWorkOSUserToEEUser(response.user);

    // WorkOS response may include expiresIn (seconds until expiry)
    // Cast to access optional properties that may exist on the response
    const authResponse = response as typeof response & { expiresIn?: number };
    const expiresIn = authResponse.expiresIn;

    return {
      user,
      tokens: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      },
    };
  }

  /**
   * Get the URL to redirect users to for logout.
   *
   * @param redirectUri - The URL to redirect to after logout
   * @returns The logout URL
   */
  getLogoutUrl(redirectUri: string): string {
    // WorkOS User Management logout endpoint
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
    });
    return `https://api.workos.com/user_management/logout?${params.toString()}`;
  }

  /**
   * Get the configuration for rendering the login button.
   *
   * @returns Login button configuration
   */
  getLoginButtonConfig(): SSOLoginConfig {
    // Customize text based on provider
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
   * @param userId - The user ID to create a session for
   * @param metadata - Optional session metadata including tokens
   * @returns The created session
   */
  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<WorkOSSession> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionConfig.maxAge * 1000);

    const session: WorkOSSession = {
      id: sessionId,
      userId,
      createdAt: now,
      expiresAt,
      accessToken: (metadata?.accessToken as string) || '',
      refreshToken: metadata?.refreshToken as string | undefined,
      tokenExpiresAt: metadata?.tokenExpiresAt as Date | undefined,
      metadata,
    };

    this.sessions.set(sessionId, session);
    console.log(
      `[WorkOS:${this.instanceId}] createSession: created session ${sessionId} for user ${userId}, total sessions: ${this.sessions.size}`,
    );
    return session;
  }

  /**
   * Validate a session and return it if valid.
   *
   * @param sessionId - The session ID to validate
   * @returns The session if valid, null otherwise
   */
  async validateSession(sessionId: string): Promise<WorkOSSession | null> {
    console.log(
      `[WorkOS:${this.instanceId}] validateSession: looking for session ${sessionId}, total sessions: ${this.sessions.size}`,
    );
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`[WorkOS:${this.instanceId}] validateSession: session NOT FOUND`);
      return null;
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      console.log(`[WorkOS:${this.instanceId}] validateSession: session EXPIRED`);
      this.sessions.delete(sessionId);
      return null;
    }

    console.log(`[WorkOS:${this.instanceId}] validateSession: session VALID for user ${session.userId}`);
    return session;
  }

  /**
   * Destroy a session (logout).
   *
   * @param sessionId - The session ID to destroy
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session?.accessToken) {
      try {
        // Attempt to revoke the access token with WorkOS
        // Note: WorkOS may not have a direct revoke endpoint,
        // but we clear the local session regardless
        this.sessions.delete(sessionId);
      } catch {
        // Still delete the session even if revocation fails
        this.sessions.delete(sessionId);
      }
    } else {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Refresh a session, extending its expiry.
   *
   * If the session has a refresh token, this will also refresh
   * the underlying WorkOS tokens.
   *
   * @param sessionId - The session ID to refresh
   * @returns The updated session or null if invalid
   */
  async refreshSession(sessionId: string): Promise<WorkOSSession | null> {
    const session = await this.validateSession(sessionId);
    if (!session) {
      return null;
    }

    // Try to refresh tokens if we have a refresh token
    if (session.refreshToken) {
      try {
        const response = await this.workos.userManagement.authenticateWithRefreshToken({
          refreshToken: session.refreshToken,
          clientId: this.clientId,
        });

        // WorkOS response may include expiresIn (seconds until expiry)
        const authResponse = response as typeof response & { expiresIn?: number };
        const expiresIn = authResponse.expiresIn;

        session.accessToken = response.accessToken;
        session.refreshToken = response.refreshToken;
        session.tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;
      } catch {
        // Token refresh failed, but we can still extend the session
      }
    }

    // Extend session expiry
    session.expiresAt = new Date(Date.now() + this.sessionConfig.maxAge * 1000);
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Extract session ID from an incoming request.
   *
   * Looks for the session in the configured cookie name.
   *
   * @param request - The incoming HTTP request
   * @returns The session ID or null if not present
   */
  getSessionIdFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').reduce(
      (acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          acc[name] = value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return cookies[this.sessionConfig.cookieName] || null;
  }

  /**
   * Create response headers to set the session cookie.
   *
   * @param session - The session to encode in the cookie
   * @returns Headers object with Set-Cookie header
   */
  getSessionHeaders(session: WorkOSSession): Record<string, string> {
    const cookieParts = [
      `${this.sessionConfig.cookieName}=${session.id}`,
      `Path=${this.sessionConfig.path}`,
      `Max-Age=${this.sessionConfig.maxAge}`,
      `SameSite=${this.sessionConfig.sameSite}`,
      'HttpOnly',
    ];

    if (this.sessionConfig.secure) {
      cookieParts.push('Secure');
    }

    return {
      'Set-Cookie': cookieParts.join('; '),
    };
  }

  /**
   * Create response headers to clear the session cookie.
   *
   * @returns Headers object to clear the session
   */
  getClearSessionHeaders(): Record<string, string> {
    const cookieParts = [
      `${this.sessionConfig.cookieName}=`,
      `Path=${this.sessionConfig.path}`,
      'Max-Age=0',
      `SameSite=${this.sessionConfig.sameSite}`,
      'HttpOnly',
    ];

    if (this.sessionConfig.secure) {
      cookieParts.push('Secure');
    }

    return {
      'Set-Cookie': cookieParts.join('; '),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the underlying WorkOS client.
   *
   * Useful for accessing WorkOS APIs directly, such as
   * Directory Sync, Admin Portal, or Organization management.
   *
   * @returns The WorkOS client instance
   */
  getWorkOS(): WorkOS {
    return this.workos;
  }

  /**
   * Get the configured client ID.
   *
   * @returns The WorkOS client ID
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Get the configured redirect URI.
   *
   * @returns The OAuth redirect URI
   */
  getRedirectUri(): string {
    return this.redirectUri;
  }
}
