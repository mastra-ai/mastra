import type {
  AuthInitContext,
  IAuthHttpHandler,
  IAuthInit,
  ICredentialsProvider,
  IOrganizationsProvider,
  IUserProvider,
  CredentialsResult,
} from '@internal/auth';
import type { EEUser } from '@internal/auth/ee';
import type { MastraAuthProviderOptions } from '@internal/auth/provider';
import { MastraAuthProvider } from '@internal/auth/provider';
import { LibsqlDialect } from '@libsql/kysely-libsql';

import { betterAuth } from 'better-auth';
import type { Auth, BetterAuthOptions, Session, User } from 'better-auth';
import { makeSignature } from 'better-auth/crypto';
import { getMigrations } from 'better-auth/db/migration';
import { organization } from 'better-auth/plugins';

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
   *
   * Optional when `secret` is provided: the provider then builds its own
   * `betterAuth()` instance in `init()` on the host's auth database (deferred
   * instance mode) and owns its schema migrations.
   */
  auth?: Auth;

  /**
   * Secret used for session signing by the provider-built `betterAuth()`
   * instance (deferred instance mode). Ignored when `auth` is provided.
   */
  secret?: string;

  /**
   * Whether to allow new user registration via sign-up.
   * Set to false to disable public registration.
   * @default true
   */
  signUpEnabled?: boolean;
}

/** Loose row shapes read back from better-auth's internal DB adapter. */
interface MemberRow {
  organizationId?: string;
  role?: string;
  userId?: string;
}
interface OrganizationRow {
  id: string;
}

/**
 * Tagged auth-database handle shape hosts may pass as `AuthInitContext.database`
 * (e.g. the Mastra Code web factory's storage backends).
 */
