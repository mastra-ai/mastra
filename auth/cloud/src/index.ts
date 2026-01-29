/**
 * @mastra/auth-cloud
 *
 * Zero-config authentication with Mastra Cloud.
 *
 * @packageDocumentation
 */

import { decodeJwt } from 'jose';
import { MastraAuthProvider } from '@mastra/core/server';
import {
  resolvePermissions,
  DEFAULT_ROLES,
  type IUserProvider,
  type ISessionProvider,
  type ISSOProvider,
  type IRBACProvider,
  type SSOCallbackResult,
  type SSOLoginConfig,
} from '@mastra/core/ee';
import { MastraCloudClient, CloudApiError, type CloudUser, type CloudSession } from './client';

export { MastraCloudClient, CloudApiError, type CloudUser, type CloudSession, type JWTClaims } from './client';

/**
 * Configuration for MastraCloudAuth.
 */
export interface MastraCloudAuthConfig {
  /** Project ID from cloud.mastra.ai */
  projectId: string;
  /** Base URL (defaults to https://cloud.mastra.ai) */
  baseUrl?: string;
  /** Cookie name for sessions (defaults to 'mastra_session') */
  cookieName?: string;
}

/**
 * MastraCloudAuth - Zero-config auth powered by Mastra Cloud.
 *
 * Extends MastraAuthProvider with all EE auth interfaces, backed by Mastra Cloud.
 * Users get full authentication for free, Mastra gets platform adoption.
 *
 * @example
 * ```typescript
 * import { MastraCloudAuth } from '@mastra/auth-cloud';
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraCloudAuth({
 *       projectId: process.env.MASTRA_PROJECT_ID!,
 *     }),
 *   },
 * });
 * ```
 */
export class MastraCloudAuth
  extends MastraAuthProvider<CloudUser>
  implements IUserProvider<CloudUser>, ISessionProvider<CloudSession>, ISSOProvider<CloudUser>, IRBACProvider<CloudUser>
{
  /**
   * Marker to identify MastraCloudAuth instances.
   * Used by buildCapabilities to bypass license check.
   */
  public readonly isMastraCloudAuth = true;

  private client: MastraCloudClient;
  private cookieName: string;

  constructor(config: MastraCloudAuthConfig) {
    super({ name: 'mastra-cloud' });

    this.client = new MastraCloudClient({
      projectId: config.projectId,
      baseUrl: config.baseUrl,
    });
    this.cookieName = config.cookieName ?? 'mastra_session';
  }

  // ============================================
  // MastraAuthProvider (base, required)
  // ============================================

  async authenticateToken(token: string): Promise<CloudUser | null> {
    return this.client.verifyToken({ token });
  }

  async authorizeUser(_user: CloudUser): Promise<boolean> {
    // Authorization is handled by RBAC
    return true;
  }

  // ============================================
  // IUserProvider
  // ============================================

  async getCurrentUser(request: Request): Promise<CloudUser | null> {
    const sessionToken = this.extractSessionToken(request);
    if (!sessionToken) return null;

    try {
      // sessionToken IS the JWT - decode it locally to get user info (NO API call)
      const claims = decodeJwt(sessionToken);

      return {
        id: claims.sub as string,
        email: claims.email as string,
        sessionToken: sessionToken,
        name: claims.name as string | undefined,
        avatarUrl: claims.avatar as string | undefined,
        createdAt: new Date((claims.iat as number) * 1000),
      };
    } catch {
      // Invalid/malformed JWT - user is not authenticated
      return null;
    }
  }

  async getUser(userId: string, token?: string): Promise<CloudUser | null> {
    // Without token, cannot make authenticated request
    if (!token) return null;
    return this.client.getUser({ userId, token });
  }

  getUserProfileUrl(user: CloudUser): string {
    return `https://cloud.mastra.ai/profile/${user.id}`;
  }

  // ============================================
  // ISessionProvider
  // ============================================

  async createSession(_userId: string, _metadata?: Record<string, unknown>): Promise<CloudSession> {
    // Cloud does not support server-side session creation
    // Sessions are created via SSO flow (handleCallback)
    throw new CloudApiError(
      'MastraCloudAuth does not support createSession(). Use SSO flow via handleCallback() instead.',
      501,
      'not_implemented',
    );
  }

  async validateSession(sessionToken: string): Promise<CloudSession | null> {
    return this.client.validateSession({ sessionToken });
  }

  async destroySession(sessionId: string, token?: string): Promise<void> {
    await this.client.destroySession({ sessionId, token });
  }

  async refreshSession(sessionToken: string): Promise<CloudSession | null> {
    // Mastra Cloud handles refresh automatically
    return this.client.validateSession({ sessionToken });
  }

  getSessionIdFromRequest(request: Request): string | null {
    return this.extractSessionToken(request);
  }

  getSessionHeaders(session: CloudSession): Record<string, string> {
    const maxAge = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    return {
      'Set-Cookie': `${this.cookieName}=${session.id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
    };
  }

  getClearSessionHeaders(): Record<string, string> {
    return {
      'Set-Cookie': `${this.cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    };
  }

  // ============================================
  // ISSOProvider
  // ============================================

  getLoginUrl(redirectUri: string, state: string): string {
    return this.client.getLoginUrl({ redirectUri, state });
  }

  async handleCallback(code: string, _state: string): Promise<SSOCallbackResult<CloudUser>> {
    const { user, session, jwt } = await this.client.exchangeCode({ code });

    // Validate JWT is decodable (throws if malformed)
    decodeJwt(jwt);

    return {
      user,
      tokens: {
        accessToken: jwt,
        expiresAt: session.expiresAt,
      },
    };
  }

  getLogoutUrl(redirectUri: string): string {
    return `https://cloud.mastra.ai/auth/logout?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  getLoginButtonConfig(): SSOLoginConfig {
    return {
      provider: 'mastra',
      text: 'Sign in with Mastra',
      icon: 'https://cloud.mastra.ai/icon.svg',
    };
  }

  // ============================================
  // IRBACProvider
  // ============================================

  async getRoles(user: CloudUser): Promise<string[]> {
    try {
      const claims = decodeJwt(user.sessionToken);
      const role = claims.role as string | undefined;
      return role ? [role] : [];
    } catch {
      return [];
    }
  }

  async hasRole(user: CloudUser, role: string): Promise<boolean> {
    try {
      const claims = decodeJwt(user.sessionToken);
      return claims.role === role;
    } catch {
      return false;
    }
  }

  async getPermissions(user: CloudUser): Promise<string[]> {
    try {
      const claims = decodeJwt(user.sessionToken);
      const role = claims.role as string | undefined;

      if (!role) {
        console.warn('MastraCloudAuth: JWT missing role claim');
        return [];
      }

      return resolvePermissions([role], DEFAULT_ROLES);
    } catch (error) {
      throw new CloudApiError(
        `Failed to decode session token: ${error instanceof Error ? error.message : 'unknown error'}`,
        401,
        'invalid_token',
      );
    }
  }

  async hasPermission(user: CloudUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.includes(permission) || permissions.includes('*');
  }

  async hasAllPermissions(user: CloudUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    if (userPermissions.includes('*')) return true;
    return permissions.every(p => userPermissions.includes(p));
  }

  async hasAnyPermission(user: CloudUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    if (userPermissions.includes('*')) return true;
    return permissions.some(p => userPermissions.includes(p));
  }

  // ============================================
  // Private helpers
  // ============================================

  private extractSessionToken(request: Request): string | null {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const match = cookieHeader.match(new RegExp(`${this.cookieName}=([^;]+)`));
    return match?.[1] ?? null;
  }
}
