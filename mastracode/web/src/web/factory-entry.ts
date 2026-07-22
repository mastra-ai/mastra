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
 * Integration readiness is derived from each instance's declared capabilities
 * and the storage domains those capabilities require.
 */

import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { FactoryStorage } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { prepareAgentControllerMount } from '@mastra/code-sdk';
import { MastraAuthStudio } from '@mastra/auth-studio';
import { hasAuthInit } from '@mastra/core/server';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { observeAgentGitAction } from './audit/agent-audit.js';
import { AuditDomain } from './audit/domain.js';
import { buildAuthRoutes, createWebAuthGate, isWebAuthEnabled } from './auth.js';
import type { FactoryIntegration, IntegrationPostToolContext, IntegrationTools } from './factory-integration.js';
import { getFactoryWorkspace } from './factory/workspace.js';
import { ProjectDomain } from './projects/domain.js';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { seedRuntimeConfig } from './runtime-config.js';
import { AuditStorage } from './storage/domains/audit/base.js';
import { ModelCredentialsStorage } from './storage/domains/credentials/base.js';
import { ModelPacksStorage } from './storage/domains/model-packs/base.js';
import { createTenantCredentialPrimer, registerTenantCredentialResolver } from './tenant-credentials.js';
import { IntakeStorage } from './storage/domains/intake/base.js';
import { IntegrationStorage } from './storage/domains/integrations/base.js';
import { FactoryProjectsStorage } from './storage/domains/projects/base.js';
import { QueueHealthStorage } from './storage/domains/queue-health/base.js';
import { SourceControlStorage } from './storage/domains/source-control/base.js';
import { WorkItemsStorage } from './storage/domains/work-items/base.js';
import { handleServerError } from './server-error.js';
import { createStateSigner } from './state-signing.js';
import { createSpaStaticMiddleware, resolveUiDistDir } from './spa-static.js';
import { assembleWebApiRoutes, buildIntegrationContext } from './web-surface.js';
import type { WebApiRoutesDeps } from './web-surface.js';

type BuildApiRoutesDeps = Pick<WebApiRoutesDeps, 'controller' | 'authStorage'>;

/** Constructor args for the `new Mastra(...)` literal in the deploy entry. */
export type MastraArgs = NonNullable<ConstructorParameters<typeof Mastra>[0]>;

export interface MastraFactoryConfig {
  /**
   * Auth provider instance — `MastraAuthStudio` (`@mastra/auth-studio`),
   * `MastraAuthWorkos` (`@mastra/auth-workos`), `MastraAuthBetterAuth`
   * (`@mastra/auth-better-auth`), or any custom `MastraAuthProvider`. Whatever
   * instance is passed is the active provider; a passed instance is always
   * honored as-is.
   *
   * Omitted → the factory defaults to `MastraAuthStudio`, proxying auth
   * through the shared Mastra platform API. `MastraAuthStudio` resolves its
   * own env (`MASTRA_SHARED_API_URL`, `MASTRA_ORGANIZATION_ID`,
   * `MASTRA_COOKIE_DOMAIN`).
   *
   * Pass `null` to disable auth entirely (open server, local-dev behavior)
   * without falling back to the default.
   */
  auth?: IMastraAuthProvider | null;
  /**
   * REQUIRED. Factory storage backend powering BOTH agent storage (threads,
   * messages, memory, OM — via `getMastraStorage()`) and the app tables
   * (projects/source-control/audit/intake — via the generic ops surface). Pass a
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
   * Browser-facing origin used to build integration OAuth/install callback
   * URLs and to derive the auth redirect URI. On the platform the SPA is
   * hosted separately, so this MUST be the public API origin.
   * Default: `http://localhost:4111`.
   */
  publicUrl?: string;
  /**
   * Allowed cross-origin SPA origins. The SPA may be served from a separate
   * static host, so credentialed requests must be explicitly allowed.
   */
  allowedOrigins?: string[];
  /** Sandbox configuration. Omitted → repository sandboxes are disabled. */
  sandbox?: MastraFactorySandboxConfig;
  /**
   * Deployment-stable secret for signing integration OAuth `state` values.
   * Omitted → a per-process random secret, which is fine for single-process
   * local development but rejected for integrations that declare
   * `requiresStableStateSigner`.
   */
  stateSecret?: string;
  /**
   * Registered capability providers. The factory registers the pieces each
   * `FactoryIntegration` instance provides — HTTP routes, storage domains,
   * agent/session tools, intake, source control, and diagnostics — into the
   * diagnostics — into the system. An absent integration means its routes
   * never mount, its tools never register, and the server boots fine.
   */
  integrations?: FactoryIntegration[];
}