interface TaggedAuthDatabase {
  dialect?: string;
  pool?: unknown;
  client?: unknown;
  database?: unknown;
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
  implements IUserProvider<EEUser>, ICredentialsProvider<EEUser>, IOrganizationsProvider, IAuthInit, IAuthHttpHandler
{
  #auth: Auth | undefined;
  #secret: string | undefined;
  /** True when `init()` built the instance — then we also own its migrations. */
  #ownsInstance = false;
  /** Once-per-process migration latch; reset on failure so a later call retries. */
  #migrated: Promise<void> | undefined;
  /** In-process `userId → orgId` cache so hosts can call `ensureOrganization` per request. */
  #orgCache = new Map<string, string>();
  /** Set from `init()`: cross-origin SPA deploys need SameSite=None; Secure cookies. */
  #crossSite = false;
  protected signUpEnabledConfig: boolean;

  constructor(options: MastraAuthBetterAuthOptions) {
    super({ name: options?.name ?? 'better-auth' });

    if (!options.auth && !options.secret) {
      throw new Error(
        'Better Auth instance is required. Please provide the auth option with your Better Auth instance created via betterAuth({ ... }), ' +
          'or provide `secret` so the provider can build its own instance in init() on the host database.',
      );
    }

    this.#auth = options.auth;
    this.#secret = options.secret;
    this.signUpEnabledConfig = options.signUpEnabled ?? true;

    this.registerOptions(options);
  }

  /**
   * The active Better Auth instance. Throws before `init()` in deferred
   * instance mode (constructed with `secret` instead of `auth`).
   */
  protected get auth(): Auth {
    if (!this.#auth) {
      throw new Error(
        'MastraAuthBetterAuth is not initialized — init() must run first (or pass a configured `auth` instance).',
      );
    }
    return this.#auth;
  }

  /**
   * Session cookie name, honoring Better Auth's `cookiePrefix`, a caller
   * override via `advanced.cookies.session_token.name`, and the `__Secure-`
   * prefix Better Auth applies when secure cookies are active.
   */
  get sessionCookieName(): string {
    const options = (this.#auth as { options?: { baseURL?: string; advanced?: Record<string, unknown> } } | undefined)
      ?.options;
    const advanced = options?.advanced as
      | {
          cookiePrefix?: string;
          useSecureCookies?: boolean;
          cookies?: { session_token?: { name?: string } };
        }
      | undefined;
    const prefix = advanced?.cookiePrefix ?? 'better-auth';
    const secure = advanced?.useSecureCookies ?? options?.baseURL?.startsWith('https://') ?? false;
    const baseName = advanced?.cookies?.session_token?.name ?? `${prefix}.session_token`;
    return `${secure ? '__Secure-' : ''}${baseName}`;
  }

  // ============================================
  // IAuthInit implementation
  // ============================================

  /**
   * One-time host initialization. In deferred instance mode (no `auth` in the
   * options) this builds the provider-owned `betterAuth()` instance on the
   * host's auth database; schema migrations then run lazily behind a
   * once-per-process latch on first use.
   *
   * Bring-your-own `auth` instances skip construction entirely — the caller
   * owns their database and migrations.
   */
  async init(ctx: AuthInitContext): Promise<void> {
    this.#crossSite = (ctx.allowedOrigins?.length ?? 0) > 0;
    if (this.#auth) return; // bring-your-own instance: nothing to build

    const authDb = ctx.database as TaggedAuthDatabase | undefined;
    if (!authDb) {
      throw new Error(
        'MastraAuthBetterAuth needs a database to build its own better-auth instance, but the host passed none. ' +
          'Use a storage backend that exposes an auth database, or pass your own configured `auth` instance.',
      );
    }
    // Map the host's tagged auth-database handle onto better-auth's `database`
    // option: pg pool directly, libsql via its kysely dialect, anything else
    // passed through as-is (the host owns its compatibility).
    const database: BetterAuthOptions['database'] =
      authDb.dialect === 'postgres'
        ? (authDb.pool as Extract<BetterAuthOptions['database'], { query: unknown }>)
        : authDb.dialect === 'libsql'
          ? {
              dialect: new LibsqlDialect({ client: authDb.client } as ConstructorParameters<typeof LibsqlDialect>[0]),
              type: 'sqlite' as const,
            }
          : (authDb.database as BetterAuthOptions['database']);
    const allowedOrigins = ctx.allowedOrigins ?? [];
    // Widen to BetterAuthOptions before calling betterAuth(): its return type
    // is generic over the exact options object, which would make the instance
    // incompatible with the plain `Auth` alias we store.
    const options: BetterAuthOptions = {
      database,
      secret: this.#secret,
      // All provider endpoints (sign-in/up/out/session) live under /auth/api/*,
      // where hosts mount handleAuthRequest.
      basePath: '/auth/api',
      ...(ctx.publicUrl ? { baseURL: ctx.publicUrl } : {}),
      // Cross-origin SPA deploys: SameSite=None only lets the browser SEND the
      // cookie — better-auth still rejects requests from origins outside its
      // own allow-list, so the SPA origins must be trusted too.
      ...(allowedOrigins.length ? { trustedOrigins: allowedOrigins } : {}),
      emailAndPassword: { enabled: true, disableSignUp: !this.signUpEnabledConfig },
      plugins: [organization()],
      // Cross-origin SPA deploys need SameSite=None; Secure for the browser to
      // send the session cookie.
      ...(this.#crossSite ? { advanced: { defaultCookieAttributes: { sameSite: 'none', secure: true } } } : {}),
    };
    this.#auth = betterAuth(options);
    this.#ownsInstance = true;
  }

  /**
   * Ensure better-auth's tables exist in the host database. Only for instances
   * this provider built — bring-your-own instances manage their own migrations.
   */
  async #ensureDbReady(): Promise<void> {
    if (!this.#ownsInstance) return;
    this.#migrated ??= (async () => {
      const { runMigrations } = await getMigrations(this.auth.options as BetterAuthOptions);
      await runMigrations();
    })();
    try {
      await this.#migrated;
    } catch (error) {
      this.#migrated = undefined; // allow a later call to retry
      console.warn('[BetterAuth] Failed to run auth schema migrations; auth stays unavailable until this succeeds.');
      throw error;
    }
  }

  // ============================================
  // IAuthHttpHandler implementation
  // ============================================

  /**
   * Proxy a raw HTTP request to Better Auth's own API surface
   * (sign-in/up/out/session). Hosts mount this under `/auth/api/*`.
   */
  async handleAuthRequest(request: Request): Promise<Response> {
    try {
      await this.#ensureDbReady();
    } catch {
      return new Response(JSON.stringify({ error: 'auth_unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }
    return this.auth.handler(request);
  }

  // ============================================
  // IOrganizationsProvider implementation
  // ============================================

  /**
   * Ensure the user belongs to an organization, mirroring the WorkOS
   * personal-org bootstrap on better-auth's organization tables:
   * ≥1 membership → first org id; 0 → create a personal org with an
   * idempotent slug derived from the user id.
   *
   * Concurrent/retried first logins recover via the unique slug instead of
   * creating duplicates. Slug alone is NOT proof of ownership though: the
   * organization API is reachable by any authenticated user, so an attacker
   * could squat `personal-<victimId>`. The slug-matched org is only adopted
   * when nobody else is a member; otherwise a fresh org with an unguessable
   * slug is created instead.
   *
   * Best-effort: any failure is swallowed and leaves the user no-org.
   */
  async ensureOrganization(userId: string): Promise<string | undefined> {
    const cached = this.#orgCache.get(userId);
    if (cached) return cached;

    try {
      await this.#ensureDbReady();
      const ctx = await this.getAuthContext();
      if (!ctx) return undefined;

      const memberships = (await ctx.adapter.findMany({
        model: 'member',
        where: [{ field: 'userId', value: userId }],
      })) as MemberRow[];
      const firstExisting = memberships.find(m => m.organizationId)?.organizationId;
      if (firstExisting) {
        this.#orgCache.set(userId, firstExisting);
        return firstExisting;
      }

      // Build a predictable personal-org name from the user's profile.
      const userRecord = await ctx.internalAdapter.findUserById(userId).catch(() => null);
      const label = userRecord?.email ?? userRecord?.name ?? userId;
      const orgName = `${label}'s org`;
      const orgData = () => ({
        name: orgName,
        createdAt: new Date(),
        metadata: JSON.stringify({ mastraPersonalOrg: 'true' }),
      });

      // Create the personal org. The slug is derived from the user id, so a
      // concurrent/prior bootstrap that already created it makes the insert
      // reject on the unique slug — recover by looking the org up instead.
      const slug = `personal-${userId}`;
      let organizationId: string;
      try {
        const created = (await ctx.adapter.create({
          model: 'organization',
          data: { ...orgData(), slug },
        })) as OrganizationRow;
        organizationId = created.id;
      } catch (error) {
        const existing = (await ctx.adapter.findOne({
          model: 'organization',
          where: [{ field: 'slug', value: slug }],
        })) as OrganizationRow | null;
        if (!existing) throw error;
        // Only adopt the slug-matched org when nobody else is a member (zero
        // members = a concurrent bootstrap of this same user that hasn't
        // attached yet). Otherwise fall back to an unguessable slug.
        const existingMembers = (await ctx.adapter.findMany({
          model: 'member',
          where: [{ field: 'organizationId', value: existing.id }],
        })) as MemberRow[];
        const foreignMember = existingMembers.some(m => m.userId !== userId);
        if (foreignMember) {
          const fallback = (await ctx.adapter.create({
            model: 'organization',
            data: { ...orgData(), slug: `personal-${userId}-${crypto.randomUUID()}` },
          })) as OrganizationRow;
          organizationId = fallback.id;
        } else {
          organizationId = existing.id;
        }
      }

      // Idempotently attach the user: tolerate a membership a concurrent
      // bootstrap already created.
      try {
        await ctx.adapter.create({
          model: 'member',
          data: { organizationId, userId, role: 'owner', createdAt: new Date() },
        });
      } catch (error) {
        const member = await ctx.adapter.findOne({
          model: 'member',
          where: [
            { field: 'organizationId', value: organizationId },
            { field: 'userId', value: userId },
          ],
        });
        if (!member) throw error;
      }

      this.#orgCache.set(userId, organizationId);
      return organizationId;
    } catch (error) {
      console.warn(
        `[BetterAuth] Failed to bootstrap personal organization for user ${userId}. ` +
          'The user will see organization_required until this succeeds.',
        error,
      );
      return undefined;
    }
  }

  /**
   * Whether the user holds an admin-equivalent role (`owner` or `admin`) in
   * the organization. Provider errors resolve to `false`.
   */
  async isOrganizationAdmin(organizationId: string, userId: string): Promise<boolean> {
    try {
      await this.#ensureDbReady();
      const ctx = await this.getAuthContext();
      if (!ctx) return false;
      const membership = (await ctx.adapter.findOne({
        model: 'member',
        where: [
          { field: 'organizationId', value: organizationId },
          { field: 'userId', value: userId },
        ],
      })) as MemberRow | null;
      return membership?.role === 'owner' || membership?.role === 'admin';
    } catch {
      return false;
    }
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
      await this.#ensureDbReady();
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
      await this.#ensureDbReady();

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
    // Cross-site deploys set the session cookie with SameSite=None; Secure —
    // the clearing cookie must match those attributes to overwrite it.
    const sameSite = this.#crossSite ? 'None; Secure' : 'Lax';
    // Clear both the session token and its signature cookie
    const cookies = [
      `${this.sessionCookieName}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0`,
      `${this.sessionCookieName}_sig=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0`,
    ];
    return {
      'Set-Cookie': cookies.join(', '),
    };
  }
}
