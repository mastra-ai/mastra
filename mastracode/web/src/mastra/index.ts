/**
 * Platform-deployable Mastra entry for MastraCode.
 *
 * `mastra build` requires the entry to export a `Mastra` instance named
 * `mastra` (validated by the `checkConfigExport` Babel plugin). Everything
 * outside that instance is discarded — the deployer generates its own Hono
 * server via `createHonoServer(mastra, ...)`. So this entry folds the ENTIRE
 * web surface onto the instance the deployer builds from:
 *
 *   - `server.apiRoutes`   — the custom `/web/*` routes (fs / config / github),
 *                            already migrated off `/api`, `requiresAuth: false`.
 *   - `server.middleware`  — the WorkOS auth gate (bare handler, runs first) and
 *                            the tenant dispatcher (`/api/*`, retargets
 *                            `c.set('mastra', tenantMastra)` per request).
 *   - `server.cors`        — the SPA is hosted separately (static host / CDN),
 *                            so cross-origin credentialed requests are allowed
 *                            for the configured origin(s).
 *
 * This entry is the single web surface. The Mastra CLI consumes it everywhere:
 * `mastra dev` (local), `mastra build`, and `mastra deploy` all bundle this
 * module and let the deployer generate the server — there is no separate
 * hand-wired dev bootstrap.
 *
 * NOTE: the deployer's own static serving is Studio-only. The SPA (vite build
 * output) is served same-origin at `/` by the SPA middleware below when a
 * build is found (`web:build` produces one); `server.cors` remains only for
 * the optional separately-hosted-SPA setup. In dev, Vite serves the SPA and
 * proxies API paths here instead.
 */

import { Mastra } from '@mastra/core/mastra';
import { prepareAgentControllerMount } from '@mastra/code-sdk';
import { buildAuthRoutes, createWebAuthGate, createWebAuthProvider, isWebAuthEnabled } from '../web/auth.js';
import { createSpaStaticMiddleware, resolveUiDistDir } from '../web/spa-static.js';
import { TenantDispatcher } from '../web/tenant-server.js';
import { assertRemoteTenantDbIfRequired } from '../web/tenant-storage.js';
import { assembleWebApiRoutes, resolveGithubReady } from '../web/web-surface.js';

const CONTROLLER_ID = 'code';

/**
 * Browser-facing origin used to build GitHub OAuth/install callback URLs and to
 * derive the WorkOS redirect URI. On the platform the SPA is hosted separately,
 * so this MUST be set to the public API origin via `MASTRACODE_PUBLIC_URL`.
 */
const publicOrigin = (process.env.MASTRACODE_PUBLIC_URL ?? 'http://localhost:4111').replace(/\/+$/, '');

/**
 * Allowed cross-origin SPA origins (comma-separated). The SPA is served from a
 * separate static host, so credentialed requests must be explicitly allowed.
 */
const allowedOrigins = (process.env.MASTRACODE_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// GitHub App + cloud-sandbox readiness, resolved BEFORE constructing Mastra so
// the github routes are simply omitted from `apiRoutes` when unavailable. Fails
// soft (see resolveGithubReady).
const githubReady = await resolveGithubReady();

const webAuthEnabled = isWebAuthEnabled();

// One tenant dispatcher for the process lifetime (owns the LRU/idle-evicted
// per-`(org,user)` cache). Constructed at module scope so it survives across
// requests — it must NOT live inside the discarded local `serve()` bootstrap.
let tenantDispatcher: TenantDispatcher | undefined;
if (webAuthEnabled) {
  // Fail loud if a remote tenant DB is required (multi-replica / ephemeral
  // platform FS) but only local-file tenant DBs are configured.
  assertRemoteTenantDbIfRequired();
  tenantDispatcher = new TenantDispatcher({
    baseConfig: {},
    controllerId: CONTROLLER_ID,
  });
}

const redirectUri = process.env.WORKOS_REDIRECT_URI ?? `${publicOrigin}/auth/callback`;

// One WorkOS provider for the process, shared by the gate middleware and the
// public `/auth/*` routes so session encryption/validation stays consistent.
const authProvider = webAuthEnabled ? createWebAuthProvider(redirectUri) : undefined;

// Build the real production controller (agents, modes, tools, memory, OM, MCP,
// providers) — identical to the terminal app — and register it on a Mastra whose
// `server` config owns the whole web surface. The deployer generates its Hono
// server from THIS instance, so the gate, dispatcher, custom routes, and CORS
// all ride along.
const prepared = await prepareAgentControllerMount({
  controllerId: CONTROLLER_ID,
  buildApiRoutes: ({ controller, authStorage }) => [
    // Public WorkOS `/auth/*` routes (login/callback/logout/me). Folded in as
    // `apiRoutes` (not plain Hono routes) because the entry can't touch the Hono
    // app the deployer generates. `requiresAuth: false`; the gate skips `/auth/*`.
    ...(authProvider ? buildAuthRoutes(authProvider, redirectUri) : []),
    // Custom `/web/*` routes (fs / config / github).
    ...assembleWebApiRoutes({
      controller,
      authStorage,
      publicOrigin,
      githubReady,
      allowPersonalProviderCredentials: !webAuthEnabled,
    }),
  ],
  buildServerConfig: () => {
    const cors = allowedOrigins.length ? { cors: { origin: allowedOrigins, credentials: true } } : {};
    // Same-origin SPA: when a vite build is present (see resolveUiDistDir),
    // serve it at `/` from this server. Mounted last so the auth gate (when
    // enabled) covers it; it always passes `/api`, `/web`, `/auth` through.
    const uiDist = resolveUiDistDir();
    const spa = uiDist ? [createSpaStaticMiddleware(uiDist)] : [];
    if (!webAuthEnabled || !authProvider) {
      // Auth disabled: no gate, no per-tenant isolation. SPA + CORS only.
      return { ...(spa.length ? { middleware: spa } : {}), ...cors };
    }

    // Ordered middleware. The deployer applies these AFTER its context
    // middleware sets `c.set('mastra', mastra)` and BEFORE routes, so:
    //   1. gate  — validates the WorkOS session, stashes the user, and 401s /
    //              redirects unauthenticated requests. Skips public `/auth/*`.
    //   2. tenant — for authenticated `/api/*`, forwards to the user's isolated
    //              tenant Mastra app (its own libSQL storage/vector pair).
    //   3. spa   — serves the built UI for everything the server doesn't own.
    return {
      middleware: [
        createWebAuthGate(authProvider),
        { path: '/api/*', handler: tenantDispatcher!.middleware() },
        ...spa,
      ],
      ...cors,
    };
  },
});

// Construct the server-owned Mastra HERE so the `new Mastra(...)` literal lives
// in the entry file. The deployer's `checkConfigExport` Babel plugin only marks
// the config valid when it finds `export const mastra = new Mastra(...)` (or an
// `export { x as mastra }` where `x = new Mastra(...)`) in the entry source AST.
// `prepared.mastraArgs` already carries the controller (via `agentControllers`),
// storage, and the assembled `server` config (middleware + apiRoutes + cors).
export const mastra = new Mastra(prepared.mastraArgs);

// Post-construct boot: initialize the controller (which now inherits this
// instance's storage) and start its workers. Runs at module load via top-level
// await, so the deployer imports a fully-booted instance.
await prepared.finalize();
