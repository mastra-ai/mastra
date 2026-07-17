import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { organization } from 'better-auth/plugins';

import { PostgresStore } from '@mastra/pg';

import type { AuthRouteSpec, WebAuthAdapter, WebAuthAdapterInitContext, WebAuthUser } from './auth-adapter.js';
import { isCrossSiteAuth, sanitizeReturnTo } from './auth-adapter.js';

/**
 * Self-hosted better-auth implementation of {@link WebAuthAdapter}.
 *
 * Email/password auth on the app's own Postgres — no external identity vendor
 * in the availability path. Org tenancy comes from better-auth's organization
 * plugin: `ensureOrg` mirrors the WorkOS personal-org bootstrap, so the tenant
 * identity `(orgId, userId)` resolves exactly like it does under WorkOS and
 * all org-scoped routes work unchanged.
 *
 * Two construction modes:
 * - Default: pass `secret` and the adapter builds its own `betterAuth()`
 *   instance in `init()` on the shared pg pool of the factory's injected
 *   storage (`ctx.storage`), running better-auth's programmatic migrations
 *   behind a once-per-process latch.
 * - Bring-your-own: pass a fully-configured `instance`; the adapter mounts it
 *   as-is and leaves database/migrations to the caller.
 */

/** A configured better-auth instance (the result of `betterAuth({ ... })`). */
export type BetterAuthInstance = ReturnType<typeof betterAuth>;

export interface BetterAuthWebAuthOptions {
  /** Secret used by the default `betterAuth()` instance for session signing. */
  secret?: string;
  /** Fully-configured `betterAuth()` instance; skips the default construction in `init()`. */
  instance?: BetterAuthInstance;
  /** Disable public email/password sign-up (default instance only). */
  signUpDisabled?: boolean;
}

/** Build a predictable personal-org name from the user's profile. */
function personalOrgName(user: WebAuthUser, userId: string): string {
  const label = user.email ?? user.name ?? userId;
  return `${label}'s org`;
}

/** Loose row shapes read back from better-auth's internal DB adapter. */
interface MemberRow {
  organizationId?: string;
}
interface OrganizationRow {
  id: string;
}

export class BetterAuthWebAuth implements WebAuthAdapter {
  readonly kind = 'better-auth';

  #secret: string | undefined;
  #signUpDisabled: boolean;
  #instance: BetterAuthInstance | undefined;
  /** True when `init()` built the instance — then we also own its migrations. */
  #ownsInstance = false;
  /** Once-per-process migration latch; reset on failure so a later call retries. */
  #migrated: Promise<void> | undefined;
  /** In-process `userId → orgId` cache so the gate doesn't hit the DB per request. */
  #orgCache = new Map<string, string>();

  constructor(options: BetterAuthWebAuthOptions = {}) {
    if (!options.secret && !options.instance) {
      throw new Error(
        'BetterAuthWebAuth requires either `secret` (the adapter builds its own better-auth instance on the factory database) or a fully-configured `instance`.',
      );
    }
    this.#secret = options.secret;
    this.#signUpDisabled = options.signUpDisabled ?? false;
    this.#instance = options.instance;
  }

  /** Surfaced through `/auth/me` so the SPA hides the sign-up form when disabled. */
  get signUpDisabled(): boolean {
    return this.#signUpDisabled;
  }

  /** The active better-auth instance. Throws before `init()` on the default path. */
  get instance(): BetterAuthInstance {
    if (!this.#instance) {
      throw new Error(
        'BetterAuthWebAuth is not initialized — MastraFactory.prepare() must run first (or pass a configured `instance`).',
      );
    }
    return this.#instance;
  }

