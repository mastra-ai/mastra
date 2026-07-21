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
import type { FactoryStorage } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { prepareAgentControllerMount } from '@mastra/code-sdk';
import { hasAuthInit } from '@mastra/core/server';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { observeAgentGitAction } from './audit/agent-audit.js';
import { buildAuthRoutes, createWebAuthGate } from './auth.js';
import type { FactoryIntegration, IntegrationTools } from './factory-integration.js';
import { getFactoryWorkspace } from './factory/workspace.js';
import { parseCreatedPullRequest, subscribeCurrentSessionToPullRequest } from './github/session-subscriptions.js';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { getSeededGithubIntegration, seedRuntimeConfig } from './runtime-config.js';
import { AuditStorage } from './storage/domains/audit/base.js';
import { ModelCredentialsStorage } from './storage/domains/credentials/base.js';
import { createTenantCredentialPrimer, registerTenantCredentialResolver } from './tenant-credentials.js';
import { IntakeStorage } from './storage/domains/intake/base.js';
import { IntegrationStorage } from './storage/domains/integrations/base.js';
import { QueueHealthStorage } from './storage/domains/queue-health/base.js';
import { SourceControlStorage } from './storage/domains/source-control/base.js';
import { WorkItemsStorage } from './storage/domains/work-items/base.js';
import { handleServerError } from './server-error.js';
import { createStateSigner } from './state-signing.js';
import { createSpaStaticMiddleware, resolveUiDistDir } from './spa-static.js';
import {
  assembleWebApiRoutes,
  buildIntegrationContext,
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
   * Auth provider instance — `MastraAuthWorkos` (`@mastra/auth-workos`),
   * `MastraAuthBetterAuth` (`@mastra/auth-better-auth`), or any custom
   * `MastraAuthProvider`. Whatever instance is passed is the active provider;
   * the factory never selects or constructs one itself.
   * Omitted → auth disabled (open server, local-dev behavior).
   */
  auth?: IMastraAuthProvider;
  /**
   * REQUIRED. Factory storage backend powering BOTH agent storage (threads,
   * messages, memory, OM — via `getMastraStorage()`) and the app tables
   * (github/factory/audit/intake — via the generic ops surface). Pass a
   * `PgFactoryStorage` (`@mastra/pg`) for deployments or a
   * `LibSQLFactoryStorage` (`@mastra/libsql`) for local dev — one backend,
   * one connection, every feature on.
   */
  storage: FactoryStorage;
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
   * connect flows). Omitted → the GitHub integration's webhook secret is used
   * when one is registered, else a per-process random secret — fine for
   * single-process local dev but fails the boot assertion when an
   * OAuth-signing integration is enabled on a multi-replica deploy.
   */
  stateSecret?: string;
  /**
   * Registered integrations (`GithubIntegration`, `LinearIntegration`, or any
   * custom `FactoryIntegration`). The factory registers the pieces each
   * instance provides — HTTP routes, storage domain, agent/session tools,
   * diagnostics — into the system. An absent integration means its routes
   * never mount, its tools never register, and the server boots fine.
   */
  integrations?: FactoryIntegration[];
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
   * Base directory repos check out under (nested `owner/name` per repo).
   * Remote sandboxes use this override or default to `/workspace`. A
   * `LocalSandbox` always uses its host `workingDirectory`, because an
   * in-sandbox path such as `/workspace` is not a host filesystem mount.
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

function sandboxWorkdirBase(sandbox: WorkspaceSandbox, configuredWorkdir?: string): string {
  const templateWorkdir = templateWorkingDirectory(sandbox);
  const workdir = sandbox.provider === 'local' ? templateWorkdir : (configuredWorkdir ?? templateWorkdir);
  return (workdir ?? '/workspace').replace(/\/+$/, '');
}

export class MastraFactory {
  readonly #config: MastraFactoryConfig;
  #prepared: Awaited<ReturnType<typeof prepareAgentControllerMount>> | undefined;
  #preparing = false;

