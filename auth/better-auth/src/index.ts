import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';

import type { Auth, Session, User } from 'better-auth';
import type { HonoRequest } from 'hono';

/**
 * User type returned by Better Auth session verification
 */
export interface BetterAuthUser {
  session: Session;
  user: User;
}

interface MastraAuthBetterAuthOptions extends MastraAuthProviderOptions<BetterAuthUser> {
  /**
   * The Better Auth instance to use for authentication.
   * This should be the result of calling `betterAuth({ ... })`.
   */
  auth: Auth;
}

/**
 * Mastra authentication provider for Better Auth.
 *
 * Better Auth is a self-hosted, open-source authentication framework
 * that gives you full control over your authentication system.
 *
 * @example
 * ```typescript
 * import { betterAuth } from 'better-auth';
 * import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
 *
 * // Create your Better Auth instance
 * const auth = betterAuth({
 *   database: {
 *     provider: 'postgresql',
 *     url: process.env.DATABASE_URL!,
 *   },
 *   emailAndPassword: {
 *     enabled: true,
 *   },
 * });
 *
 * // Create the Mastra auth provider
 * const mastraAuth = new MastraAuthBetterAuth({
 *   auth,
 * });
 *
 * // Use with Mastra
 * const mastra = new Mastra({
 *   server: {
 *     auth: mastraAuth,
 *   },
 * });
 * ```
 *
 * @see https://better-auth.com for Better Auth documentation
 */
export class MastraAuthBetterAuth extends MastraAuthProvider<BetterAuthUser> {
  protected auth: Auth;

  constructor(options: MastraAuthBetterAuthOptions) {
    super({ name: options?.name ?? 'better-auth' });

    if (!options.auth) {
      throw new Error(
        'Better Auth instance is required. Please provide the auth option with your Better Auth instance created via betterAuth({ ... })',
      );
    }

    this.auth = options.auth;
    // options is not part of Better Auth's public API
    const authWithOptions = this.auth as unknown as { options?: { advanced?: { cookiePrefix?: string } } };
    const prefix = authWithOptions.options?.advanced?.cookiePrefix ?? 'better-auth';
    this.sessionCookieName = `${prefix}.session_token`;

    this.registerOptions(options);
  }

  /**
   * Authenticate a bearer token by verifying the session with Better Auth.
   *
   * This method extracts the session from the request headers using
   * Better Auth's `api.getSession()` endpoint.
   *
   * @param token - The bearer token (session token) to authenticate
   * @param request - The Hono request object containing headers
   * @returns The authenticated user and session, or null if authentication fails
   */
  async authenticateToken(token: string, request: HonoRequest): Promise<BetterAuthUser | null> {
    try {
      // Better Auth's api.getSession() reads session tokens from the Cookie header
      const headers = new Headers();

      const cookieHeader = request?.header('Cookie');
      if (cookieHeader) {
        headers.set('Cookie', cookieHeader);
      }

      // Convert Bearer token to a session cookie if not already present
      const hasSessionCookieInHeader = !!cookieHeader?.split(';').some(pair => {
        const [key] = pair.trim().split('=');
        return key?.trim() === this.sessionCookieName;
      });
      if (token && !hasSessionCookieInHeader) {
        const existingCookies = cookieHeader ? `${cookieHeader}; ` : '';
        headers.set('Cookie', `${existingCookies}${this.sessionCookieName}=${token}`);
      }

      const result = await this.auth.api.getSession({
        headers,
      });

      if (!result || !result.session || !result.user) {
        return null;
      }

      return {
        session: result.session,
        user: result.user,
      };
    } catch {
      return null;
    }
  }

  /**
   * Authorize a user for access.
   *
   * By default, any authenticated user with a valid session is authorized.
   * You can override this behavior by providing a custom `authorizeUser` function
   * in the constructor options.
   *
   * @param user - The authenticated user and session
   * @returns True if the user is authorized, false otherwise
   */
  async authorizeUser(user: BetterAuthUser): Promise<boolean> {
    // By default, any authenticated user with a valid session is authorized
    return !!user?.session?.id && !!user?.user?.id;
  }
}
