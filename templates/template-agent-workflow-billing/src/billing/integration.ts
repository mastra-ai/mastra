import { TrieRouter } from 'hono/router/trie-router';
import type { Mastra } from '@mastra/core/mastra';
import type { ServerConfig } from '@mastra/core/server';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { AnyWorkflow } from '@mastra/core/workflows';
import type { z } from 'zod';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BillingError } from './contracts/core.js';
import { billingConfigurationSchema } from './configuration/policy.js';
import type { BillingProvider } from './contracts/provider.js';
import type { ArtifactReader } from './contracts/artifacts.js';
import type { AnyAgent, AgentOutput, AgentResource, WorkflowResource } from './mastra-resources.js';
import type { MastraBilling } from './mastra.js';
import type {
  AgentDefinition,
  WorkflowDefinition,
  ResourceDefinition,
  ResourceDependencies,
} from './resource-catalog.js';
import { materializeResources, validateResourceCatalog } from './resource-catalog.js';
import { configuredOrganizations, billingDatabaseUrl, readBillingConfiguration } from './configuration/environment.js';
import { initializeMastraBilling } from './mastra-setup.js';
import { createBillingStudio } from './server/studio.js';
import { createBillingServer } from './server/boundary.js';
import { ExecutionArtifacts } from './storage/artifacts.js';
import { validateConfigurationFiles } from './configuration/files.js';
import { ConversationStorage } from './storage/conversations.js';
import { protectConversationMemory, studioChatFailure } from '../studio-billing/studio-chat-proxy.js';
import type { StudioServerWrapper } from '../studio-billing/studio-wrapper-contracts.js';
import { Lifecycle } from './lifecycle.js';

type ConfigurationInput = z.input<typeof billingConfigurationSchema>;
/** Provider and commercial configuration, independent of any example resource. */
export interface BillingOptions {
  /** Server-owned provider credentials and environment settings. */
  readonly environment?: NodeJS.ProcessEnv;
  /** Driver name; defaults to BILLING_PROVIDER, then local. */
  readonly provider?: string;
  /** Optional driver implementation instead of automatic environment resolution. */
  readonly billingProvider?: BillingProvider;
  /** Logical meters, entitlements and subscriptions referenced by resource policies. */
  readonly billingKeys: ConfigurationInput['billingKeys'];
  /** Versioned commercial allowances and offers; no remote resources are provisioned. */
  readonly plans?: ConfigurationInput['catalog'];
  /** Initial local account data or a resolver for trusted development profiles. */
  readonly localAccounts?: ConfigurationInput['localAccounts'] | (() => Promise<ConfigurationInput['localAccounts']>);
  /** Explicit checkout/portal return URL allowlist. */
  readonly hosted?: ConfigurationInput['hosted'];
  /** Optional application-owned workflow snapshot store; billing never closes this store. */
  readonly storage?: MastraCompositeStore;
}

type AgentBillingOptions<A extends AnyAgent> = Omit<
  AgentDefinition<A, any>,
  'id' | 'kind' | 'create' | 'operations' | 'measurements' | 'adapter'
> &
  Partial<Pick<AgentDefinition<A, any>, 'operations' | 'measurements' | 'adapter'>>;
type WorkflowBillingOptions<W extends AnyWorkflow> = Omit<
  WorkflowDefinition<W>,
  'id' | 'kind' | 'create' | 'operations' | 'measurements' | 'adapter'
> &
  Partial<Pick<WorkflowDefinition<W>, 'operations' | 'measurements' | 'adapter'>>;
const preparedIntegrations = new WeakSet<object>();
/** Authenticate the prepared integration contract at wrapper composition time. */
export const isPreparedBillingIntegration = (value: unknown): value is object =>
  !!value && typeof value === 'object' && preparedIntegrations.has(value);
