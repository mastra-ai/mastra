/**
 * Better Auth user provider implementation.
 *
 * Implements the IUserProvider interface for retrieving user information
 * from Better Auth's database.
 *
 * @module auth-better-auth/user
 */

import type { IUserProvider } from '@mastra/core/ee';
import type { Auth } from 'better-auth';

import type { BetterAuthUser, BetterAuthConfig } from './types.js';

/**
 * Better Auth user provider for retrieving user information.
 *
 * Retrieves user data from:
 * - Current session (via Better Auth session token)
 * - Database (for user lookup by ID)
 *
 * @example
 * ```typescript
 * const userProvider = new BetterAuthUserProvider(betterAuthInstance);
 * const user = await userProvider.getCurrentUser(request);
 * if (user) {
 *   console.log('Authenticated as:', user.email);
 * }
 * ```
 */
export class BetterAuthUserProvider implements IUserProvider<BetterAuthUser> {
  constructor(
    private betterAuth: Auth,
    private config: BetterAuthConfig,
  ) {}

  /**
   * Get current authenticated user from request.
   *
   * Extracts the session token from the request cookie and validates it with Better Auth.
   * Returns the user information if the session is valid.
   *
   * @param request - Incoming HTTP request with session cookie
   * @returns Better Auth user or null if not authenticated
   */
  async getCurrentUser(request: Request): Promise<BetterAuthUser | null> {
    try {
      // Extract session token from cookie
      const sessionToken = this.getSessionTokenFromRequest(request);
      if (!sessionToken) {
        return null;
      }

      // Get session from Better Auth
      const result = await this.betterAuth.api.getSession({
        headers: request.headers,
      });

      if (!result?.user) {
        return null;
      }

      const betterAuthUser = result.user;

      // Map to BetterAuthUser format
      return this.mapToBetterAuthUser(betterAuthUser);
    } catch (error) {
      // Session invalid or expired
      return null;
    }
  }

  /**
   * Get user by ID from Better Auth database.
   *
   * @param userId - Better Auth user ID
   * @returns Better Auth user or null if not found
   */
  async getUser(userId: string): Promise<BetterAuthUser | null> {
    try {
      // Better Auth doesn't have a direct getUserById API endpoint,
      // so we need to use the internal method or query the database directly
      // For now, we'll use a workaround with session validation
      // In a real implementation, you'd query the database directly

      // Note: This is a limitation - Better Auth v1.1.4 doesn't expose user lookup by ID
      // A production implementation would query the database directly:
      // const user = await db.query.user.findFirst({ where: eq(user.id, userId) });

      // For now, return null as we can't implement this without database access
      // This will be improved when Better Auth adds a getUserById method
      console.warn('BetterAuthUserProvider.getUser: Direct user lookup not implemented');
      return null;
    } catch (error) {
      // User not found or database error
      return null;
    }
  }

  /**
   * Get URL to user's profile.
   *
   * Since Better Auth is self-hosted, there's no central dashboard.
   * This could be customized to return your app's user profile URL.
   *
   * @param user - User object
   * @returns URL to user profile in your application
   */
  getUserProfileUrl(user: BetterAuthUser): string {
    return `${this.config.baseURL}/profile/${user.id}`;
  }

  /**
   * Extract session token from request cookie.
   *
   * @private
   * @param request - HTTP request
   * @returns Session token or null if not found
   */
  private getSessionTokenFromRequest(request: Request): string | null {
    try {
      const cookieHeader = request.headers.get('cookie');
      if (!cookieHeader) {
        return null;
      }

      const cookieName = this.config.session?.cookieName || 'better_auth_session';
      const cookies = cookieHeader.split(';').map(c => c.trim());

      for (const cookie of cookies) {
        const equalsIndex = cookie.indexOf('=');
        if (equalsIndex === -1) continue;

        const name = cookie.slice(0, equalsIndex);
        const value = cookie.slice(equalsIndex + 1);

        if (name === cookieName) {
          // Decode URI-encoded cookie value
          return value ? decodeURIComponent(value) : null;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Map Better Auth user to BetterAuthUser format.
   *
   * @private
   * @param user - Better Auth user object
   * @returns BetterAuthUser with all fields mapped
   */
  private mapToBetterAuthUser(user: any): BetterAuthUser {
    // Helper to safely parse dates, defaulting to current date if invalid
    const parseDate = (dateValue: any): Date => {
      if (!dateValue) {
        return new Date();
      }
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.image ?? undefined,
      metadata: {},
      betterAuth: {
        userId: user.id,
        emailVerified: user.emailVerified ?? false,
        createdAt: parseDate(user.createdAt),
        updatedAt: parseDate(user.updatedAt),
      },
    };
  }
}