  async init(ctx: WebAuthAdapterInitContext): Promise<void> {
    if (this.#instance) return; // bring-your-own instance: nothing to build
    const pool = ctx.storage instanceof PostgresStore ? ctx.storage.pool : undefined;
    if (!pool) {
      throw new Error(
        'BetterAuthWebAuth needs a Postgres database: configure the MastraFactory `storage` slot with a PostgresStore (or pass your own better-auth `instance`).',
      );
    }
    const crossSite = isCrossSiteAuth();
    const allowedOrigins = ctx.allowedOrigins ?? [];
    // Widen to BetterAuthOptions before calling betterAuth(): its return type
    // is generic over the exact options object, which would make the instance
    // incompatible with the plain `Auth<BetterAuthOptions>` alias we expose.
    const options: BetterAuthOptions = {
      database: pool,
      secret: this.#secret,
      // All provider endpoints (sign-in/up/out/session) live under /auth/api/*,
      // which the gate treats as public like every /auth/* path.
      basePath: '/auth/api',
      ...(ctx.publicUrl ? { baseURL: ctx.publicUrl } : {}),
      // Cross-origin SPA deploys: SameSite=None only lets the browser SEND the
      // cookie — better-auth still rejects requests from origins outside its
      // own allow-list, so the SPA origins must be trusted too.
      ...(allowedOrigins.length ? { trustedOrigins: allowedOrigins } : {}),
      emailAndPassword: { enabled: true, disableSignUp: this.#signUpDisabled },
      plugins: [organization()],
      // Cross-origin SPA deploys need SameSite=None; Secure for the browser to
      // send the session cookie (see isCrossSiteAuth).
      ...(crossSite ? { advanced: { defaultCookieAttributes: { sameSite: 'none', secure: true } } } : {}),
    };
    this.#instance = betterAuth(options);
    this.#ownsInstance = true;
  }

  /**
   * Session cookie name, honoring better-auth's `cookiePrefix`, a caller
   * override via `advanced.cookies.session_token.name` (bring-your-own
   * instances), and the `__Secure-` prefix it applies when secure cookies are
   * active.
   */
  #sessionCookieName(): string {
    const options = (this.#instance as { options?: { baseURL?: string; advanced?: Record<string, unknown> } })?.options;
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

  /**
   * Ensure better-auth's tables exist in the app database. Only for instances
   * this adapter built — bring-your-own instances manage their own migrations.
   */
  async #ensureDbReady(): Promise<void> {
    if (!this.#ownsInstance) return;
    this.#migrated ??= (async () => {
      const { runMigrations } = await getMigrations(this.instance.options);
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

  async authenticate(token: string, raw: Request): Promise<WebAuthUser | null> {
    try {
      await this.#ensureDbReady();

      // better-auth only reads the session from the Cookie header, so synthesize
      // a session cookie from a bearer token when no session cookie is present
      // (same approach as @mastra/auth-better-auth).
      const headers = new Headers();
      const cookieHeader = raw.headers.get('Cookie');
      if (cookieHeader) headers.set('Cookie', cookieHeader);
      const cookieName = this.#sessionCookieName();
      const hasSessionCookie = Boolean(
        cookieHeader?.split(';').some(pair => pair.trim().split('=')[0]?.trim() === cookieName),
      );
      if (token && !hasSessionCookie) {
        headers.set('Cookie', `${cookieHeader ? `${cookieHeader}; ` : ''}${cookieName}=${token}`);
      }

      const result = await this.instance.api.getSession({ headers });
      if (!result?.user) return null;

      const session = result.session as { activeOrganizationId?: string | null } | undefined;
      const organizationId = session?.activeOrganizationId ?? this.#orgCache.get(result.user.id);
      return {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name ?? undefined,
        ...(organizationId ? { organizationId } : {}),
      };
    } catch {
      // Ordinary invalid/expired sessions (and transient DB failures) read as
      // unauthenticated rather than failing the request.
      return null;
    }
  }

  /**
   * Mirror the WorkOS personal-org bootstrap on better-auth's organization
   * tables: ≥1 membership → first org id; 0 → create a personal org with an
   * idempotent slug derived from the user id. Concurrent/retried first logins
   * recover via the unique slug instead of creating duplicates. Best-effort:
   * any failure is swallowed and leaves the user no-org (same as WorkOS).
   */
  async ensureOrg(user: WebAuthUser): Promise<string | undefined> {
    if (user.organizationId) return user.organizationId;
    const userId = user.id ?? user.workosId;
    if (!userId) return undefined;

    const cached = this.#orgCache.get(userId);
    if (cached) return cached;

    try {
      await this.#ensureDbReady();
      const ctx = await this.instance.$context;

      const memberships = (await ctx.adapter.findMany({
        model: 'member',
        where: [{ field: 'userId', value: userId }],
      })) as MemberRow[];
      const firstExisting = memberships.find(m => m.organizationId)?.organizationId;
      if (firstExisting) {
        this.#orgCache.set(userId, firstExisting);
        return firstExisting;
      }

      // Create the personal org. The slug is derived from the user id, so a
      // concurrent/prior bootstrap that already created it makes the insert
      // reject on the unique slug — recover by looking the org up instead.
      const slug = `personal-${userId}`;
      let organizationId: string;
      try {
        const created = (await ctx.adapter.create({
          model: 'organization',
          data: {
            name: personalOrgName(user, userId),
            slug,
            createdAt: new Date(),
            metadata: JSON.stringify({ mastracodePersonalOrg: 'true' }),
          },
        })) as OrganizationRow;
        organizationId = created.id;
      } catch (error) {
        const existing = (await ctx.adapter.findOne({
          model: 'organization',
          where: [{ field: 'slug', value: slug }],
        })) as OrganizationRow | null;
        if (!existing) throw error;
        // Slug alone is NOT proof of ownership: the organization API is
        // reachable by any authenticated user, so an attacker could squat
        // `personal-<victimId>` and be granted the victim's tenant if we
        // blindly adopted it. Only adopt the slug-matched org when nobody
        // else is a member (zero members = a concurrent bootstrap of this
        // same user that hasn't attached yet). Otherwise fall back to a
        // fresh org with an unguessable slug.
        const existingMembers = (await ctx.adapter.findMany({
          model: 'member',
          where: [{ field: 'organizationId', value: existing.id }],
        })) as Array<MemberRow & { userId?: string }>;
        const foreignMember = existingMembers.some(m => m.userId !== userId);
        if (foreignMember) {
          const fallback = (await ctx.adapter.create({
            model: 'organization',
            data: {
              name: personalOrgName(user, userId),
              slug: `personal-${userId}-${crypto.randomUUID()}`,
              createdAt: new Date(),
              metadata: JSON.stringify({ mastracodePersonalOrg: 'true' }),
            },
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

  sessionClearCookie(): string {
    const sameSite = isCrossSiteAuth() ? 'None; Secure' : 'Lax';
    return `${this.#sessionCookieName()}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0`;
  }

  /**
   * Public routes: the better-auth API surface under `/auth/api/*`
   * (sign-in/up/out/session — what the SPA's email/password form posts to),
   * plus `/auth/login` (redirects to the SPA form) and `/auth/logout`.
   */
  publicRoutes(): AuthRouteSpec[] {
    return [
      {
        path: '/auth/api/*',
        method: 'ALL',
        handler: async c => {
          try {
            await this.#ensureDbReady();
          } catch {
            return c.json({ error: 'auth_unavailable' }, 503);
          }
          return this.instance.handler(c.req.raw);
        },
      },
      {
        // Hosted-login equivalent: better-auth has no hosted page, so send the
        // browser to the SPA's /signin form, preserving returnTo.
        path: '/auth/login',
        method: 'GET',
        handler: c => {
          const returnTo = sanitizeReturnTo(c.req.query('returnTo'));
          return c.redirect(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
        },
      },
      {
        path: '/auth/logout',
        method: 'GET',
        handler: async c => {
          // Revoke the session server-side and forward better-auth's own
          // clearing cookies; fall back to our clear cookie regardless.
          try {
            const response = (await this.instance.api.signOut({
              headers: c.req.raw.headers,
              asResponse: true,
            })) as Response;
            for (const cookie of response.headers.getSetCookie()) {
              c.header('Set-Cookie', cookie, { append: true });
            }
          } catch {
            // No/invalid session: nothing to revoke.
          }
          c.header('Set-Cookie', this.sessionClearCookie(), { append: true });
          return c.redirect('/');
        },
      },
    ];
  }
}
