import type {
  IUserProvider,
  ICredentialsProvider,
  ISessionProvider,
  MastraAuthRequest,
  Session,
  CredentialsResult,
} from '@mastra/core/auth';
import { getRequestHeader } from '@mastra/core/auth';
import type { EEUser } from '@mastra/core/auth/ee';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

import { linkNeonUser, readCookie, rememberSessionCookie, stripTrailingSlashes } from './session-cookie';

export { MastraRBACNeon } from './rbac-provider';
export type { MastraRBACNeonOptions, NeonRoleMappingOptions } from './rbac-provider';

/** Cookie name Neon Auth uses for the signed session token. */
export const NEON_AUTH_SESSION_COOKIE = '__Secure-neon-auth.session_token';

function parseSetCookies(response: Response): string[] {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*[^;,\s]+=)/).map(cookie => cookie.trim());
}

function isJwtShaped(token: string): boolean {
  return token.split('.').length === 3;
}

/**
 * Response shape from the Neon Auth `get-session` endpoint.
 */
export interface NeonSessionResponse {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    activeOrganizationId?: string | null;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
    /** Neon Auth user role (for example `user` or `admin`). Not present for JWT-authenticated requests. */
    role?: string | null;
  };
}

/**
 * User type returned by the adapter's authenticateToken.
 * Contains the session and user data from Neon Auth,
 * plus the verified JWT claims when authenticated via bearer JWT.
 */
export interface NeonAuthUser {
  /** Neon Auth user ID. Mastra RBAC and FGA identify users by this top-level field. */
  id: string;
  email: string;
  name: string;
  session?: NeonSessionResponse['session'];
  user: NeonSessionResponse['user'];
  jwt?: JWTPayload;
}

