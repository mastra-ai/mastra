import type { IUserProvider, ICredentialsProvider, CredentialsResult } from '@internal/auth';
import type { EEUser } from '@internal/auth/ee';
import type { MastraAuthProviderOptions } from '@internal/auth/provider';
import { MastraAuthProvider } from '@internal/auth/provider';

import type { Auth, Session, User } from 'better-auth';
import { makeSignature } from 'better-auth/crypto';

type HonoRequestLike = {
  raw?: Request;
  headers?: Headers;
  header(name: string): string | undefined;
};

type MastraAuthRequest = Request | HonoRequestLike;

type BetterAuthContext = Awaited<Auth['$context']>;

function tryDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getRequestHeader(request: MastraAuthRequest, name: string): string | null {
  if (request instanceof Request) {
    return request.headers.get(name);
  }

  return request.raw?.headers.get(name) ?? request.headers?.get(name) ?? request.header(name) ?? null;
}

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

  /**
   * Whether to allow new user registration via sign-up.
   * Set to false to disable public registration.
   * @default true
   */
  signUpEnabled?: boolean;
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
  protected signUpEnabledConfig: boolean;
  public sessionCookieName: string;

  constructor(options: MastraAuthBetterAuthOptions) {
    super({ name: options?.name ?? 'better-auth' });

    if (!options.auth) {
      throw new Error(
        'Better Auth instance is required. Please provide the auth option with your Better Auth instance created via betterAuth({ ... })',
      );
    }

    this.auth = options.auth;
    this.signUpEnabledConfig = options.signUpEnabled ?? true;

    // Derive the session cookie name from Better Auth's cookiePrefix option
    const authWithOptions = this.auth as unknown as { options?: { advanced?: { cookiePrefix?: string } } };
    const prefix = authWithOptions.options?.advanced?.cookiePrefix ?? 'better-auth';
    this.sessionCookieName = `${prefix}.session_token`;

    this.registerOptions(options);
  }

  /**
   * Check if sign-up is enabled.
   * Implements ICredentialsProvider.isSignUpEnabled.
   */
  isSignUpEnabled(): boolean {
    return this.signUpEnabledConfig;
  }

  // ============================================
  // IUserProvider implementation (EE capability)
  // License check happens in buildCapabilities()
  // ============================================

  /**
   * Get current user from request.
   * Implements IUserProvider for EE user awareness in Studio.
   *
   * Supports both cookie-based sessions and `Authorization: Bearer <token>`
   * requests (e.g. API clients using the token returned by `signIn`).
   *
   * @param request - Incoming HTTP request
   * @returns EE User object or null if not authenticated
   */
  async getCurrentUser(request: Request): Promise<EEUser | null> {
    try {
      const headers = new Headers(request.headers);

      // If the request authenticates via Bearer token instead of cookies,
      // convert the token to a signed session cookie so getSession accepts it.
      const authHeader = headers.get('Authorization');
      const bearerToken =
        authHeader && authHeader.slice(0, 7).toLowerCase() === 'bearer ' ? authHeader.slice(7).trim() : undefined;
      await this.ensureSessionCookie(headers, bearerToken);

      const result = await this.auth.api.getSession({
        headers,
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
   * Uses Better Auth's internal adapter to look up the user record,
   * so it works with whichever database Better Auth is configured with.
   *
   * @param userId - User identifier
   * @returns EE User object or null if not found
   */
  async getUser(userId: string): Promise<EEUser | null> {
    try {
      const ctx = await this.getAuthContext();
      if (!ctx) return null;

      const user = await ctx.internalAdapter.findUserById(userId);
      if (!user) return null;
      return mapBetterAuthUserToEEUser(user);
    } catch {
      return null;
    }
  }

  /**
   * Get multiple users by ID.
   * Optional IUserProvider method used for batch author enrichment.
   *
   * @param userIds - User identifiers
   * @returns EE User objects (null for missing users, order preserved)
   */
  async getUsers(userIds: string[]): Promise<Array<EEUser | null>> {
    return Promise.all(userIds.map(userId => this.getUser(userId)));
  }

  /**
   * Get URL to user's profile page.
   * Optional IUserProvider method.
   */
  getUserProfileUrl(user: EEUser): string {
    return `/profile/${user.id}`;
  }

  /**
   * Get the resolved Better Auth context, or null when unavailable
   * (e.g. a partial mock without `$context`).
   */
  private async getAuthContext(): Promise<BetterAuthContext | null> {
    try {
      return (await Promise.resolve(this.auth.$context)) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Ensure the Cookie header on `headers` carries a Better Auth session cookie
   * for the given token.
   *
   * Better Auth's `getSession` reads the session from a *signed* cookie
   * (`<token>.<HMAC-SHA256 signature>`), while `signIn`/`signUp` return the
   * raw unsigned token. Mirroring Better Auth's bearer plugin, unsigned tokens
   * are signed with the instance secret before being set as the session cookie.
   */
  private async ensureSessionCookie(headers: Headers, token: string | undefined): Promise<void> {
    if (!token) return;

    const ctx = await this.getAuthContext();
    const cookieName = ctx?.authCookies.sessionToken.name ?? this.sessionCookieName;
    const secret = ctx?.secret;

    const cookieHeader = headers.get('Cookie');
    const hasSessionCookie = !!cookieHeader?.split(';').some(pair => {
      const [key] = pair.trim().split('=');
      return key?.trim() === cookieName;
    });
    if (hasSessionCookie) return;

    // Tokens containing "." are already signed (and may be URI-encoded).
    let cookieValue = token.includes('.') ? (token.includes('%') ? tryDecode(token) : token) : token;
    if (!token.includes('.') && secret) {
      cookieValue = `${token}.${await makeSignature(token, secret)}`;
    }

    const existingCookies = cookieHeader ? `${cookieHeader}; ` : '';
    headers.set('Cookie', `${existingCookies}${cookieName}=${encodeURIComponent(cookieValue)}`);
  }

  /**
   * Authenticate a bearer token by verifying the session with Better Auth.
   *
   * This method extracts the session from the request headers using
   * Better Auth's `api.getSession()` endpoint. Raw (unsigned) session tokens —
   * as returned by `signIn`/`signUp` — are signed before being passed to
   * Better Auth as a session cookie, matching the bearer plugin's semantics.
   *
   * @param token - The bearer token (session token) to authenticate
   * @param request - The request containing headers
   * @returns The authenticated user and session, or null if authentication fails
   */
  async authenticateToken(token: string, request: MastraAuthRequest): Promise<BetterAuthUser | null> {
    try {
      // Better Auth's api.getSession() reads session tokens from the Cookie header
      const headers = new Headers();

      const cookieHeader = getRequestHeader(request, 'Cookie');
      if (cookieHeader) {
        headers.set('Cookie', cookieHeader);
      }

      // Convert Bearer token to a signed session cookie if not already present.
      // better-auth ignores the Authorization header — it only reads from Cookie.
      await this.ensureSessionCookie(headers, token);

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

  /**
   * Get headers to clear the session cookies on logout.
   * Partial ISessionProvider implementation for logout support.
   *
   * Clears Better Auth's default session cookies.
   */
  getClearSessionHeaders(): Record<string, string> {
    // Clear both the session token and its signature cookie
    const cookies = [
      `${this.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      `${this.sessionCookieName}_sig=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    ];
    return {
      'Set-Cookie': cookies.join(', '),
    };
  }
}