  constructor(config: MastraFactoryConfig) {
    if (!config?.storage) {
      throw new Error(
        "MastraFactory: 'storage' is required. Pass a FactoryStorage backend — e.g. " +
          "new PgFactoryStorage({ connectionString }) from '@mastra/pg' for deployments, or " +
          "new LibSQLFactoryStorage({ url }) from '@mastra/libsql' for local dev.",
      );
    }
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

    // Registered integrations: validate ids up front so a copy-paste duplicate
    // fails loud instead of one instance silently shadowing the other.
    const integrations = this.#config.integrations ?? [];
    const integrationIds = new Set<string>();
    for (const integration of integrations) {
      if (integrationIds.has(integration.id)) {
        throw new Error(`MastraFactory: duplicate integration id '${integration.id}' in 'integrations'.`);
      }
      integrationIds.add(integration.id);
    }

    // FactoryStorage owns every app-table domain and initializes them through
    // the same lifecycle as the backend connection.
    storage.registerDomain(new IntakeStorage());
    storage.registerDomain(new AuditStorage());
    storage.registerDomain(new WorkItemsStorage());
    storage.registerDomain(new ModelCredentialsStorage());
    storage.registerDomain(new QueueHealthStorage());
    // Generic integration storage (connections/subscriptions/settings) — the
    // default persistence surface for integrations without a bespoke domain.
    const integrationStorage = storage.registerDomain(new IntegrationStorage());
    const sourceControlStorage = storage.registerDomain(new SourceControlStorage());

    // Multi-replica deployments (distributed pubsub configured) need
    // cross-replica serialization; warn loud when the storage backend can't
    // provide it so the operator knows locks are per-replica only.
    if (pubsub && typeof storage.withDistributedLock !== 'function') {
      process.stderr.write(
        'MastraCode Web: pubsub is configured (multi-replica?) but the storage backend has no ' +
          'withDistributedLock capability — project locks serialize per replica only. ' +
          'Use PgFactoryStorage for multi-replica deployments.\n',
      );
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
          `GitHub-backed repositories each get their own sandbox cloned from the configured machine. ` +
          `Pass a machine that implements clone() — e.g. RailwaySandbox (@mastra/railway) or ` +
          `LocalSandbox (@mastra/core/workspace) — or omit 'sandbox' to disable sandboxes.`,
      );
    }

    // Seed runtime config first: readiness checks below reach app domains
    // through the seeded FactoryStorage, gate on the active auth adapter via
    // `isWebAuthEnabled()`, and probe the sandbox runtime via
    // `isSandboxEnabled()`.
    // One shared OAuth state signer per boot: explicit `stateSecret` when
    // provided, else the GitHub integration's webhook secret (deployment-stable
    // by construction), else a per-process random secret (`stable: false`) —
    // the readiness checks fail loud when an OAuth-signing feature is enabled
    // without a stable signer.
    const githubWebhookSecret = (
      integrations.find(integration => integration.id === 'github') as { webhookSecret?: unknown } | undefined
    )?.webhookSecret;
    const stateSigner = createStateSigner(
      this.#config.stateSecret ?? (typeof githubWebhookSecret === 'string' ? githubWebhookSecret : undefined),
    );

    seedRuntimeConfig({
      storage,
      vector,
      integrations,
      publicUrl: publicOrigin,
      authProvider: auth,
      stateSigner,
      sandbox: machine
        ? {
            machine,
            workdirBase: sandboxWorkdirBase(machine, sandboxConfig?.workdir),
            maxSandboxes: sandboxConfig?.maxSandboxes,
          }
        : undefined,
    });

    // One-time provider initialization with factory-level context (e.g.
    // better-auth builds its default instance on the backend's auth
    // database, WorkOS derives its redirect URI from the public URL).
    // Failures surface here, at prepare() — a misconfigured provider must
    // not boot.
    if (auth && hasAuthInit(auth)) {
      await auth.init({ database: storage.authDatabase?.(), publicUrl: publicOrigin, allowedOrigins });
    }

    // Single init path: backend connection failure is a hard boot error;
    // registered app domains initialize fail-soft inside FactoryStorage.
    await storage.init();

    // Authenticated requests may resolve tenant credentials, so auth makes the
    // credentials domain a hard dependency even though other app domains remain
    // fail-soft. Auth-less mode keeps the SDK's environment-backed fallback when
    // the domain is unavailable.
    if (auth) await storage.ensureDomainReady('model-credentials');
    if (storage.isDomainReady('model-credentials')) registerTenantCredentialResolver();

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

