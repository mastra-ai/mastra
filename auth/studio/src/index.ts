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
}

export interface MastraAuthStudioOptions extends MastraAuthProviderOptions<StudioUser> {
  /** Base URL of the Mastra shared API (e.g., https://api.mastra.ai/v1) */
  sharedApiUrl?: string;
  /** Organization ID that owns this deployed instance. Users not in this org are rejected. */
  organizationId?: string;
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

  constructor(options?: MastraAuthStudioOptions) {
    super({ name: 'mastra-studio', ...options });
    this.sharedApiUrl = options?.sharedApiUrl || process.env.MASTRA_SHARED_API_URL || 'http://localhost:3010/v1';
    this.organizationId = options?.organizationId || process.env.MASTRA_ORGANIZATION_ID;

    // Strip trailing slash
    if (this.sharedApiUrl.endsWith('/')) {
      this.sharedApiUrl = this.sharedApiUrl.slice(0, -1);
    }

    // Use production cookie settings (Secure + Domain=.mastra.ai) only when
    // the shared API is actually on .mastra.ai — NOT based on NODE_ENV which
    // may be 'production' even in local dev (e.g. mastra dev sets it).
    this.useProductionCookies = this.sharedApiUrl.includes('.mastra.ai');

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

    // Org-scoping: if this instance belongs to a specific org, reject users not in that org
    if (this.organizationId && user.organizationId !== this.organizationId) {
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

  async handleCallback(code: string, state: string): Promise<SSOCallbackResult<StudioUser>> {
    // Forward the callback to the shared API
    const url = `${this.sharedApiUrl}/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

    const res = await fetch(url, {
      redirect: 'manual',
    });

    // The shared API redirects after setting cookies — extract the session cookie
    const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
    const sessionValue = extractCookieValue(setCookieHeaders, COOKIE_NAME);

    if (!sessionValue) {
      throw new Error('No session cookie returned from callback');
    }

    // Validate the new session to get user info
    const user = await this.verifySessionCookie(sessionValue);
    if (!user) {
      throw new Error('Session validation failed after callback');
    }

    return {
      user,
      tokens: {
        accessToken: sessionValue,
      },
      cookies: setCookieHeaders,
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
    return this.validateSession(sessionId);
  }

  getSessionIdFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    return parseCookie(cookieHeader, COOKIE_NAME);
  }

  getSessionHeaders(session: Session): Record<string, string> {
    const parts = [`${COOKIE_NAME}=${session.id}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=86400'];
    if (this.useProductionCookies) {
      parts.push('Secure');
      parts.push('Domain=.mastra.ai');
    }
    return { 'Set-Cookie': parts.join('; ') };
  }

  getClearSessionHeaders(): Record<string, string> {
    const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
    if (this.useProductionCookies) {
      parts.push('Secure');
      parts.push('Domain=.mastra.ai');
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
      };

      return {
        id: data.user.id,
        email: data.user.email,
        name: [data.user.firstName, data.user.lastName].filter(Boolean).join(' ') || undefined,
        avatarUrl: data.user.profilePictureUrl,
        organizationId: data.organizationId,
        role: data.role,
        permissions: data.permissions,
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
      };

      return {
        id: data.user.id,
        email: data.user.email,
        name: [data.user.firstName, data.user.lastName].filter(Boolean).join(' ') || undefined,
        organizationId: data.organizationId,
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

function extractCookieValue(setCookieHeaders: string[], name: string): string | null {
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match?.[1]) return match[1];
  }
  return null;
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
