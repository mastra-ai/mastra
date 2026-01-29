/**
 * @mastra/auth-cloud
 *
 * Zero-config authentication with Mastra Cloud.
 *
 * @packageDocumentation
 */

import { MastraAuthProvider } from '@mastra/core/server';
import type {
  IUserProvider,
  ISessionProvider,
  ISSOProvider,
  IRBACProvider,
  SSOCallbackResult,
  SSOLoginConfig,
} from '@mastra/core/ee';
import { MastraCloudClient, type CloudUser, type CloudSession } from './client';

export { MastraCloudClient, CloudApiError, type CloudUser, type CloudSession } from './client';

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

    const session = await this.client.validateSession({ sessionToken });
    if (!session) return null;

    // Token needed for getUser - use session id as auth token
    return this.client.getUser({ userId: session.userId, token: sessionToken });
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
    throw new Error('MastraCloudAuth: createSession not supported. Use SSO flow via handleCallback.');
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
    const { user, session } = await this.client.exchangeCode({ code });

    return {
      user,
      tokens: {
        accessToken: session.id,
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
    return user.roles;
  }

  async hasRole(user: CloudUser, role: string): Promise<boolean> {
    return user.roles.includes(role);
  }

  async getPermissions(user: CloudUser, token?: string): Promise<string[]> {
    // Without token, cannot make authenticated request
    if (!token) return [];
    return this.client.getUserPermissions({ userId: user.id, token });
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
