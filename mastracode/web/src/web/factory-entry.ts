/**
 * `MastraFactory` — the single entry point to the whole MastraCode web factory.
 *
 * The deploy entry (`src/mastra/index.ts`) is the ONE place deployment env is
 * read: it constructs config instances (auth adapter, pubsub) and passes them
 * here explicitly. The factory itself never reads deployment env vars and
 * never constructs providers on the caller's behalf.
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
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { PostgresStore } from '@mastra/pg';
import { prepareAgentControllerMount } from '@mastra/code-sdk';
import { observeAgentGitAction } from './audit/agent-audit.js';
import type { WebAuthAdapter } from './auth-adapter.js';
import { buildAuthRoutes, createWebAuthGate } from './auth.js';
import { getFactoryWorkspace } from './factory/workspace.js';
import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  subscribeCurrentSessionToPullRequest,
} from './github/session-subscriptions.js';
import { buildLinearAgentTools } from './linear/agent-tools.js';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { getSeededGithubIntegration, getSeededLinearIntegration, seedRuntimeConfig } from './runtime-config.js';
import { FactoryStore } from './storage/factory-store.js';
import { AuditStoragePG } from './storage/domains/audit/pg.js';
import { ModelCredentialsStoragePG } from './storage/domains/credentials/pg.js';
import { createTenantCredentialPrimer, registerTenantCredentialResolver } from './tenant-credentials.js';
import { IntakeStoragePG } from './storage/domains/intake/pg.js';
import { WorkItemsStoragePG } from './storage/domains/work-items/pg.js';
import { handleServerError } from './server-error.js';
import { createStateSigner } from './state-signing.js';
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
   * Web auth adapter instance — `WorkOSWebAuth`, `BetterAuthWebAuth`, or any
   * custom `WebAuthAdapter` implementation. Whatever instance is passed is the
   * active provider; the factory never selects or constructs one itself.
   * Omitted → auth disabled (open server, local-dev behavior).
   */
  auth?: WebAuthAdapter;
  /**
   * Storage instance powering BOTH agent storage (threads, messages, memory,
   * OM) and the app tables (github/factory/audit/intake). Pass a
   * `PostgresStore` (`@mastra/pg`) — its pg pool is shared by the SDK mount,
   * the factory app-table domains, the distributed project lock, and
   * better-auth, so the whole deployment rides one connection pool.
   *
   * Omitted → default storage resolution applies (local libSQL file) and
   * app-DB-gated features stay off. A non-Postgres instance is forwarded to
   * the SDK mount as-is, but the app tables are pg-only for now, so app-DB
   * features stay off in that case too (backend-agnostic domains are the
   * follow-up; see `./storage/domain.ts`).
   */
  storage?: MastraCompositeStore;
  /**
   * Vector store instance for recall search — `PgVector` (`@mastra/pg`) on
   * the same database as `storage`. Omitted → the SDK mount's default vector
   * store resolution applies.
   */
  vector?: MastraVector;
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
  /**
   * Sandbox configuration. Omitted → sandboxes disabled and GitHub-backed
   * projects stay off.
   */
  sandbox?: MastraFactorySandboxConfig;
  /**
   * Deployment-stable secret for signing OAuth `state` values (GitHub/Linear
   * connect flows). Omitted → a per-process random secret is used, which is
   * fine for single-process local dev but fails the boot assertion when an
   * OAuth-signing integration is enabled on a multi-replica deploy.
   */
  stateSecret?: string;
}

export interface MastraFactorySandboxConfig {
  /**
   * Template machine — `RailwaySandbox` (`@mastra/railway`), core
   * `LocalSandbox` (`@mastra/core/workspace`), or any `WorkspaceSandbox` that
   * implements `clone()`. Each GitHub-backed project gets its own sandbox
   * cloned from this machine (credentials and defaults inherited, per-project
   * env/id overridden); the machine itself is never started. `prepare()`
   * fails fast when the instance does not implement `clone()`.
   */
  machine: WorkspaceSandbox;
  /**
   * In-sandbox base directory repos check out under (nested `owner/name` per
   * repo). Default: the machine's own `workingDirectory` when it exposes one
   * (core `LocalSandbox` does), else `/workspace`.
   */
  workdir?: string;
  /**
   * Per-replica cap on concurrently provisioned sandboxes. `0`/omitted means
   * unlimited. A lightweight per-process budget, not a cross-replica scheduler.
   */
  maxSandboxes?: number;
}

