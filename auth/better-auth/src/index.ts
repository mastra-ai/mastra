import { MastraAuthProvider } from '@mastra/core/server';
import type { MastraAuthProviderOptions } from '@mastra/core/server';

import type { BetterAuthOptions, Session, User } from 'better-auth';
import { betterAuth } from 'better-auth';
import type { HonoRequest } from 'hono';

type BetterAuthUser = User & {
  session: Session;
};

interface MastraAuthBetterAuthOptions extends MastraAuthProviderOptions<BetterAuthUser> {
  /**
   * Better Auth configuration options
   * This should match your Better Auth server configuration
   */
  authOptions: BetterAuthOptions;
  /**
   * Custom session validation function
   * Return true to authorize the user, false to deny access
   */
  validateSession?: (user: User, session: Session) => boolean | Promise<boolean>;
}

export class MastraAuthBetterAuth extends MastraAuthProvider<BetterAuthUser> {
  protected auth: ReturnType<typeof betterAuth>;
  protected validateSession?: (user: User, session: Session) => boolean | Promise<boolean>;

  constructor(options: MastraAuthBetterAuthOptions) {
    super({ name: 'better-auth' });

    if (!options.authOptions) {
      throw new Error(
        'Better Auth configuration is required. Please provide authOptions with your Better Auth configuration.',
      );
    }

    this.auth = betterAuth(options.authOptions);
    this.validateSession = options.validateSession;

    this.registerOptions(options);
  }

  /**
   * Authenticates a session token from Better Auth
   * @param token - The session token (typically from cookies)
   * @param request - The Hono request object (optional, can extract token from request headers if needed)
   * @returns User with session data if valid, null otherwise
   */
  async authenticateToken(token: string, _request?: HonoRequest): Promise<BetterAuthUser | null> {
    try {
      // Better Auth uses session tokens stored in cookies
      // We need to construct a minimal headers object with the session cookie
      const headers = new Headers();
      headers.set('cookie', `better-auth.session_token=${token}`);

      const sessionData = await this.auth.api.getSession({
        headers,
      });

      if (!sessionData || !sessionData.user || !sessionData.session) {
        return null;
      }

      return {
        ...sessionData.user,
        session: sessionData.session,
      };
    } catch (error) {
      console.error('Better Auth token authentication failed:', error);
      return null;
    }
  }

  /**
   * Authorizes a user based on session data
   * @param user - The authenticated user with session
   * @param request - The Hono request object (optional, can be used for path/method-based authorization)
   * @returns true if authorized, false otherwise
   */
  async authorizeUser(user: BetterAuthUser, _request?: HonoRequest): Promise<boolean> {
    if (!user || !user.session) {
      return false;
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(user.session.expiresAt);

    if (expiresAt < now) {
      return false;
    }

    // Use custom validation if provided
    if (this.validateSession) {
      return await this.validateSession(user, user.session);
    }

    // Default: authorize if session is valid
    return true;
  }

  /**
   * Helper method to get session from request headers
   * Useful for server-side authentication
   */
  async getSessionFromHeaders(headers: Headers): Promise<BetterAuthUser | null> {
    try {
      const sessionData = await this.auth.api.getSession({
        headers,
      });

      if (!sessionData || !sessionData.user || !sessionData.session) {
        return null;
      }

      return {
        ...sessionData.user,
        session: sessionData.session,
      };
    } catch (error) {
      console.error('Failed to get session from headers:', error);
      return null;
    }
  }
}