    // Per-integration readiness. The built-ins keep their composite gates
    // (auth + app DB + signer stability); custom integrations are ready when
    // registered, plus a successful storage-domain init when they bring one.
    const integrationReady = new Map<string, boolean>();
    for (const integration of integrations) {
      if (integration.id === 'github') integrationReady.set('github', githubReady);
      else if (integration.id === 'linear') integrationReady.set('linear', linearReady);
      else integrationReady.set(integration.id, storage.isDomainReady('integrations'));
    }
    const readyIntegrations = integrations.map(integration => ({
      integration,
      ready: integrationReady.get(integration.id) ?? false,
      ensureReady: async () => {
        await storage.ensureDomainReady('integrations');
        if (integration.id === 'github') await storage.ensureDomainReady('source-control');
      },
    }));

    // Boot assertion: an active integration that signs OAuth `state` needs a
    // replica-stable signer — a per-process random secret silently breaks the
    // OAuth callback on any replica that didn't sign the state. Fail loud now
    // instead. (The built-ins also assert this inside their readiness gates.)
    for (const { integration } of readyIntegrations) {
      if (integration.requiresStableStateSigner && !stateSigner.stable) {
        throw new Error(
          `MastraFactory: integration '${integration.id}' signs OAuth state and requires a ` +
            `replica-stable state secret, but none is configured. Set 'stateSecret' on the ` +
            `factory config (or register a GitHub integration with a webhook secret).`,
        );
      }
    }

    // Integrations contributing tools to agent sessions: org-scoped
    // `agentTools` (resolved per request) + session-scoped `sessionTools`.
    const toolIntegrations = readyIntegrations.filter(
      ({ integration }) => integration.agentTools || integration.sessionTools,
    );

    // Build the real production controller (agents, modes, tools, memory, OM,
    // MCP, providers) — identical to the terminal app. Agent state lives in
    // the storage backend's Mastra store alongside the github/app tables —
    // one shared database for all users, separated by `resourceId` scoping.
    const prepared = await prepareAgentControllerMount({
      controllerId: CONTROLLER_ID,
      workspace: getFactoryWorkspace,
      disableGithubSignals: true,
      storage: storage.getMastraStorage(),
      ...(vector ? { vector } : {}),
      ...(toolIntegrations.length > 0
        ? {
            extraTools: async ({ requestContext }: { requestContext: RequestContext }) => {
              const tools: IntegrationTools = {};
              const toolOwners = new Map<string, string>();
              const mergeTools = (integration: FactoryIntegration, contributed: IntegrationTools) => {
                for (const [name, tool] of Object.entries(contributed)) {
                  const owner = toolOwners.get(name);
                  if (owner) {
                    throw new Error(
                      `MastraFactory: integration tool '${name}' from '${integration.id}' conflicts with '${owner}'.`,
                    );
                  }
                  toolOwners.set(name, integration.id);
                  tools[name] = tool;
                }
              };
              for (const { integration, ready, ensureReady } of toolIntegrations) {
                if (!ready && ensureReady) {
                  try {
                    await ensureReady();
                  } catch {
                    continue;
                  }
                }
                if (integration.agentTools) {
                  mergeTools(integration, await integration.agentTools({ requestContext }));
                }
                if (integration.sessionTools) {
                  mergeTools(integration, integration.sessionTools(requestContext));
                }
              }
              return tools;
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
        // Custom `/web/*` routes (fs / config / integrations / factory / audit).
        ...assembleWebApiRoutes({
          controllerId: CONTROLLER_ID,
          controller,
          authStorage,
          publicOrigin,
          stateSigner,
          integrationStorage,
          sourceControlStorage,
          integrations: readyIntegrations,
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

    // Integration lifecycle workers (e.g. polling an upstream without
    // webhooks): collected from READY integrations only, folded into the
    // constructor args so `new Mastra(...)` merges them with the default
    // workers and `finalize()`'s `startWorkers()` starts them alongside the
    // built-ins. Never passed for the disabled/not-ready case — a worker for
    // an unavailable integration must not run.
    const integrationWorkers = readyIntegrations
      .filter(({ integration, ready }) => ready && integration.workers)
      .flatMap(({ integration }) =>
        integration.workers!(
          buildIntegrationContext(
            {
              controller: prepared.base.controller,
              publicOrigin,
              stateSigner,
              integrationStorage,
              sourceControlStorage,
            },
            integration.id,
          ),
        ),
      );

    return {
      ...prepared.mastraArgs,
      ...(integrationWorkers.length > 0 ? { workers: integrationWorkers } : {}),
    };
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
