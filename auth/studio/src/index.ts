import type {
  ISSOProvider,
  ISessionProvider,
  IUserProvider,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '@mastra/core/auth';
import type { EEUser, IRBACProvider, RoleMapping } from '@mastra/core/auth/ee';
import { resolvePermissionsFromMapping, matchesPermission } from '@mastra/core/auth/ee';
import { MastraAuthProvider } from '@mastra/core/server';
import type { MastraAuthProviderOptions } from '@mastra/core/server';

export interface StudioUser extends EEUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  organizationId?: string;
  role?: string;
  permissions?: string[];
  /** All organization IDs the user is a member of (for cross-org access checks) */
  memberOrgIds?: string[];
}

export interface MastraAuthStudioOptions extends MastraAuthProviderOptions<StudioUser> {
  /** Base URL of the Mastra shared API (e.g., https://api.mastra.ai/v1) */
  sharedApiUrl?: string;
  /** Organization ID that owns this deployed instance. Users not in this org are rejected. */
  organizationId?: string;
  /**
   * Cookie domain for session cookies (e.g., '.example.com').
   * When set, cookies will include Secure and Domain attributes.
   * Defaults to auto-detecting from sharedApiUrl (uses '.mastra.ai' when sharedApiUrl contains '.mastra.ai').
   * Can also be set via MASTRA_COOKIE_DOMAIN environment variable.
   */
  cookieDomain?: string;
}

const COOKIE_NAME = 'wos-session';

/**
 * Auth provider for Mastra Studio deployed instances.
 *
 * Proxies all authentication through the shared API, keeping the
 * WorkOS API key safely in the shared API. Deployed instances only
 * need the shared API URL — no secrets required.
 *
 * The shared API's sealed session cookie (`wos-session`) is set with
 * `Domain=.mastra.ai` in production, so it's included in requests
 * to deployed instances and can be forwarded for validation.
 */