const CONTROLLER_ID = 'code';

/**
 * The template sandbox's own working directory, when it exposes one as a
 * string (core `LocalSandbox` does; remote providers generally don't).
 * Used as the default checkout base so a local template rooted at a host
 * directory checks repos out under that same root.
 */
function templateWorkingDirectory(sandbox: WorkspaceSandbox): string | undefined {
  const wd = (sandbox as { workingDirectory?: unknown }).workingDirectory;
  return typeof wd === 'string' && wd.length > 0 ? wd : undefined;
}

export class MastraFactory {
  readonly #config: MastraFactoryConfig;
  #prepared: Awaited<ReturnType<typeof prepareAgentControllerMount>> | undefined;
  #preparing = false;

  constructor(config: MastraFactoryConfig = {}) {
    this.#config = config;
  }

  /**
   * Resolve feature readiness, seed the runtime-config registry, and assemble
   * everything needed to construct the server-owned Mastra. Returns the args
   * for the `new Mastra(...)` literal that must live in the entry file.
   */
  async prepare(): Promise<MastraArgs> {
    // Guard set synchronously (before the first await) so overlapping calls —
    // not just strictly sequential ones — can't double-seed the runtime
    // registry or double-run one-time adapter init.
    if (this.#preparing) throw new Error('MastraFactory.prepare() called twice');
    this.#preparing = true;

    const publicOrigin = (this.#config.publicUrl ?? 'http://localhost:4111').replace(/\/+$/, '');
    const allowedOrigins = (this.#config.allowedOrigins ?? []).map(o => o.replace(/\/+$/, '')).filter(Boolean);
    const storage = this.#config.storage;
    const vector = this.#config.vector;
    const pubsub = this.#config.pubsub;
    const auth = this.#config.auth;

    // The app tables are pg-only for now: the domain DDL and the drizzle
    // bridge run over the PostgresStore's shared pool. A non-Postgres storage
    // still powers agent state through the SDK mount, but app-DB features
    // fail soft (gates off), same as no storage at all.
    const appPool = storage instanceof PostgresStore ? storage.pool : undefined;
    if (storage && !appPool) {
      process.stderr.write(
        'MastraCode Web: the configured storage is not a PostgresStore — app-DB features (GitHub/Linear/intake/factory) stay off.\n',
      );
    }

    // Registry of factory app-table storage domains. Built-ins register here;
    // integration-provided domains will flow through the same register() path.
    const factoryStore = appPool ? new FactoryStore() : undefined;
    if (factoryStore) {
      factoryStore.register(new IntakeStoragePG());
      factoryStore.register(new AuditStoragePG());
      factoryStore.register(new WorkItemsStoragePG());
      factoryStore.register(new ModelCredentialsStoragePG());
    }

    // Sandbox machine validation: GitHub projects need one sandbox per
    // project, cloned from the configured machine. A machine without
    // `clone()` would only fail at first project open — fail fast at boot
    // instead, with the fix spelled out.
    const sandboxConfig = this.#config.sandbox;
    const machine = sandboxConfig?.machine;
    if (machine && typeof machine.clone !== 'function') {
      throw new Error(
        `MastraFactory: the configured sandbox machine (provider '${machine.provider}') does not implement clone(). ` +
          `GitHub-backed projects each get their own sandbox cloned from the configured machine. ` +
          `Pass a machine that implements clone() — e.g. RailwaySandbox (@mastra/railway) or ` +
          `LocalSandbox (@mastra/core/workspace) — or omit 'sandbox' to disable sandboxes.`,
      );
    }

    // Seed the registry FIRST: the readiness checks below reach the app DB
    // through the seeded storage's shared pool (`getSharedAppPool()`), gate on
    // the active auth adapter via `isWebAuthEnabled()`, and probe the sandbox
    // runtime via `isSandboxEnabled()`.
    // One shared OAuth state signer per boot: explicit `stateSecret` when
    // provided, else a per-process random secret (`stable: false`) — the
    // readiness checks fail loud when an OAuth-signing feature is enabled
    // without a stable signer.
    const stateSigner = createStateSigner(this.#config.stateSecret);


    seedRuntimeConfig({
      storage,
      vector,
      factoryStore,
      publicUrl: publicOrigin,
      authAdapter: auth,
      stateSigner,
      sandbox: machine
        ? {
            machine,
            workdirBase: (sandboxConfig?.workdir ?? templateWorkingDirectory(machine) ?? '/workspace').replace(
              /\/+$/,
              '',
            ),
            maxSandboxes: sandboxConfig?.maxSandboxes,
          }
        : undefined,
    });

    // One-time adapter initialization with factory-level context (e.g.
    // better-auth builds its default instance on the shared pool). Failures
    // surface here, at prepare() — a misconfigured adapter must not boot.
    await auth?.init?.({ storage, publicUrl: publicOrigin, allowedOrigins });

    // Single init path: the injected storage's own init (Mastra table DDL) …
    // An injected store failing is a hard error — there is no LibSQL fallback
    // for an explicitly provided instance.
    if (storage) await storage.init();
    // … then every registered factory app-table domain. Fail-soft per domain:
    // a failed domain marks its feature gates off without aborting boot.
    if (factoryStore && appPool) await factoryStore.init({ pool: appPool });

    // Per-tenant model credentials: once the credentials domain is up, model
    // resolution goes through the caller's own store and the SDK stops
    // mirroring stored API keys into process.env.
    if (factoryStore) registerTenantCredentialResolver();

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

    // Build the real production controller (agents, modes, tools, memory, OM,
    // MCP, providers) — identical to the terminal app. Agent state lives in
    // the injected storage alongside the github/app tables — one shared DB
    // (and pool) for all users, separated by `resourceId` scoping.
    const prepared = await prepareAgentControllerMount({
      controllerId: CONTROLLER_ID,
      workspace: getFactoryWorkspace,
      disableGithubSignals: true,
      ...(storage ? { storage } : {}),
      ...(vector ? { vectorStore: vector } : {}),
      ...(githubReady || linearReady
        ? {
            extraTools: async ({ requestContext }: { requestContext: RequestContext }) => {
              const github = getSeededGithubIntegration();
              const linear = getSeededLinearIntegration();
              return {
                ...(linearReady && linear ? await buildLinearAgentTools({ requestContext, linear }) : {}),
                ...(githubReady && github ? createGithubSubscriptionTools(requestContext, github) : {}),
              };
            },
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
              // (commit / push / PR creation). Awaited so the local audit write
              // completes before teardown; never throws (failures are swallowed).
              if (requestContext) {
                await observeAgentGitAction({ ...context, context: requestContext });
              }
              const github = getSeededGithubIntegration();
              if (pullRequestUrl && requestContext && github) {
                await subscribeCurrentSessionToPullRequest(requestContext, pullRequestUrl, 'auto-gh-pr-create', github);
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
        ...(auth ? buildAuthRoutes(auth) : []),
        // Custom `/web/*` routes (fs / config / github / factory / audit).
        ...assembleWebApiRoutes({
          controllerId: CONTROLLER_ID,
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
        if (!auth) {
          // Auth disabled: no gate. SPA + CORS only.
          return { ...(spa.length ? { middleware: spa } : {}), ...cors, ...onError };
        }

        // Ordered middleware. The deployer applies these AFTER its context
        // middleware sets `c.set('mastra', mastra)` and BEFORE routes, so:
        //   1. gate   — validates the auth session, stashes the user, and 401s /
        //               redirects unauthenticated requests. Skips public `/auth/*`.
        //   2. primer — hydrates the caller's model-credential snapshot so the
        //               request's first model call resolves tenant credentials.
        //   3. spa    — serves the built UI for everything the server doesn't own.
        return {
          middleware: [createWebAuthGate(auth), createTenantCredentialPrimer(), ...spa],
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
