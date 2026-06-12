import type { IUserProvider, ICredentialsProvider, CredentialsResult } from '@mastra/core/auth';
import type { EEUser } from '@mastra/core/auth/ee';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

type HonoRequestLike = {
  raw?: Request;
  headers?: Headers;
  header(name: string): string | undefined;
};

type MastraAuthRequest = Request | HonoRequestLike;

function getRequestHeader(request: MastraAuthRequest, name: string): string | null {
  if (request instanceof Request) {
    return request.headers.get(name);
  }
  return request.raw?.headers.get(name) ?? request.headers?.get(name) ?? request.header(name) ?? null;
}

/**
 * Response shape from Neon Auth session endpoint.
 */
interface NeonSessionResponse {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * User type returned by the adapter's authenticateToken.
 * Contains the session and user data from Neon Auth,
 * plus optional JWT claims when authenticated via bearer JWT.
 */
export interface NeonAuthUser {
  session?: NeonSessionResponse['session'];
  user: NeonSessionResponse['user'];
  jwt?: JWTPayload;
}

function mapToEEUser(user: NeonSessionResponse['user']): EEUser {
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

interface MastraAuthNeonOptions extends MastraAuthProviderOptions<NeonAuthUser> {
  /**
   * The Neon Auth base URL (e.g., `https://your-project.neon.tech`).
   * Falls back to the `NEON_AUTH_BASE_URL` environment variable.
   */
  baseUrl?: string;
  /**
   * Explicit JWKS URL for JWT token verification.
   * Overrides the URL derived from `baseUrl`.
   * Falls back to the `NEON_AUTH_JWKS_URL` environment variable.
   */
  jwksUrl?: string;
  /**
   * The session cookie name used by Neon Auth.
   * @default 'neonauth.session_token'
   */
  sessionCookieName?: string;
  /**
   * Whether to allow new user registration via sign-up.
   * @default true
   */
  signUpEnabled?: boolean;
}

/**
 * Mastra authentication provider for Neon Auth.
 *
 * Neon Auth is a managed authentication service built on Better Auth
 * that stores users, sessions, and auth configuration directly in your
 * Neon Postgres database.
 *
 * This adapter supports:
 * - JWT bearer token verification via JWKS (for API clients)
 * - Session cookie verification via Neon Auth REST API (for Studio)
 * - Email/password sign-in and sign-up (for Studio credentials flow)
 *
 * @example
 * ```typescript
 * import { MastraAuthNeon } from '@mastra/auth-neon';
 *
 * const auth = new MastraAuthNeon({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL,
 * });
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth,
 *   },
 * });
 * ```
 *
 * @see https://neon.com/docs/auth/overview
 */
export class MastraAuthNeon
  extends MastraAuthProvider<NeonAuthUser>
  implements IUserProvider<EEUser>, ICredentialsProvider<EEUser>
{
  protected baseUrl: string;
  protected jwksUrl: string;
  public sessionCookieName: string;
  protected signUpEnabledConfig: boolean;

  constructor(options?: MastraAuthNeonOptions) {
    super({ name: options?.name ?? 'neon' });

    const baseUrl = options?.baseUrl ?? process.env.NEON_AUTH_BASE_URL;

    if (!baseUrl) {
      throw new Error(
        'Neon Auth base URL is required, please provide it in the options or set the NEON_AUTH_BASE_URL environment variable',
      );
    }

    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.jwksUrl = options?.jwksUrl ?? process.env.NEON_AUTH_JWKS_URL ?? `${this.baseUrl}/auth/jwks`;
    this.sessionCookieName = options?.sessionCookieName ?? 'neonauth.session_token';
    this.signUpEnabledConfig = options?.signUpEnabled ?? true;

    this.registerOptions(options);
  }

  isSignUpEnabled(): boolean {
    return this.signUpEnabledConfig;
  }

  // ── IUserProvider ──

  async getCurrentUser(request: Request): Promise<EEUser | null> {
    try {
      const result = await this.verifySession(request.headers);
      if (!result?.user) return null;
      return mapToEEUser(result.user);
    } catch {
      return null;
    }
  }

  async getUser(_userId: string): Promise<EEUser | null> {
    return null;
  }

  getUserProfileUrl(user: EEUser): string {
    return `/profile/${user.id}`;
  }

  // ── MastraAuthProvider ──

  async authenticateToken(token: string, request: MastraAuthRequest): Promise<NeonAuthUser | null> {
    if (!token || typeof token !== 'string') {
      return null;
    }

    // Try JWT verification first (for bearer JWT tokens from API clients).
    const jwtResult = await this.verifyJwt(token);
    if (jwtResult) {
      return {
        user: {
          id: jwtResult.sub ?? '',
          email: (jwtResult.email as string) ?? '',
          name: (jwtResult.name as string) ?? '',
          image: (jwtResult.picture as string) ?? null,
          emailVerified: (jwtResult.email_verified as boolean) ?? false,
          createdAt: jwtResult.iat ? new Date(jwtResult.iat * 1000).toISOString() : '',
          updatedAt: '',
        },
        jwt: jwtResult,
      };
    }

    // Fall back to session cookie verification via Neon Auth API.
    try {
      const headers = new Headers();

      const cookieHeader = getRequestHeader(request, 'Cookie');
      if (cookieHeader) {
        headers.set('Cookie', cookieHeader);
      }

      const hasSessionCookie = !!cookieHeader
        ?.split(';')
        .some(pair => pair.trim().split('=')[0]?.trim() === this.sessionCookieName);

      if (token && !hasSessionCookie) {
        const existingCookies = cookieHeader ? `${cookieHeader}; ` : '';
        headers.set('Cookie', `${existingCookies}${this.sessionCookieName}=${token}`);
      }

      const result = await this.verifySession(headers);
      if (!result?.session || !result?.user) {
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

  async authorizeUser(user: NeonAuthUser): Promise<boolean> {
    if (!user?.user?.id) return false;

    if (user.jwt?.exp && user.jwt.exp * 1000 < Date.now()) {
      return false;
    }

    return true;
  }

  // ── ICredentialsProvider ──

  async signIn(email: string, password: string, request: Request): Promise<CredentialsResult<EEUser>> {
    const response = await fetch(`${this.baseUrl}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request?.headers ? Object.fromEntries(request.headers.entries()) : {}),
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorData.message || 'Invalid email or password');
    }

    const result = (await response.json()) as { user?: NeonSessionResponse['user']; token?: string | null };

    if (!result?.user) {
      throw new Error('Invalid email or password');
    }

    const cookies: string[] = [];
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      cookies.push(...setCookieHeader.split(/,(?=\s*\w+=)/));
    }

    return {
      user: mapToEEUser(result.user),
      token: result.token ?? undefined,
      cookies,
    };
  }

  async signUp(
    email: string,
    password: string,
    name: string | undefined,
    request: Request,
  ): Promise<CredentialsResult<EEUser>> {
    const displayName = name ?? email.split('@')[0] ?? 'User';

    const response = await fetch(`${this.baseUrl}/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request?.headers ? Object.fromEntries(request.headers.entries()) : {}),
      },
      body: JSON.stringify({ email, password, name: displayName }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorData.message || 'Failed to create account');
    }

    const result = (await response.json()) as { user?: NeonSessionResponse['user']; token?: string | null };

    if (!result?.user) {
      throw new Error('Failed to create account');
    }

    const cookies: string[] = [];
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      cookies.push(...setCookieHeader.split(/,(?=\s*\w+=)/));
    }

    return {
      user: mapToEEUser(result.user),
      token: result.token ?? undefined,
      cookies,
    };
  }

  /**
   * Get headers to clear the session cookies on logout.
   */
  getClearSessionHeaders(): Record<string, string> {
    const cookies = [
      `${this.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      `${this.sessionCookieName}_sig=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    ];
    return {
      'Set-Cookie': cookies.join(', '),
    };
  }

  // ── Internal helpers ──

  private async verifyJwt(token: string): Promise<JWTPayload | null> {
    try {
      const JWKS = createRemoteJWKSet(new URL(this.jwksUrl));
      const { payload } = await jwtVerify(token, JWKS);
      return payload;
    } catch {
      return null;
    }
  }

  private async verifySession(headers: Headers): Promise<NeonSessionResponse | null> {
    const response = await fetch(`${this.baseUrl}/auth/get-session`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as NeonSessionResponse | null;
    if (!data?.session || !data?.user) {
      return null;
    }

    return data;
  }
}