const registration = Symbol('billing-registration');
interface Registration<T, Options> {
  readonly [registration]: true;
  readonly native: T;
  readonly options: Options;
}
type AgentRegistration = Registration<AnyAgent, AgentBillingOptions<any>>;
type WorkflowRegistration = Registration<AnyWorkflow, WorkflowBillingOptions<any>>;
type Native<T> = T extends Registration<infer N, any> ? N : T;
type NativeRegistry<T> = { [K in keyof T]: Native<T[K]> };
type ProtectedAgents<T> = {
  [K in keyof T as T[K] extends Registration<any, any> ? K : never]: T[K] extends Registration<
    infer A extends AnyAgent,
    infer Settings
  >
    ? AgentResource<
        Settings extends { adapter: { outputSchema: z.ZodType<infer Output> } } ? Output : AgentOutput<A>,
        A
      >
    : never;
};
type ProtectedWorkflows<T> = {
  [K in keyof T as T[K] extends Registration<any, any> ? K : never]: T[K] extends Registration<
    infer W extends AnyWorkflow,
    any
  >
    ? WorkflowResource<W>
    : never;
};
const isRegistration = (value: object): value is Registration<any, any> => registration in value;

/** Collect optional billing registrations, then prepare services before constructing Mastra. */
export function createBilling(options: BillingOptions) {
  const environment = options.environment ?? process.env;
  validateConfigurationFiles(environment);
  const provider = options.provider ?? environment.BILLING_PROVIDER ?? 'local';
  if (environment.BILLING_PROVIDER && environment.BILLING_PROVIDER !== provider)
    throw new BillingError('invalid_configuration');
  const root = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.');
  const databaseUrl = environment.BILLING_DATABASE_URL ?? pathToFileURL(resolve(root, 'data/billing.db')).href;
  let prepared = false;
  let runtime: Awaited<ReturnType<typeof initializeMastraBilling>> | undefined;
  const lifecycle = new Lifecycle();
  const requireRuntime = () => {
    if (!runtime) throw new BillingError('state_unavailable');
    return runtime;
  };
  const integration = {
    /** Billing-owned artifact persistence; tools do not need SQL or membership knowledge. */
    artifacts: new ExecutionArtifacts(databaseUrl),
    /** Mark an agent for billing while preserving its native type after preparation. */
    agent<A extends AnyAgent, const Settings extends AgentBillingOptions<A>>(
      native: A,
      settings: Settings,
    ): Registration<A, Settings> {
      return { [registration]: true, native, options: settings };
    },
    /** Mark a workflow for billing; unwrapped workflows remain native registrations. */
    workflow<W extends AnyWorkflow, const Settings extends WorkflowBillingOptions<W>>(
      native: W,
      settings: Settings,
    ): Registration<W, Settings> {
      return { [registration]: true, native, options: settings };
    },
    /** Resolve nested agents only inside an admitted parent execution. */
    nestedAgent(id: string): ReturnType<ResourceDependencies['nestedAgent']> {
      return { generate: (prompt, slot) => requireRuntime().billing.nestedAgent(id).generate(prompt, { slot }) };
    },
    /** Release provider, recovery and billing-owned storage resources. */
    close: () => lifecycle.close(),
    /** Validate registrations and initialize billing without constructing or restricting Mastra options. */
    async prepare<
      const Agents extends Record<string, AnyAgent | AgentRegistration>,
      const Workflows extends Record<string, AnyWorkflow | WorkflowRegistration>,
    >(resources: { agents: Agents; workflows: Workflows; artifacts?: ArtifactReader }) {
      if (prepared) throw new BillingError('conflict');
      prepared = true;
      const definitions: ResourceDefinition[] = [];
      const agents: Record<string, AnyAgent> = Object.create(null);
      const workflows: Record<string, AnyWorkflow> = Object.create(null);
      const nativeRoutes = new Set<string>();
      const protectedRoutes = new Set<string>();
      for (const [id, value] of Object.entries(resources.agents)) {
        agents[id] = isRegistration(value) ? value.native : value;
        if (isRegistration(value)) {
          protectedRoutes.add(`/api/agents/${encodeURIComponent(id)}`);
          definitions.push({
            id,
            kind: 'agent',
            create: () => value.native,
            operations: ['generate'],
            measurements: [],
            ...value.options,
            adapter: value.options.adapter ?? { version: value.options.policy.version },
          });
        } else nativeRoutes.add(`/api/agents/${encodeURIComponent(id)}`);
      }
      for (const [id, value] of Object.entries(resources.workflows)) {
        workflows[id] = isRegistration(value) ? value.native : value;
        if (isRegistration(value)) {
          protectedRoutes.add(`/api/workflows/${encodeURIComponent(id)}`);
          definitions.push({
            id,
            kind: 'workflow',
            create: () => value.native,
            operations: ['start', 'resume', 'cancel'],
            measurements: [],
            ...value.options,
            adapter: value.options.adapter ?? { version: value.options.policy.version },
          });
        } else nativeRoutes.add(`/api/workflows/${encodeURIComponent(id)}`);
      }
      const resourcePath = (path: string) => path.split('/', 4).join('/');
      const nativeAccess = (path: string) => {
        const resource = resourcePath(path);
        return !protectedRoutes.has(resource) && nativeRoutes.has(resource);
      };
      const releasePreparation = lifecycle.hold();
      try {
        const localAccounts =
          typeof options.localAccounts === 'function' ? await options.localAccounts() : options.localAccounts;
        const configuration = validateResourceCatalog(
          {
            definitions,
            configuration: billingConfigurationSchema.parse({
              provider,
              resourcePolicies: [],
              billingKeys: options.billingKeys,
              catalog: options.plans,
              localAccounts,
              hosted: options.hosted,
            }),
          },
          readBillingConfiguration(environment),
          options.billingProvider,
        );
        const organizations = await configuredOrganizations({ ...environment, BILLING_PROVIDER: provider });
        lifecycle.own(() => organizations.close());
        const protectedResources = materializeResources(definitions, lifecycle);
        runtime = await initializeMastraBilling({
          organizations,
          configuration,
          agents: protectedResources.agents,
          workflows: protectedResources.workflows,
          databaseUrl: await billingDatabaseUrl(environment),
          billingProvider: options.billingProvider,
          environment,
          storage: options.storage,
        });
        lifecycle.own(runtime.close);
        const current = runtime;
        const conversations = await ConversationStorage.open(await billingDatabaseUrl(environment), organizations);
        lifecycle.own(() => conversations.close());
        let configuredWrapper: StudioServerWrapper | undefined;
        const studio =
          environment.BILLING_STUDIO_ENABLED === 'true'
            ? createBillingStudio({
                organizations,
                execution: current.billing.http,
                commercial: current.commercial,
                actions: protectedResources.actions,
                nativeAccess,
              })
            : undefined;
        let attached = false;
        const boundaries = new Set<unknown>();
        const preparedIntegration = {
          conversations,
          resources: { agents: protectedResources.agents, workflows: protectedResources.workflows },
          agents: agents as NativeRegistry<Agents>,
          workflows: workflows as NativeRegistry<Workflows>,
          storage: current.storage,
          tools: studio?.tools,
          organizations,
          runtime: current,
          execution: current.billing.http,
          artifacts: resources.artifacts,
          /** Typed billing facade for server-side execution; native routes of protected resources stay closed. */
          billing: current.billing as MastraBilling<ProtectedAgents<Agents>, ProtectedWorkflows<Workflows>>,
          /** Merge billing transport with the application's own Hono routes and middleware. */
          server(settings: ServerConfig = {}, options: { studioWrapper?: StudioServerWrapper } = {}): ServerConfig {
            const wrapper = options.studioWrapper;
            if (
              wrapper &&
              (wrapper.integration.organizations !== organizations ||
                wrapper.integration.execution !== current.billing.http)
            )
              throw new BillingError('invalid_configuration');
            configuredWrapper = wrapper;
            const customRoutes = settings.apiRoutes ?? [];
            const router = new TrieRouter<boolean>();
            for (const route of customRoutes) router.add(route.method, route.path, true);
            const apiPrefix = settings.apiPrefix ?? '/api';
            studio?.prefix(apiPrefix);
            const canonicalPath = (path: string) =>
              path.startsWith(apiPrefix + '/') ? '/api/' + path.slice(apiPrefix.length + 1) : path;
            const passthrough = (path: string, method = 'GET') => {
              const canonical = canonicalPath(path);
              if (protectedRoutes.has(resourcePath(canonical))) return false;
              return nativeAccess(canonical) || router.match(method, path)[0].length > 0;
            };
            const nativeFallback: import('hono').MiddlewareHandler = async (context, next) => {
              try {
                // Persisted private conversations remain protected when Studio or its wrapper is removed.
                const path = canonicalPath(context.req.path);
                if (!wrapper && /^\/api\/(agents|memory|workflows)\//.test(path))
                  await protectConversationMemory(context, conversations, current.storage, path);
                return passthrough(context.req.path, context.req.method)
                  ? next()
                  : studio
                    ? studio.middleware(context, next)
                    : context.json({ error: 'billing_gateway_required' }, 403);
              } catch (error) {
                return studioChatFailure(context, error);
              }
            };
            const boundary = createBillingServer({
              organizations,
              execution: current.billing.http,
              commercial: current.commercial,
              studio: { middleware: wrapper ? wrapper.middleware(apiPrefix, nativeFallback) : nativeFallback },
              artifacts: resources.artifacts,
              nativeAccess: passthrough,
              allowNative: true,
            });
            const middleware = settings.middleware
              ? Array.isArray(settings.middleware)
                ? settings.middleware
                : [settings.middleware]
              : [];
            const ownMiddleware = (
              Array.isArray(boundary.middleware) ? boundary.middleware : [boundary.middleware!]
            ).map(item => {
              const handled = new WeakSet<object>();
              const handler = typeof item === 'function' ? item : item.handler;
              const once: import('hono').MiddlewareHandler = (context, next) => {
                if (handled.has(context)) return next();
                handled.add(context);
                return handler(context, next);
              };
              return typeof item === 'function' ? once : { ...item, handler: once };
            });
            for (const item of ownMiddleware) boundaries.add(item);
            return {
              ...settings,
              ...boundary,
              cors: settings.cors ?? boundary.cors,
              apiRoutes: [...customRoutes, ...boundary.apiRoutes!],
              middleware: [...ownMiddleware, ...middleware],
            };
          },
          /** Attach the boundary and start recovery after native resources and snapshot storage are registered. */
          async attach(mastra: Mastra) {
            if (attached) throw new BillingError('conflict');
            for (const [id, native] of Object.entries(agents))
              if (mastra.listAgents()[id] !== native) throw new BillingError('invalid_configuration');
            for (const [id, native] of Object.entries(workflows))
              if (mastra.listWorkflows()[id] !== native) throw new BillingError('invalid_configuration');
            if ((await mastra.getStorage()?.getStore('workflows')) !== (await current.storage.getStore('workflows')))
              throw new BillingError('invalid_configuration');
            if (configuredWrapper)
              for (const [id, agent] of Object.entries(configuredWrapper.agents)) {
                if (mastra.listAgents()[id] !== agent || !(await agent.getMemory()))
                  throw new BillingError('invalid_configuration');
              }
            const protectedAgents = new Set(
              definitions.filter(definition => definition.kind === 'agent').map(definition => agents[definition.id]),
            );
            const protectedWorkflows = new Set(
              definitions
                .filter(definition => definition.kind === 'workflow')
                .map(definition => workflows[definition.id]),
            );
            for (const [id, native] of Object.entries(mastra.listAgents())) {
              const path = `/api/agents/${encodeURIComponent(id)}`;
              if (configuredWrapper?.registerAlias(id, native)) {
                if (Object.hasOwn(agents, id)) throw new BillingError('invalid_configuration');
                protectedRoutes.add(path);
              } else if (protectedAgents.has(native)) protectedRoutes.add(path);
              else nativeRoutes.add(path);
              if (protectedRoutes.has(path)) nativeRoutes.delete(path);
            }
            for (const [id, native] of Object.entries(mastra.listWorkflows())) {
              const path = `/api/workflows/${encodeURIComponent(id)}`;
              if (protectedWorkflows.has(native)) protectedRoutes.add(path);
              else nativeRoutes.add(path);
              if (protectedRoutes.has(path)) nativeRoutes.delete(path);
            }
            const configured = mastra.getServer()?.middleware;
            const configuredMiddleware = configured ? (Array.isArray(configured) ? configured : [configured]) : [];
            if (!configuredMiddleware.some(item => boundaries.has(item)))
              throw new BillingError('invalid_configuration');
            // Install only the early billing boundary. Mastra applies application middleware from server config.
            const earlyBoundary = configuredMiddleware.filter(item => boundaries.has(item));
            mastra.setServerMiddleware([...earlyBoundary, ...(mastra.getServerMiddleware() ?? [])]);
            protectedResources.ready(current.billing);
            attached = true;
            await current.startRecovery().ready;
          },
          close: integration.close,
        };
        preparedIntegrations.add(preparedIntegration);
        return preparedIntegration;
      } catch (error) {
        releasePreparation();
        return lifecycle.fail(error);
      } finally {
        releasePreparation();
      }
    },
  };
  return integration;
}
