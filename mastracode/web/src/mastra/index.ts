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
 *                            the same-origin SPA static middleware.
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
import type { RequestContext } from '@mastra/core/request-context';
import { prepareAgentControllerMount } from '@mastra/code-sdk';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { observeAgentGitAction } from '../web/audit/agent-audit.js';
import { buildAuthRoutes, createWebAuthGate, createWebAuthProvider, isWebAuthEnabled } from '../web/auth.js';
import { buildLinearAgentTools } from '../web/linear/agent-tools.js';
import { handleServerError } from '../web/server-error.js';
import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  subscribeCurrentSessionToPullRequest,
} from '../web/github/session-subscriptions.js';
import { createSpaStaticMiddleware, resolveUiDistDir } from '../web/spa-static.js';
import {
  assembleWebApiRoutes,
  resolveFactoryReady,
  resolveGithubReady,
  resolveIntakeReady,
  resolveLinearReady,
} from '../web/web-surface.js';
import type { WebApiRoutesDeps } from '../web/web-surface.js';

type BuildApiRoutesDeps = Pick<WebApiRoutesDeps, 'controller' | 'authStorage'>;

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

// Linear intake readiness, same fail-soft pattern as GitHub.
const linearReady = await resolveLinearReady();

// Intake source configuration (Settings › Intake) — needs at least one source.
const intakeReady = await resolveIntakeReady(githubReady || linearReady);

// Factory work-item board — hangs off GitHub projects, same fail-soft pattern.
const factoryReady = await resolveFactoryReady(githubReady);

// Distributed pub/sub: when `REDIS_URL` is set, events (streams, workflows,
// signals) ride Redis Streams so multiple web server processes can share one
// event bus. RedisStreamsPubSub also implements LeaseProvider, so passing
// `crossProcessPubSub` lets the controller drop its file-based thread locks in
// favor of pubsub-coordinated leases. Without `REDIS_URL` (bare local dev) the
// in-process default applies.
const redisUrl = process.env.REDIS_URL;
const pubsub = redisUrl ? new RedisStreamsPubSub({ url: redisUrl }) : undefined;
if (redisUrl) {
  // Redact credentials before logging (REDIS_URL may embed a password).
  let redisTarget = 'redis';
  try {
    const parsed = new URL(redisUrl);
    redisTarget = `${parsed.protocol}//${parsed.host}`;
  } catch {
    // Unparseable URL — RedisStreamsPubSub will surface the real error; keep the log generic.
  }
  console.log(`[PubSub] REDIS_URL set — event bus on Redis Streams (${redisTarget}), cross-process leases enabled.`);
}

const webAuthEnabled = isWebAuthEnabled();

const redirectUri = process.env.WORKOS_REDIRECT_URI ?? `${publicOrigin}/auth/callback`;

// One WorkOS provider for the process, shared by the gate middleware and the
// public `/auth/*` routes so session encryption/validation stays consistent.
const authProvider = webAuthEnabled ? createWebAuthProvider(redirectUri) : undefined;

// Build the real production controller (agents, modes, tools, memory, OM, MCP,
// providers) — identical to the terminal app — and register it on a Mastra whose
// `server` config owns the whole web surface. The deployer generates its Hono
// server from THIS instance, so the gate, custom routes, and CORS all ride along.
//
// Agent state (threads, messages, memory, OM, recall vectors) lives in the
// single app Postgres (`APP_DATABASE_URL`) alongside the github/app tables —
// one shared DB for all users, separated by `resourceId` scoping. Without
// `APP_DATABASE_URL` (bare local dev) the default storage resolution applies
// (local libSQL file).
const prepared = await prepareAgentControllerMount({
  controllerId: CONTROLLER_ID,
  disableGithubSignals: true,
  ...(process.env.APP_DATABASE_URL
    ? { storage: { backend: 'pg', connectionString: process.env.APP_DATABASE_URL } }
    : {}),
  ...(githubReady || linearReady
    ? {
        extraTools: async ({ requestContext }: { requestContext: RequestContext }) => ({
          ...(linearReady ? await buildLinearAgentTools({ requestContext }) : {}),
          ...(githubReady ? createGithubSubscriptionTools(requestContext) : {}),
        }),
      }
    : {}),
  ...(githubReady
    ? {
        postToolObserver: async (context: {
          toolName: string;
          input: unknown;
          output?: unknown;
          error?: unknown;
          context: unknown;
        }) => {
          const pullRequestUrl = parseCreatedPullRequest(context);
          const requestContext = (context.context as { requestContext?: RequestContext } | undefined)?.requestContext;
          // Audit externally-visible git side effects performed by the agent
          // (commit / push / PR creation). Awaited so the local audit write
          // completes before teardown; never throws (failures are swallowed).
          if (requestContext) {
            await observeAgentGitAction({ ...context, context: requestContext });
          }
          if (pullRequestUrl && requestContext) {
            await subscribeCurrentSessionToPullRequest(requestContext, pullRequestUrl, 'auto-gh-pr-create');
          }
        },
      }
    : {}),
  ...(pubsub ? { pubsub, crossProcessPubSub: true } : {}),
  buildApiRoutes: ({ controller, authStorage }: BuildApiRoutesDeps) => [
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
      linearReady,
      intakeReady,
      factoryReady,
    }),
  ],
  buildServerConfig: () => {
    const cors = allowedOrigins.length ? { cors: { origin: allowedOrigins, credentials: true } } : {};
    // Log route errors with method/path/stack and answer with structured JSON
    // instead of an opaque `Internal Server Error`. Applied by the deployer to
    // both the top-level app and the custom-route sub-app.
    const onError = { onError: handleServerError };
    // Same-origin SPA: when a vite build is present (see resolveUiDistDir),
    // serve it at `/` from this server. Mounted last so the auth gate (when
    // enabled) covers it; it always passes `/api`, `/web`, `/auth` through.
    const uiDist = resolveUiDistDir();
    const spa = uiDist ? [createSpaStaticMiddleware(uiDist)] : [];
    if (!webAuthEnabled || !authProvider) {
      // Auth disabled: no gate. SPA + CORS only.
      return { ...(spa.length ? { middleware: spa } : {}), ...cors, ...onError };
    }

    // Ordered middleware. The deployer applies these AFTER its context
    // middleware sets `c.set('mastra', mastra)` and BEFORE routes, so:
    //   1. gate  — validates the WorkOS session, stashes the user, and 401s /
    //              redirects unauthenticated requests. Skips public `/auth/*`.
    //   2. spa   — serves the built UI for everything the server doesn't own.
    return {
      middleware: [createWebAuthGate(authProvider), ...spa],
      ...cors,
      ...onError,
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