export function mapNeonUserToEEUser(user: NeonSessionResponse['user']): EEUser {
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

export interface MastraAuthNeonOptions extends MastraAuthProviderOptions<NeonAuthUser> {
  /**
   * The Neon Auth URL, as shown in the Neon Console under **Auth > Configuration**
   * (for example `https://ep-xxx.neonauth.us-east-2.aws.neon.tech/neondb/auth`).
   * Falls back to the `NEON_AUTH_BASE_URL` environment variable.
   */
  baseUrl?: string;
  /**
   * JWKS URL for JWT verification.
   * Falls back to the `NEON_AUTH_JWKS_URL` environment variable, then `<baseUrl>/.well-known/jwks.json`.
   */
  jwksUrl?: string;
  /**
   * Name of the Neon Auth session cookie.
   * @default '__Secure-neon-auth.session_token'
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
 * - Session cookie verification via the Neon Auth API (for Studio)
 * - Email/password sign-in and sign-up (for the Studio credentials flow)
 * - Session validation and sign-out
 *
 * @example
 * ```typescript
 * import { MastraAuthNeon } from '@mastra/auth-neon';
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthNeon({
 *       baseUrl: process.env.NEON_AUTH_BASE_URL,
 *     }),
 *   },
 * });
 * ```
 *
 * @see https://neon.com/docs/auth/overview
 */
export class MastraAuthNeon
  extends MastraAuthProvider<NeonAuthUser>
  implements IUserProvider<EEUser>, ICredentialsProvider<EEUser>, ISessionProvider<Session>
{
  protected baseUrl: string;
  protected jwksUrl: string;
  /** Origin of the Neon Auth URL. Neon Auth issues JWTs with this as `iss` and `aud`. */
  protected issuer: string;
  public sessionCookieName: string;
  protected signUpEnabledConfig: boolean;
  private jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

  constructor(options?: MastraAuthNeonOptions) {
    super({ name: options?.name ?? 'neon' });

    const baseUrl = options?.baseUrl ?? process.env.NEON_AUTH_BASE_URL;

    if (!baseUrl) {
      throw new Error(
        'Neon Auth base URL is required, please provide it in the options or set the NEON_AUTH_BASE_URL environment variable',
      );
    }

    this.baseUrl = stripTrailingSlashes(baseUrl);
    this.issuer = new URL(this.baseUrl).origin;
    this.jwksUrl = options?.jwksUrl ?? process.env.NEON_AUTH_JWKS_URL ?? `${this.baseUrl}/.well-known/jwks.json`;
    this.sessionCookieName = options?.sessionCookieName ?? NEON_AUTH_SESSION_COOKIE;
    this.signUpEnabledConfig = options?.signUpEnabled ?? true;

    this.registerOptions(options);
  }

  /** Expose the base URL for RBAC or other consumers. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  isSignUpEnabled(): boolean {
    return this.signUpEnabledConfig;
  }

  // ── IUserProvider ──

  async getCurrentUser(request: Request): Promise<EEUser | null> {
    const authorization = request.headers.get('Authorization');
    const bearer = authorization?.replace(/^Bearer\s+/i, '').trim() ?? '';
    const result = await this.authenticateToken(bearer, request);
    if (!result) return null;
    const user = mapNeonUserToEEUser(result.user);
    linkNeonUser(user, result);
    return user;
  }

  async getUser(_userId: string): Promise<EEUser | null> {
    return null;
  }

  getUserProfileUrl(user: EEUser): string {
    return `/profile/${user.id}`;
  }

  // ── MastraAuthProvider ──

  /**
   * Authenticates a request.
   *
   * - A JWT-shaped bearer token is verified against the Neon Auth JWKS
   *   (signature, issuer, audience, and expiry).
   * - Otherwise the Neon Auth session cookie is validated with `get-session`.
   *   The cookie comes from the request, or from `token` when an API client
   *   sends the session cookie value as a bearer token.
   */
  async authenticateToken(token: string, request: MastraAuthRequest): Promise<NeonAuthUser | null> {
    const bearer = typeof token === 'string' ? token.trim() : '';
    const requestCookie = readCookie(getRequestHeader(request, 'Cookie'), this.sessionCookieName);

    let cookieValue: string | null;
    if (bearer && isJwtShaped(bearer)) {
      const payload = await this.verifyJwt(bearer);
      if (payload) return this.userFromJwt(payload);
      // An expired or invalid JWT shouldn't sign out a client that also
      // sends a valid session cookie (for example MastraClient with both).
      cookieValue = requestCookie;
    } else {
      cookieValue = requestCookie ?? (bearer || null);
    }

    // Reject values that would add extra cookies to the Neon Auth request.
    if (!cookieValue || !/^[^\s;,]+$/.test(cookieValue)) return null;

    const sessionCookie = `${this.sessionCookieName}=${cookieValue}`;
    const result = await this.fetchSession(sessionCookie);
    if (!result) return null;

    const user: NeonAuthUser = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      session: result.session,
      user: result.user,
    };
    rememberSessionCookie(user, sessionCookie);
    return user;
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
    return this.credentialsRequest('/sign-in/email', { email, password }, request, 'Invalid email or password');
  }

  async signUp(
    email: string,
    password: string,
    name: string | undefined,
    request: Request,
  ): Promise<CredentialsResult<EEUser>> {
    // Mastra's sign-up route doesn't check isSignUpEnabled(), so enforce it here.
    // Otherwise `signUpEnabled: false` only hides the form in Studio.
    if (!this.signUpEnabledConfig) {
      throw new Error('Sign up is disabled');
    }
    const displayName = name || email.split('@')[0] || 'User';
    return this.credentialsRequest(
      '/sign-up/email',
      { email, password, name: displayName },
      request,
      'Failed to create account',
    );
  }

  // ── ISessionProvider ──

  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      expiresAt,
      metadata,
    };
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    const result = await this.fetchSession(`${this.sessionCookieName}=${sessionId}`);
    if (!result) return null;

    return {
      id: result.session.id,
      userId: result.session.userId,
      expiresAt: new Date(result.session.expiresAt),
      createdAt: new Date(result.session.createdAt),
    };
  }

  /** Revokes the session in Neon Auth. */
  async destroySession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Neon Auth rejects cookie-authenticated POSTs without a trusted Origin.
          // Its own origin is always trusted, and no browser origin is available here.
          Origin: this.issuer,
          Cookie: `${this.sessionCookieName}=${sessionId}`,
        },
        body: '{}',
      });
    } catch {
      // Clearing the local cookie still signs the user out of Mastra.
    }
  }

  async refreshSession(sessionId: string): Promise<Session | null> {
    // Neon Auth extends sessions itself when get-session is called.
    return this.validateSession(sessionId);
  }

  getSessionIdFromRequest(request: Request): string | null {
    return readCookie(request.headers.get('Cookie'), this.sessionCookieName);
  }

  getSessionHeaders(session: Session): Record<string, string> {
    const cookie = (session as unknown as Record<string, unknown>)._sessionCookie;
    if (typeof cookie === 'string') {
      return { 'Set-Cookie': cookie };
    }
    return {};
  }

  getClearSessionHeaders(): Record<string, string> {
    // Attributes must match the cookie Neon Auth set, or the browser keeps it.
    const secure = this.sessionCookieName.startsWith('__Secure-') || this.sessionCookieName.startsWith('__Host-');
    const attributes = secure
      ? 'Path=/; HttpOnly; Secure; SameSite=None; Partitioned'
      : 'Path=/; HttpOnly; SameSite=Lax';
    return {
      'Set-Cookie': `${this.sessionCookieName}=; ${attributes}; Max-Age=0`,
    };
  }

  // ── Internal helpers ──

  private async credentialsRequest(
    path: string,
    body: Record<string, string>,
    request: Request | undefined,
    fallbackError: string,
  ): Promise<CredentialsResult<EEUser>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.credentialsHeaders(request),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorData.message || fallbackError);
    }

    const result = (await response.json()) as { user?: NeonSessionResponse['user'] };
    if (!result?.user) {
      throw new Error(fallbackError);
    }

    const cookies = parseSetCookies(response);
    const sessionCookie = cookies
      .map(cookie => cookie.split(';')[0]!)
      .find(pair => pair.startsWith(`${this.sessionCookieName}=`));

    return {
      user: mapNeonUserToEEUser(result.user),
      // The raw session token in Neon's response is unsigned and is rejected by
      // Neon Auth, so hand API clients a JWT they can send as a bearer token.
      token: sessionCookie ? await this.fetchJwt(sessionCookie) : undefined,
      cookies,
    };
  }

  /**
   * Builds headers for Neon Auth credential endpoints.
   *
   * Only safe headers are forwarded. Copying every incoming header would send
   * the Mastra server's Host and Content-Length (which do not match the new
   * request) along with unrelated cookies and credentials.
   */
  private credentialsHeaders(request: Request | undefined): Headers {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const origin = request?.headers.get('Origin') ?? (request?.url ? new URL(request.url).origin : this.issuer);
    headers.set('Origin', origin);
    const userAgent = request?.headers.get('User-Agent');
    if (userAgent) headers.set('User-Agent', userAgent);
    return headers;
  }

  private async fetchJwt(sessionCookie: string): Promise<string | undefined> {
    try {
      const response = await fetch(`${this.baseUrl}/token`, { headers: { Cookie: sessionCookie } });
      if (!response.ok) return undefined;
      const data = (await response.json()) as { token?: string };
      return data.token || undefined;
    } catch {
      return undefined;
    }
  }

  private userFromJwt(payload: JWTPayload): NeonAuthUser | null {
    const id = payload.sub ?? (typeof payload.id === 'string' ? payload.id : undefined);
    if (!id) return null;
    const str = (value: unknown) => (typeof value === 'string' ? value : '');

    return {
      id,
      email: str(payload.email),
      name: str(payload.name),
      user: {
        id,
        email: str(payload.email),
        name: str(payload.name),
        image: typeof payload.image === 'string' ? payload.image : null,
        emailVerified: payload.emailVerified === true,
        createdAt: str(payload.createdAt) || (payload.iat ? new Date(payload.iat * 1000).toISOString() : ''),
        updatedAt: str(payload.updatedAt),
        // The JWT `role` claim is the Postgres role for the Data API
        // (`authenticated`), not the user's Neon Auth role, so it is not mapped.
      },
      jwt: payload,
    };
  }

  private async verifyJwt(token: string): Promise<JWTPayload | null> {
    try {
      this.jwks ??= createRemoteJWKSet(new URL(this.jwksUrl));
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.issuer,
      });
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Fetch and validate a session from the Neon Auth `get-session` endpoint.
   * Accepts a Cookie header value containing the Neon Auth session cookie,
   * or a Headers object whose Cookie header contains it.
   */
  public async fetchSession(cookieOrHeaders: string | Headers): Promise<NeonSessionResponse | null> {
    const cookie = typeof cookieOrHeaders === 'string' ? cookieOrHeaders : cookieOrHeaders.get('Cookie');
    if (!cookie) return null;
    try {
      const response = await fetch(`${this.baseUrl}/get-session`, {
        method: 'GET',
        headers: { Cookie: cookie },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as NeonSessionResponse | null;
      if (!data?.session || !data?.user) return null;

      return data;
    } catch {
      return null;
    }
  }
}