export interface MastraFactorySandboxConfig {
  /**
   * Template machine — `RailwaySandbox` (`@mastra/railway`), core
   * `LocalSandbox` (`@mastra/core/workspace`), or any `WorkspaceSandbox` that
   * implements `clone()`. Each project-repository execution environment gets
   * its own sandbox cloned from this machine; the machine itself is never
   * started. `prepare()` fails fast when the instance lacks `clone()`.
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

function resolveSandboxWorkdirBase(machine: WorkspaceSandbox, configuredWorkdir?: string): string {
  const machineWorkdir = templateWorkingDirectory(machine);
  const workdir =
    configuredWorkdir === '/workspace' && machineWorkdir ? machineWorkdir : (configuredWorkdir ?? machineWorkdir);
  return (workdir ?? '/workspace').replace(/\/+$/, '');
}

/**
 * Default auth provider — `MastraAuthStudio`, which proxies identity to the
 * shared Mastra platform API. `MastraAuthStudio` resolves `MASTRA_SHARED_API_URL`,
 * `MASTRA_ORGANIZATION_ID`, and `MASTRA_COOKIE_DOMAIN` from env on its own —
 * this helper only derives a cookie-domain fallback from the factory's
 * `publicUrl`.
 *
 * Cookie-domain resolution (Studio picks the first that wins):
 *   1. explicit `MASTRA_COOKIE_DOMAIN` env, if set;
 *   2. `.mastra.ai` when `sharedApiUrl` is on `.mastra.ai`;
 *   3. this parent-domain fallback derived from `publicUrl` — so a deploy on
 *      `https://foo.mastra.cloud` mints cookies with `Domain=.mastra.cloud`
 *      without the caller wiring the env var by hand.
 *   4. otherwise host-only (no `Domain=`), which is correct for `localhost`.
 */
function buildDefaultStudioAuth(publicUrl: string): IMastraAuthProvider {
  return new MastraAuthStudio({
    cookieDomain: parentDomainFromPublicUrl(publicUrl),
  });
}

/**
 * Derive a parent cookie domain from `publicUrl` by stripping the leftmost
 * label — the same shape platform-API's env injection uses (see
 * `platform/servers/api/src/lib/studio-env-vars.ts`: `.${routingDomain.replace(/^[^.]+\./, '')}`).
 *
 * Rather than a generic `strip-left-label` heuristic — which either emits
 * cookies scoped to a public suffix (`sub.example.co.uk` → `.example.co.uk`
 * requires PSL data to be safe) or misclassifies numeric hostnames like
 * `3scale.example.com` as IPv4 — we only derive a parent domain when the
 * host sits under one of the platform's known registrable domains. Anything
 * else (custom domains, arbitrary tenant hostnames, IPs, `localhost`)
 * falls through to host-only cookies. Callers that need a different scope
 * pass `MASTRA_COOKIE_DOMAIN` explicitly (Studio honors that first).
 */
const KNOWN_PLATFORM_COOKIE_PARENTS = ['mastra.cloud', 'mastra.ai'] as const;

function isIpLiteral(hostname: string): boolean {
  // IPv6 addresses in URLs are bracketed; `URL.hostname` strips the brackets
  // but the address itself still contains `:`. IPv4 is four dot-separated
  // numeric octets — trust the parser to have already validated shape.
  if (hostname.includes(':')) return true;
  return /^\d+(?:\.\d+){3}$/.test(hostname);
}

function parentDomainFromPublicUrl(publicUrl: string): string | undefined {
  let hostname: string;
  try {
    hostname = new URL(publicUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  if (hostname === 'localhost' || isIpLiteral(hostname)) return undefined;
  for (const parent of KNOWN_PLATFORM_COOKIE_PARENTS) {
    // Exact match → we're already on the parent, host-only is correct.
    // Subdomain match → mint the parent-scoped cookie.
    if (hostname === parent) return undefined;
    if (hostname.endsWith(`.${parent}`)) return `.${parent}`;
  }
  return undefined;
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
    // Default auth: honor an explicitly-passed provider (including `null` to
    // disable auth) as-is; otherwise fall back to `MastraAuthStudio`
    // (platform-proxied identity). The default derives its cookie domain
    // from `publicUrl` — deploys on `<sub>.mastra.cloud` mint parent-domain
    // cookies without the caller wiring `MASTRA_COOKIE_DOMAIN` explicitly.
    const configuredAuth = this.#config.auth;
    const auth: IMastraAuthProvider | undefined =
      configuredAuth === null ? undefined : (configuredAuth ?? buildDefaultStudioAuth(publicOrigin));

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
    storage.registerDomain(new ModelPacksStorage());
    storage.registerDomain(new QueueHealthStorage());
    // Generic integration storage (connections/subscriptions/settings) — the
    // default persistence surface for integrations without a bespoke domain.
    const integrationStorage = storage.registerDomain(new IntegrationStorage());
    storage.registerDomain(new FactoryProjectsStorage());
    const sourceControlStorage = storage.registerDomain(new SourceControlStorage());
    const projectDomain = new ProjectDomain({
      storage,
      versionControlIntegrationIds: integrations
        .filter(integration => integration.versionControl)
        .map(integration => integration.id),
    });
    const auditDomain = new AuditDomain({ storage, integrations });

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

    // Repository execution needs one sandbox per project-repository link,
    // cloned from the configured machine. A machine without `clone()` would
    // only fail on first use, so fail fast at boot instead.
    const sandboxConfig = this.#config.sandbox;
    const machine = sandboxConfig?.machine;
    if (machine && typeof machine.clone !== 'function') {
      throw new Error(
        `MastraFactory: the configured sandbox machine (provider '${machine.provider}') does not implement clone(). ` +
          `Project repositories each get their own sandbox cloned from the configured machine. ` +
          `Pass a machine that implements clone() — e.g. RailwaySandbox (@mastra/railway) or ` +
          `LocalSandbox (@mastra/core/workspace) — or omit 'sandbox' to disable sandboxes.`,
      );
    }

    // Seed runtime config first: readiness checks below reach app domains
    // through the seeded FactoryStorage, gate on the active auth adapter via
    // `isWebAuthEnabled()`, and probe the sandbox runtime via
    // `isSandboxEnabled()`.
    // One shared OAuth state signer per boot. The deploy entry supplies a
    // replica-stable secret when needed; otherwise local development gets a
    // per-process random signer (`stable: false`).
    const stateSigner = createStateSigner(this.#config.stateSecret);

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
            workdirBase: resolveSandboxWorkdirBase(machine, sandboxConfig?.workdir),
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

    // Per-tenant model credentials: once the credentials domain is up, model
    // resolution goes through the caller's own store and the SDK stops
    // mirroring stored API keys into process.env.
    //
    // Only register when a real auth adapter gates callers. In local /
    // auth-disabled mode there is no authenticated tenant, so registering would
    // force every model call through an empty tenant store (fail-closed, no env
    // fallback) and break chat with "Not logged in". Leaving it unregistered
    // lets the SDK fall back to the file-backed AuthStorage (auth.json) — the
    // same store the local /login and Settings pages read and write.
    if (isWebAuthEnabled()) {
      registerTenantCredentialResolver();
    }

    for (const integration of integrations) {
      if (integration.versionControl) {
        integration.versionControl.initialize({
          storage: sourceControlStorage.forIntegration(integration.id),
        });
      }
    }

    // Every integration uses generic integration storage. Version-control
    // providers additionally require the source-control storage domain. Readiness
    // is derived solely from capability presence, never from provider ids.
    const integrationRegistrations = integrations.map(integration => {
      const requiredDomains = ['integrations', ...(integration.versionControl ? ['source-control'] : [])];
      return {
        integration,
        ready: requiredDomains.every(domain => storage.isDomainReady(domain)),
        ensureReady: async () => {
          for (const domain of requiredDomains) await storage.ensureDomainReady(domain);
        },
      };
    });
    const intakeReady =
      integrations.some(integration => integration.intake !== undefined) && storage.isDomainReady('intake');
    const factoryReady = storage.isDomainReady('projects') && storage.isDomainReady('work-items');

    // Boot assertion: an active integration that signs OAuth `state` needs a
    // replica-stable signer — a per-process random secret silently breaks the
    // OAuth callback on any replica that didn't sign the state. Fail loud now
    // instead. (The built-ins also assert this inside their readiness gates.)
    for (const { integration } of integrationRegistrations) {
      if (integration.requiresStableStateSigner && !stateSigner.stable) {
        throw new Error(
          `MastraFactory: integration '${integration.id}' signs OAuth state and requires a ` +
            `replica-stable state secret, but none is configured. Set 'stateSecret' on the factory config.`,
        );
      }
    }

    // Integrations contributing tools to agent sessions: org-scoped
    // `agentTools` (resolved per request) + session-scoped `sessionTools`.
    const toolIntegrations = integrationRegistrations.filter(
      ({ integration }) => integration.agentTools || integration.sessionTools,
    );

    // Build the real production controller (agents, modes, tools, memory, OM,
    // MCP, providers) — identical to the terminal app. Agent state lives in
    // the storage backend's Mastra store alongside the Factory app tables —
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
                  mergeTools(integration, integration.sessionTools({ requestContext }));
                }
              }
              return tools;
            },
          }
        : {}),
      postToolObserver: async (toolContext: IntegrationPostToolContext) => {
        const requestContext = (toolContext.context as { requestContext?: RequestContext } | undefined)?.requestContext;
        if (requestContext) {
          await observeAgentGitAction({
            audit: auditDomain,
            toolContext: { ...toolContext, context: requestContext },
          });
        }
        await Promise.all(
          integrations.map(async integration => {
            if (!integration.postToolObserver) return;
            try {
              await integration.postToolObserver({ toolContext, requestContext });
            } catch (error) {
              console.warn(`[factory] Integration '${integration.id}' post-tool observer failed:`, error);
            }
          }),
        );
      },
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
          audit: auditDomain,
          publicOrigin,
          stateSigner,
          integrationStorage,
          sourceControlStorage,
          integrations: integrationRegistrations,
          intakeReady,
          factoryReady,
        }),
        ...projectDomain.routes(),
        ...auditDomain.routes(),
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
    const integrationWorkers = integrationRegistrations
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
