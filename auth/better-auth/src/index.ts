import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';
import type { IUserProvider, ICredentialsProvider, EEUser, CredentialsResult } from '@mastra/core/ee';

import type { Auth, Session, User } from 'better-auth';
import type { HonoRequest } from 'hono';

/**
 * User type returned by Better Auth session verification.
 * Used internally for authentication token verification.
 */
export interface BetterAuthUser {
  session: Session;
  user: User;
}

/**
 * Maps Better Auth User to EE User format.
 */
function mapBetterAuthUserToEEUser(user: User): EEUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.image ?? undefined,
    metadata: {
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
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
export class MastraAuthBetterAuth
  extends MastraAuthProvider<BetterAuthUser>
  implements IUserProvider<EEUser>, ICredentialsProvider<EEUser>
{
  protected auth: Auth;

  constructor(options: MastraAuthBetterAuthOptions) {
    super({ name: options?.name ?? 'better-auth' });

    if (!options.auth) {
      throw new Error(
        'Better Auth instance is required. Please provide the auth option with your Better Auth instance created via betterAuth({ ... })',
      );
    }

    this.auth = options.auth;

    this.registerOptions(options);
  }

  // ============================================
  // IUserProvider implementation (EE capability)
  // License check happens in buildCapabilities()
  // ============================================

  /**
   * Get current user from request.
   * Implements IUserProvider for EE user awareness in Studio.
   *
   * @param request - Incoming HTTP request
   * @returns EE User object or null if not authenticated
   */
  async getCurrentUser(request: Request): Promise<EEUser | null> {
    try {
      const result = await this.auth.api.getSession({
        headers: request.headers,
      });

      if (!result?.user) return null;
      return mapBetterAuthUserToEEUser(result.user);
    } catch {
      return null;
    }
  }

  /**
   * Get user by ID.
   * Implements IUserProvider for EE user awareness.
   *
   * Note: Better Auth doesn't expose a direct getUser API.
   * For full functionality, you may need to implement this using
   * direct database access in a subclass.
   *
   * @param userId - User identifier
   * @returns EE User object or null if not found
   */
  async getUser(userId: string): Promise<EEUser | null> {
    // Better Auth doesn't have a direct getUser API
    // Users can override this method with their own implementation
    // that queries the database directly
    console.warn(
      '[MastraAuthBetterAuth] getUser() requires direct database access. ' +
        'Override this method in a subclass for full user lookup support.',
    );
    return null;
  }

  /**
   * Get URL to user's profile page.
   * Optional IUserProvider method.
   */
  getUserProfileUrl(user: EEUser): string {
    return `/profile/${user.id}`;
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
      // Better Auth expects the token to be passed via headers
      // We need to construct headers with the Authorization bearer token
      const headers = new Headers();

      // Copy relevant headers from the request
      const authHeader = request.header('Authorization');
      if (authHeader) {
        headers.set('Authorization', authHeader);
      } else if (token) {
        // If no auth header but token is provided, set it
        headers.set('Authorization', `Bearer ${token}`);
      }

      // Copy cookie header if present (Better Auth can use cookies for sessions)
      const cookieHeader = request.header('Cookie');
      if (cookieHeader) {
        headers.set('Cookie', cookieHeader);
      }

      // Use Better Auth's API to get the session
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
      // Session verification failed
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

  // ============================================
  // ICredentialsProvider implementation (EE capability)
  // License check happens in buildCapabilities()
  // ============================================

  /**
   * Sign in with email and password.
   * Implements ICredentialsProvider for EE credentials auth.
   *
   * @param email - User email
   * @param password - User password
   * @param request - Incoming HTTP request
   * @returns Result with user and session cookies
   * @throws Error if credentials are invalid
   */
  async signIn(email: string, password: string, request: Request): Promise<CredentialsResult<EEUser>> {
    const headers = request?.headers ?? new Headers();

    // Use asResponse: true to get the full response with Set-Cookie headers
    const response = await this.auth.api.signInEmail({
      body: { email, password },
      headers,
      asResponse: true,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorData.message || 'Invalid email or password');
    }

    const result = (await response.json()) as { user?: User; token?: string | null };

    if (!result?.user) {
      throw new Error('Invalid email or password');
    }

    // Extract Set-Cookie headers from Better Auth response
    const cookies: string[] = [];
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      // Split multiple cookies (they may be comma-separated or in multiple headers)
      cookies.push(...setCookieHeader.split(/,(?=\s*\w+=)/));
    }

    return {
      user: mapBetterAuthUserToEEUser(result.user),
      token: result.token ?? undefined,
      cookies,
    };
  }

  /**
   * Sign up with email and password.
   * Implements ICredentialsProvider for EE credentials auth.
   *
   * @param email - User email
   * @param password - User password
   * @param name - Optional display name
   * @param request - Incoming HTTP request
   * @returns Result with new user and session cookies
   * @throws Error if sign up fails
   */
  async signUp(
    email: string,
    password: string,
    name: string | undefined,
    request: Request,
  ): Promise<CredentialsResult<EEUser>> {
    const displayName = name ?? email.split('@')[0] ?? 'User';
    const headers = request?.headers ?? new Headers();

    // Use asResponse: true to get the full response with Set-Cookie headers
    const response = await this.auth.api.signUpEmail({
      body: { email, password, name: displayName },
      headers,
      asResponse: true,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorData.message || 'Failed to create account');
    }

    const result = (await response.json()) as { user?: User; token?: string | null };

    if (!result?.user) {
      throw new Error('Failed to create account');
    }

    // Extract Set-Cookie headers from Better Auth response
    const cookies: string[] = [];
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      // Split multiple cookies (they may be comma-separated or in multiple headers)
      cookies.push(...setCookieHeader.split(/,(?=\s*\w+=)/));
    }

    return {
      user: mapBetterAuthUserToEEUser(result.user),
      token: result.token ?? undefined,
      cookies,
    };
  }

  /**
   * Get the underlying Better Auth instance.
   * Useful for accessing Better Auth APIs directly.
   */
  getAuth(): Auth {
    return this.auth;
  }
}
