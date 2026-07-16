/**
 * `MastraFactory` — the single entry point to the whole MastraCode web factory.
 *
 * The deploy entry (`src/mastra/index.ts`) is the ONE place deployment env is
 * read: it constructs config instances (pubsub, later an auth adapter) and
 * passes them here explicitly. The factory itself never reads deployment env
 * vars and never constructs providers on the caller's behalf.
 *
 * `prepare()` resolves feature readiness, seeds the runtime-config registry,
 * assembles the web routes/middleware, and returns the constructor args for
 * `new Mastra(...)`. The literal `export const mastra = new Mastra(...)` must
 * stay in the entry file — the deployer's `checkConfigExport` Babel plugin
 * only marks the config valid when it finds that literal in the entry AST —
 * so the factory produces args instead of the instance. `finalize()` runs the
 * post-construct boot (controller init + workers).
 *
 * GitHub/Linear/intake readiness stays env-resolved inside `prepare()` for
 * now (fail-soft checks, see `./web-surface.ts`) — future slots on this
 * config object.
 */

import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { prepareAgentControllerMount } from '@mastra/code-sdk';
import { observeAgentGitAction } from './audit/agent-audit.js';
import { buildAuthRoutes, createWebAuthGate, createWebAuthProvider, isWebAuthEnabled } from './auth.js';
import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  subscribeCurrentSessionToPullRequest,
} from './github/session-subscriptions.js';
import { buildLinearAgentTools } from './linear/agent-tools.js';
import { seedRuntimeConfig } from './runtime-config.js';
import { handleServerError } from './server-error.js';
import { createSpaStaticMiddleware, resolveUiDistDir } from './spa-static.js';
import {
  assembleWebApiRoutes,
  resolveFactoryReady,
  resolveGithubReady,
  resolveIntakeReady,
  resolveLinearReady,
} from './web-surface.js';
import type { WebApiRoutesDeps } from './web-surface.js';

type BuildApiRoutesDeps = Pick<WebApiRoutesDeps, 'controller' | 'authStorage'>;

/** Constructor args for the `new Mastra(...)` literal in the deploy entry. */
export type MastraArgs = NonNullable<ConstructorParameters<typeof Mastra>[0]>;

export interface MastraFactoryConfig {
  /**
   * Postgres connection string powering BOTH agent storage (threads, messages,
   * memory, OM, recall vectors) and the app tables (github/factory/audit/
   * intake). Omitted → default storage resolution applies (local libSQL file)
   * and app-DB-gated features stay off.
   *
   * Stays a connection string (not a storage instance) because it fans out to
   * independently-constructed clients: the SDK mount builds its store, vector
   * store, maintenance, and fallback from `StorageConfig`, while the app
   * tables need a raw drizzle/pg Pool. Instance-accepting `database` is a
   * follow-up gated on SDK storage-injection support.
   */
  database?: string;
  /**
   * Distributed event bus instance (e.g. `new RedisStreamsPubSub({ url })`).
   * When set, streams/workflows/signals ride it across processes and the
   * controller drops file-based thread locks in favor of pubsub-coordinated
   * leases. Omitted → in-process default.
   */
  pubsub?: PubSub;
  /**
   * Browser-facing origin used to build GitHub OAuth/install callback URLs and
   * to derive the auth redirect URI. On the platform the SPA is hosted
   * separately, so this MUST be the public API origin.
   * Default: `http://localhost:4111`.
   */
  publicUrl?: string;
  /**
   * Allowed cross-origin SPA origins. The SPA may be served from a separate
   * static host, so credentialed requests must be explicitly allowed.
   */
  allowedOrigins?: string[];
}

const CONTROLLER_ID = 'code';

export class MastraFactory {
  readonly #config: MastraFactoryConfig;
  #prepared: Awaited<ReturnType<typeof prepareAgentControllerMount>> | undefined;

  constructor(config: MastraFactoryConfig = {}) {
    this.#config = config;
  }

