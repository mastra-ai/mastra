import type { MastraCompositeStore } from '@mastra/core/storage';
import type { Context } from 'hono';

/**
 * Provider-pluggable web auth seam.
 *
 * A `WebAuthAdapter` is the class a deploy entry passes to `MastraFactory`'s
 * `auth` slot. It captures exactly what the auth module (`./auth.ts`) needs
 * from an identity provider: session authentication, personal-org bootstrap,
 * the provider's public `/auth/*` routes, and how to clear its session cookie.
 * Shipped implementations: `WorkOSWebAuth` (`./auth-workos-adapter.ts`) and
 * `BetterAuthWebAuth` (`./auth-better-adapter.ts`); anything implementing this
 * interface works.
 *
 * Everything provider-NEUTRAL — the gate middleware, `/auth/me`, the tenant
 * helpers (`webAuthTenant`, `getWebAuthUser*`) — stays in `./auth.ts` and is
 * implemented against the active adapter.
 */

/** Minimal shape of the signed-in user surfaced to the SPA (no tokens). */
export interface WebAuthUser {
  /** Stable WorkOS user id used to scope per-user data (GitHub installs etc.). */
  workosId?: string;
  /** Provider user id; WorkOS shapes may use `workosId` instead (see {@link workosId}). */
  id?: string;
  email?: string;
  name?: string;
  /**
   * Organization id. The org is the top-level tenant: it owns the GitHub
   * App installation and connected projects, while each user inside the org gets
   * isolated building instances. Absent for personal (no-org) accounts.
   */
  organizationId?: string;
}

/**
 * Tenant identity: the org is the top-level tenant, and each user inside it is
 * an isolated builder. Agent state, worktrees and sandboxes are scoped per
 * `(orgId, userId)`. Personal (no-org) users have `orgId === undefined`.
 */
export interface WebAuthTenant {
  /** Organization id, or `undefined` for personal (no-org) accounts. */
  orgId?: string;
  /** Stable provider user id. */
  userId: string;
}

/** HTTP methods supported for adapter-provided public auth routes. */
export type AuthRouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

/**
 * A public `/auth/*` route contributed by an adapter (login, OAuth callback,
 * logout, provider API endpoints). Mounted unauthenticated: the gate skips
 * `/auth/*`. The auth module mounts these both as plain Hono routes (local
 * server) and as Mastra `server.apiRoutes` (platform entry).
 */
export interface AuthRouteSpec {
  /** Route path, must start with `/auth/`. */
  path: string;
  method: AuthRouteMethod;
  handler: (c: Context) => Response | Promise<Response>;
}

/** Factory-level context handed to `WebAuthAdapter.init()` once during `prepare()`. */
export interface WebAuthAdapterInitContext {
  /**
   * The Mastra storage instance injected into the factory, when configured.
   * Adapters that need a database (better-auth) reuse its shared pg pool
   * instead of opening their own connection.
   */
  storage?: MastraCompositeStore;
  /** Browser-facing origin (no trailing slash), e.g. `https://factory.acme.com`. */
  publicUrl?: string;
  /**
   * Extra browser origins allowed to talk to this API (cross-origin SPA
   * deploys). Providers that enforce their own origin allow-list (e.g.
   * better-auth `trustedOrigins`) must honor these.
   */
  allowedOrigins?: string[];
}

/**
 * Identity-provider adapter behind the web auth gate.
 *
 * Implementations must validate their own constructor options (fail fast);
 * requirements only satisfiable at prepare time (e.g. a database) are checked
 * in `init()`.
 */
export interface WebAuthAdapter {
  /** Provider discriminator: `'workos'`, `'better-auth'`, or a custom value. */
  readonly kind: string;

  /**
   * Whether self-serve sign-up is disabled for providers that host their own
   * credential forms (e.g. better-auth email/password). Surfaced through
   * `/auth/me` so the SPA hides the sign-up affordance. Hosted-login providers
   * (WorkOS) leave this undefined.
   */
  readonly signUpDisabled?: boolean;

  /**
   * Optional one-time initialization, called by `MastraFactory.prepare()` with
   * factory-level context (database, public origin) so adapters can use it
   * without the deploy entry passing it twice.
   */
  init?(ctx: WebAuthAdapterInitContext): Promise<void>;

  /**
   * Resolve the authenticated user for a request from a bearer token and/or
   * the raw request's session cookie. Returns `null` when unauthenticated.
   * Must not throw for ordinary invalid/expired sessions.
   */
  authenticate(token: string, raw: Request): Promise<WebAuthUser | null>;

  /**
   * Ensure the user belongs to an organization, bootstrapping a personal org
   * on first use when they have none. Returns the org id, or `undefined` when
   * the user genuinely stays no-org (bootstrap is best-effort). Must be
   * idempotent under concurrent/retried first logins.
   */
  ensureOrg(user: WebAuthUser): Promise<string | undefined>;

  /** Provider-specific public `/auth/*` routes (login, callback, logout, APIs). */
  publicRoutes(): AuthRouteSpec[];

  /** `Set-Cookie` string that clears this provider's session cookie. */
  sessionClearCookie(): string;
}

/**
 * Validate that a `returnTo` value is a safe same-site path, to prevent
 * open-redirect attacks. Only absolute local paths (`/foo`) are allowed;
 * protocol-relative (`//evil.com`) and absolute URLs are rejected.
 */
export function sanitizeReturnTo(raw: string | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  // Reject protocol-relative URLs like "//evil.com" and "/\evil.com".
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

/** Extract a bearer token from the Authorization header, if present. */
export function getBearerToken(authorization: string | undefined): string {
  if (!authorization) return '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] ?? '';
}

/**
 * Whether the SPA is served cross-origin from this API (platform deploy). When
 * `MASTRACODE_ALLOWED_ORIGINS` is set the browser talks to us cross-site, so
 * session cookies must be `SameSite=None; Secure` for the browser to send them.
 * Same-origin local dev leaves this unset and keeps the stricter `SameSite=Lax`.
 */
export function isCrossSiteAuth(): boolean {
  return Boolean(process.env.MASTRACODE_ALLOWED_ORIGINS?.trim());
}