export class MastraAuthStudio
  extends MastraAuthProvider<StudioUser>
  implements ISSOProvider<StudioUser>, ISessionProvider<Session>, IUserProvider<StudioUser>
{
  readonly isMastraCloudAuth = true;

  private sharedApiUrl: string;
  private organizationId: string | undefined;
  private useProductionCookies: boolean;
  private cookieDomain: string | undefined;

  constructor(options?: MastraAuthStudioOptions) {
    super({ name: 'mastra-studio', ...options });
    this.sharedApiUrl = options?.sharedApiUrl || process.env.MASTRA_SHARED_API_URL || 'http://localhost:3010/v1';
    this.organizationId = options?.organizationId || process.env.MASTRA_ORGANIZATION_ID;

    // Strip trailing slash
    if (this.sharedApiUrl.endsWith('/')) {
      this.sharedApiUrl = this.sharedApiUrl.slice(0, -1);
    }

    // Cookie domain can be explicitly configured, read from env, or auto-detected from sharedApiUrl
    this.cookieDomain = options?.cookieDomain || process.env.MASTRA_COOKIE_DOMAIN;

    // Use production cookie settings (Secure + Domain) when:
    // 1. An explicit cookieDomain is configured, OR
    // 2. The shared API is on .mastra.ai (auto-detect default domain)
    // Use hostname-based detection to avoid false positives (e.g., api.mastra.ai.evil.com)
    let autoDetectMastraAi = false;
    try {
      const hostname = new URL(this.sharedApiUrl).hostname.toLowerCase();
      autoDetectMastraAi = hostname === 'mastra.ai' || hostname.endsWith('.mastra.ai');
    } catch {
      autoDetectMastraAi = false;
    }
    this.useProductionCookies = !!this.cookieDomain || autoDetectMastraAi;

    // If no explicit domain but we're on .mastra.ai, use the default domain
    if (!this.cookieDomain && autoDetectMastraAi) {
      this.cookieDomain = '.mastra.ai';
    }

    if (options) {
      this.registerOptions(options);
    }
  }

  // ---------------------------------------------------------------------------
  // MastraAuthProvider abstract methods
  // ---------------------------------------------------------------------------

  /**
   * Authenticate an incoming request by forwarding the sealed session cookie
   * to the shared API's /auth/me endpoint, or a Bearer token to /auth/verify.
   */
  async authenticateToken(token: string, request: any): Promise<StudioUser | null> {
    let user: StudioUser | null = null;

    // Try sealed session cookie first (browser flow)
    const cookieHeader = request?.headers?.get('Cookie');
    const sessionCookie = parseCookie(cookieHeader, COOKIE_NAME);

    if (sessionCookie) {
      user = await this.verifySessionCookie(sessionCookie);
    }

    // Fall back to Bearer token (CLI / API token flow)
    if (!user && token) {
      user = await this.verifyBearerToken(token);
    }

    if (!user) return null;

    // Org-scoping: if this instance belongs to a specific org, reject users not a member of that org
    // Check memberOrgIds (all orgs user belongs to) rather than organizationId (current org)
    if (this.organizationId && !user.memberOrgIds?.includes(this.organizationId)) {
      return null;
    }

    return user;
  }

  authorizeUser(user: StudioUser): boolean {
    return !!user?.id;
  }

  // ---------------------------------------------------------------------------
  // ISSOProvider
  // ---------------------------------------------------------------------------

  getLoginUrl(redirectUri: string, state: string): string {
    // Extract the post-login redirect from state (format: uuid|encodedPostLoginRedirect)
    let postLoginRedirect = '/';
    if (state) {
      const pipeIndex = state.indexOf('|');
      if (pipeIndex !== -1) {
        try {
          postLoginRedirect = decodeURIComponent(state.slice(pipeIndex + 1));
        } catch {
          // ignore decode errors
        }
      }
    }

    const params = new URLSearchParams({
      product: 'deploy',
      redirect_uri: redirectUri,
      post_login_redirect: postLoginRedirect,
      // Force re-authentication so AuthKit always shows the account picker
      prompt: 'login',
      ...(this.organizationId ? { organization_id: this.organizationId } : {}),
    });

    return `${this.sharedApiUrl}/auth/login?${params.toString()}`;
  }

  async handleCallback(code: string, _state: string): Promise<SSOCallbackResult<StudioUser>> {
    // The shared API already consumed the OAuth code and passes the sealed
    // session directly as the `code` parameter in the redirect to this callback.
    // Validate it to get user info.
    const user = await this.verifySessionCookie(code);
    if (!user) {
      throw new Error('Session validation failed');
    }

    // Omit `cookies` so the Mastra server fallback path calls
    // createSession() + getSessionHeaders() to build a cookie scoped to
    // the deployed instance's domain.
    return {
      user,
      tokens: {
        accessToken: code,
      },
    };
  }

  setCallbackCookieHeader(_cookieHeader: string | null): void {
    // No-op: we don't use PKCE cookies — the shared API handles the full OAuth flow
  }

  getLoginCookies(): string[] | undefined {
    // No PKCE cookies needed — shared API manages the OAuth state
    return undefined;
  }

  getLoginButtonConfig(): SSOLoginConfig {
    return {
      provider: 'mastra-studio',
      text: 'Sign in with Mastra',
    };
  }

  async getLogoutUrl(_redirectUri: string, request?: Request): Promise<string | null> {
    const cookieHeader = request?.headers.get('Cookie');
    const sessionCookie = parseCookie(cookieHeader, COOKIE_NAME);

    if (!sessionCookie) return null;

    try {
      const res = await fetch(`${this.sharedApiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${COOKIE_NAME}=${sessionCookie}`,
        },
      });

      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; logoutUrl?: string };
        return data.logoutUrl ?? null;
      }
    } catch {
      // Failed to get logout URL — return null
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // ISessionProvider
  // ---------------------------------------------------------------------------

  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const now = new Date();
    return {
      id: (metadata?.accessToken as string) || crypto.randomUUID(),
      userId,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: now,
      metadata,
    };
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    const user = await this.verifySessionCookie(sessionId);
    if (!user) return null;

    const now = new Date();
    return {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      createdAt: now,
    };
  }

  async destroySession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.sharedApiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `${COOKIE_NAME}=${sessionId}`,
        },
      });
    } catch {
      // Best effort
    }
  }

  async refreshSession(sessionId: string): Promise<Session | null> {
    try {
      // Call the shared API's /auth/refresh endpoint to get a fresh access token
      const res = await fetch(`${this.sharedApiUrl}/auth/refresh`, {
        method: 'GET',
        headers: {
          Cookie: `${COOKIE_NAME}=${sessionId}`,
        },
      });

      if (!res.ok) {
        // Refresh failed, fall back to validation (will likely also fail)
        return this.validateSession(sessionId);
      }

      // Parse the new sealed session from Set-Cookie header
      const setCookie = res.headers.get('Set-Cookie');
      const newSessionId = setCookie ? parseCookieFromHeader(setCookie, COOKIE_NAME) : null;

      if (!newSessionId) {
        // No new cookie returned, fall back to validation with original
        return this.validateSession(sessionId);
      }

      // Verify the new session works and return it
      const user = await this.verifySessionCookie(newSessionId);
      if (!user) return null;

      const now = new Date();
      return {
        id: newSessionId,
        userId: user.id,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        createdAt: now,
      };
    } catch {
      // On error, fall back to validation
      return this.validateSession(sessionId);
    }
  }

  getSessionIdFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    return parseCookie(cookieHeader, COOKIE_NAME);
  }

  getSessionHeaders(session: Session): Record<string, string> {
    const parts = [`${COOKIE_NAME}=${session.id}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=86400'];
    if (this.useProductionCookies && this.cookieDomain) {
      parts.push('Secure');
      parts.push(`Domain=${this.cookieDomain}`);
    }
    return { 'Set-Cookie': parts.join('; ') };
  }

  getClearSessionHeaders(): Record<string, string> {
    const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
    if (this.useProductionCookies && this.cookieDomain) {
      parts.push('Secure');
      parts.push(`Domain=${this.cookieDomain}`);
    }
    return { 'Set-Cookie': parts.join('; ') };
  }

  // ---------------------------------------------------------------------------
  // IUserProvider
  // ---------------------------------------------------------------------------

  async getCurrentUser(request: Request): Promise<StudioUser | null> {
    const cookieHeader = request.headers.get('Cookie');
    const sessionCookie = parseCookie(cookieHeader, COOKIE_NAME);

    if (sessionCookie) {
      return this.verifySessionCookie(sessionCookie);
    }

    // Try bearer token
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return this.verifyBearerToken(authHeader.slice(7));
    }

    return null;
  }

  async getUser(_userId: string): Promise<StudioUser | null> {
    // Cannot look up users by ID — only validate sessions
    return null;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Forward a sealed session cookie to the shared API's /auth/me endpoint
   * to validate it and get user info.
   */
  private async verifySessionCookie(sessionCookie: string): Promise<StudioUser | null> {
    try {
      const res = await fetch(`${this.sharedApiUrl}/auth/me`, {
        headers: {
          Cookie: `${COOKIE_NAME}=${sessionCookie}`,
        },
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          profilePictureUrl?: string;
        };
        organizationId: string;
        role?: string;
        permissions?: string[];
        memberOrgIds?: string[];
      };

      return {
        id: data.user.id,
        email: data.user.email,
        name: [data.user.firstName, data.user.lastName].filter(Boolean).join(' ') || undefined,
        avatarUrl: data.user.profilePictureUrl,
        organizationId: data.organizationId,
        role: data.role,
        permissions: data.permissions,
        memberOrgIds: data.memberOrgIds,
      };
    } catch {
      return null;
    }
  }

  /**
   * Forward a Bearer token to the shared API's /auth/verify endpoint
   * to validate it and get user info (used for CLI tokens).
   */
  private async verifyBearerToken(token: string): Promise<StudioUser | null> {
    try {
      const res = await fetch(`${this.sharedApiUrl}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
        };
        organizationId: string;
        role?: string;
        memberOrgIds?: string[];
      };

      return {
        id: data.user.id,
        email: data.user.email,
        name: [data.user.firstName, data.user.lastName].filter(Boolean).join(' ') || undefined,
        organizationId: data.organizationId,
        role: data.role,
        memberOrgIds: data.memberOrgIds,
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function parseCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

/**
 * Parse a cookie value from a Set-Cookie header.
 * Set-Cookie format: "name=value; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400"
 */
function parseCookieFromHeader(setCookieHeader: string, name: string): string | null {
  // Set-Cookie header starts with "name=value" followed by optional attributes
  const parts = setCookieHeader.split(';');
  if (parts.length === 0) return null;

  const [cookieName, ...valueParts] = parts[0]!.split('=');
  if (cookieName?.trim() !== name) return null;

  // Value could contain = characters, so rejoin
  return valueParts.join('=') || null;
}

// ---------------------------------------------------------------------------
// MastraRBACStudio — role-based permission provider for Studio auth
// ---------------------------------------------------------------------------

export interface MastraRBACStudioOptions {
  /**
   * Mapping from role names to permission arrays.
   *
   * @example
   * ```typescript
   * {
   *   admin: ['*'],
   *   member: ['agents:read', 'workflows:*'],
   *   viewer: ['agents:read', 'workflows:read'],
   *   _default: [],
   * }
   * ```
   */
  roleMapping: RoleMapping;
}

/**
 * RBAC provider for Mastra Studio authentication.
 *
 * Maps user roles (from the shared API's /auth/me endpoint) to Mastra permissions
 * using a configurable role mapping.
 */
export class MastraRBACStudio implements IRBACProvider<StudioUser> {
  private options: MastraRBACStudioOptions;

  get roleMapping(): RoleMapping {
    return this.options.roleMapping;
  }

  constructor(options: MastraRBACStudioOptions) {
    this.options = options;
  }

  async getRoles(user: StudioUser): Promise<string[]> {
    return user.role ? [user.role] : [];
  }

  async hasRole(user: StudioUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  async getPermissions(user: StudioUser): Promise<string[]> {
    const roles = await this.getRoles(user);
    if (roles.length === 0) {
      return this.options.roleMapping['_default'] ?? [];
    }
    return resolvePermissionsFromMapping(roles, this.options.roleMapping);
  }

  async hasPermission(user: StudioUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.some(p => matchesPermission(p, permission));
  }

  async hasAllPermissions(user: StudioUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.every(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  async hasAnyPermission(user: StudioUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.some(required => userPermissions.some(p => matchesPermission(p, required)));
  }
}