  /**
   * Resolve feature readiness, seed the runtime-config registry, and assemble
   * everything needed to construct the server-owned Mastra. Returns the args
   * for the `new Mastra(...)` literal that must live in the entry file.
   */
  async prepare(): Promise<MastraArgs> {
    if (this.#prepared) throw new Error('MastraFactory.prepare() called twice');

    const publicOrigin = (this.#config.publicUrl ?? 'http://localhost:4111').replace(/\/+$/, '');
    const allowedOrigins = (this.#config.allowedOrigins ?? []).map(o => o.replace(/\/+$/, '')).filter(Boolean);
    const database = this.#config.database;
    const pubsub = this.#config.pubsub;

    // Seed the registry FIRST: the readiness checks below reach the app DB
    // through `getAppDatabaseUrl()`.
    seedRuntimeConfig({ databaseUrl: database, publicUrl: publicOrigin });

    // GitHub App + cloud-sandbox readiness, resolved BEFORE constructing the
    // Mastra args so the github routes are simply omitted from `apiRoutes`
    // when unavailable. Fails soft (see resolveGithubReady).
    const githubReady = await resolveGithubReady();

    // Linear intake readiness, same fail-soft pattern as GitHub.
    const linearReady = await resolveLinearReady();

    // Intake source configuration (Settings › Intake) — needs at least one source.
    const intakeReady = await resolveIntakeReady(githubReady || linearReady);

    // Factory work-item board — hangs off GitHub projects, same fail-soft pattern.
    const factoryReady = await resolveFactoryReady(githubReady);

    // TEMP: WorkOS auth is still resolved from its own env here, verbatim from
    // the pre-factory entry. The auth adapter slot (`auth?: WebAuthAdapter`)
    // replaces this in the adapter-seam step.
    const webAuthEnabled = isWebAuthEnabled();
    const redirectUri = process.env.WORKOS_REDIRECT_URI ?? `${publicOrigin}/auth/callback`;
    // One WorkOS provider for the process, shared by the gate middleware and
    // the public `/auth/*` routes so session encryption/validation stays
    // consistent.
    const authProvider = webAuthEnabled ? createWebAuthProvider(redirectUri) : undefined;

    // Build the real production controller (agents, modes, tools, memory, OM,
    // MCP, providers) — identical to the terminal app. Agent state lives in
    // the single app Postgres (`database`) alongside the github/app tables —
    // one shared DB for all users, separated by `resourceId` scoping.
    const prepared = await prepareAgentControllerMount({
      controllerId: CONTROLLER_ID,
      disableGithubSignals: true,
      ...(database ? { storage: { backend: 'pg', connectionString: database } } : {}),
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
              const requestContext = (context.context as { requestContext?: RequestContext } | undefined)
                ?.requestContext;
              // Audit externally-visible git side effects performed by the agent
              // (commit / push / PR creation). Fire-and-forget; never throws.
              if (requestContext) {
                void observeAgentGitAction({ ...context, context: requestContext });
              }
              if (pullRequestUrl && requestContext) {
                await subscribeCurrentSessionToPullRequest(requestContext, pullRequestUrl, 'auto-gh-pr-create');
              }
            },
          }
        : {}),
      ...(pubsub ? { pubsub, crossProcessPubSub: true } : {}),
      buildApiRoutes: ({ controller, authStorage }: BuildApiRoutesDeps) => [
        // Public `/auth/*` routes (login/callback/logout/me). Folded in as
        // `apiRoutes` (not plain Hono routes) because the entry can't touch the
        // Hono app the deployer generates. `requiresAuth: false`; the gate
        // skips `/auth/*`.
        ...(authProvider ? buildAuthRoutes(authProvider, redirectUri) : []),
        // Custom `/web/*` routes (fs / config / github / factory / audit).
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
        // Log route errors with method/path/stack and answer with structured
        // JSON instead of an opaque `Internal Server Error`. Applied by the
        // deployer to both the top-level app and the custom-route sub-app.
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
        //   1. gate  — validates the auth session, stashes the user, and 401s /
        //              redirects unauthenticated requests. Skips public `/auth/*`.
        //   2. spa   — serves the built UI for everything the server doesn't own.
        return {
          middleware: [createWebAuthGate(authProvider), ...spa],
          ...cors,
          ...onError,
        };
      },
    });

    this.#prepared = prepared;
    return prepared.mastraArgs;
  }

  /**
   * Post-construct boot: initialize the controller (which inherits the
   * constructed Mastra's storage) and start its workers. Call AFTER the entry
   * has run `new Mastra(prepare()'s args)`.
   */
  async finalize(): Promise<void> {
    if (!this.#prepared) {
      throw new Error('MastraFactory.finalize() called before prepare()');
    }
    await this.#prepared.finalize();
  }
}
