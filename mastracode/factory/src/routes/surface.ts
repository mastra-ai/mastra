import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { FactoryStorage } from '@mastra/core/storage';

import type { FactoryIntegration, IntegrationContext } from '../integrations/base.js';
import { getGithubFeatureDiagnostics } from '../integrations/github/config.js';
import type { GithubIntegration } from '../integrations/github/integration.js';
import { MaterializeError } from '../integrations/github/sandbox.js';
import { FactoryDispatchError } from '../rules/dispatch-errors.js';
import type { FactoryBindingPreparationInput } from '../rules/dispatcher.js';
import { FactoryStartCoordinator } from '../rules/start-coordinator.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryRules } from '../rules/types.js';
import { factoryRuleStage } from '../rules/types.js';
import type { BaseCheckpointTriggers } from '../sandbox/base-checkpoint-triggers.js';
import type { SandboxFleet } from '../sandbox/fleet.js';
import {
  ensureFactorySourceSession,
  FactorySourceSessionResolutionError,
  resolveFactoryDefaultModelId,
} from '../session/factory-session.js';
import { LiveSessions } from '../session/live-sessions.js';
import type { StateSigner } from '../state-signing.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { ChannelIdentityStorage } from '../storage/domains/channel-identity/base.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import type { FilesystemStorage } from '../storage/domains/filesystem/base.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { IntegrationStorage } from '../storage/domains/integrations/base.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { ModelPacksStorage } from '../storage/domains/model-packs/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { QueueHealthStorage } from '../storage/domains/queue-health/base.js';
import {
  SourceControlConnectionNotFoundError,
  type SourceControlStorage,
} from '../storage/domains/source-control/base.js';
import type { FactoryDispatchFailureCode, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { workItemBranch, workItemBranchSource } from '../work-item-branch.js';
import { ConfigRoutes } from './config.js';
import { invalidateCustomProvidersSnapshots } from './custom-provider-source.js';
import { buildFsRoutes } from './fs.js';
import { IntakeRoutes } from './intake.js';
import { KnowledgeRoutes } from './knowledge.js';
import { OAuthRoutes } from './oauth.js';
import type { RouteAuth } from './route.js';
import { SkillRoutes } from './skills.js';
import { invalidateTenantCredentialSnapshots } from './tenant-credentials.js';
import { WorkItemRoutes } from './work-items.js';

const MATERIALIZE_FAILURE_CODE = {
  'git-missing': 'repository_git_missing',
  'egress-blocked': 'repository_egress_blocked',
  'clone-failed': 'repository_clone_failed',
  'pull-failed': 'repository_pull_failed',
  'push-failed': 'repository_push_failed',
  'commit-failed': 'repository_commit_failed',
  'gh-missing': 'repository_cli_missing',
  'pr-failed': 'repository_pr_failed',
} satisfies Record<MaterializeError['code'], FactoryDispatchFailureCode>;
export interface IntegrationRegistration {
  integration: FactoryIntegration;
  ready: boolean;
  ensureReady: () => Promise<void>;
}

export interface FactoryApiRoutesDeps {
  controllerId: string;
  controller: AgentController<MastraCodeState>;
  /** Request-auth seam threaded from the host (no service locator). */
  auth: RouteAuth;
  authStorage: AuthStorage;
  audit: AuditEmitter;
  fsRoot?: string;
  publicOrigin: string;
  stateSigner?: StateSigner;
  /** Sandbox fleet constructed by the factory (disabled when no machine). */
  fleet: SandboxFleet;
  /** Base-checkpoint trigger surface, when the factory constructed one. */
  baseCheckpoints?: BaseCheckpointTriggers;
  /** Root factory storage backend (distributed locks, app-db diagnostics). */
  factoryStorage?: FactoryStorage;
  integrationStorage: IntegrationStorage;
  sourceControlStorage: SourceControlStorage;
  /** App-table domain handles, registered and owned by `MastraFactory.prepare()`. */
  domains: {
    intake: IntakeStorage;
    modelCredentials: ModelCredentialsStorage;
    memorySettings: MemorySettingsStorage;
    customProviders: CustomProvidersStorage;
    filesystem: FilesystemStorage;
    modelPacks: ModelPacksStorage;
    projects: FactoryProjectsStorage;
    queueHealth: QueueHealthStorage;
    workItems: WorkItemsStorage;
    channelIdentity: ChannelIdentityStorage;
  };
  integrations?: IntegrationRegistration[];
  intakeReady: boolean;
  factoryReady: boolean;
  knowledgeEnabled: boolean;
  /** Resolved Factory rule set, threaded from the host (no service locator). */
  rules: FactoryRules;
  factoryTransitionService?: FactoryTransitionService;
  sessionRetirement?: import('../sandbox/session-retirement.js').SessionRetirementCoordinator;
  onFactoryRuntime?: (runtime: {
    transitionService: FactoryTransitionService;
    prepareBinding?: (input: FactoryBindingPreparationInput) => Promise<void>;
  }) => void;
}

function guardIntegrationRoutes({
  integration,
  ready,
  ensureReady,
  routes,
}: IntegrationRegistration & { routes: ApiRoute[] }): ApiRoute[] {
  if (ready) return routes;
  return routes.map(route => {
    if ('handler' in route) {
      const handler = route.handler;
      return {
        ...route,
        handler: async (context: Parameters<typeof handler>[0]) => {
          try {
            await ensureReady();
          } catch {
            return context.json(
              { error: 'integration_unavailable', message: `${integration.id} integration is unavailable.` },
              503,
            );
          }
          return handler(context, async () => {});
        },
      };
    }

    const createHandler = route.createHandler;
    return {
      ...route,
      createHandler: async (args: Parameters<typeof createHandler>[0]) => {
        const handler = await createHandler(args);
        return async (context: Parameters<typeof handler>[0]) => {
          try {
            await ensureReady();
          } catch {
            return context.json(
              { error: 'integration_unavailable', message: `${integration.id} integration is unavailable.` },
              503,
            );
          }
          return handler(context);
        };
      },
    };
  });
}

/**
 * Start a factory run for a rule binding: ensure the source-control session the
 * coordinator requires, then hand it to `prepare` along with the factory's
 * default model. Exported for tests — this is the autonomous entry point with no
 * browser and no interactive user, so nothing else would catch a regression in
 * what it forwards.
 */
export async function prepareFactoryRuleBinding(
  github: GithubIntegration,
  coordinator: Pick<FactoryStartCoordinator, 'prepare'>,
  projects: FactoryProjectsStorage,
  input: FactoryBindingPreparationInput,
): Promise<void> {
  try {
    const branch = workItemBranch({
      id: input.item.id,
      source: workItemBranchSource(input.item.externalSource),
      metadata: input.item.metadata,
    });
    const destinationStage = factoryRuleStage(input.item.stages);
    if (!destinationStage) {
      throw new FactoryDispatchError(
        'unsupported_provider_item',
        'Factory skill invocation requires one exclusive board stage.',
      );
    }
    const repositorySlug =
      typeof input.item.metadata?.repository === 'string' ? input.item.metadata.repository : undefined;
    const preparedSession = await ensureFactorySourceSession({
      sourceControl: github.sourceControlStorage,
      orgId: input.record.orgId,
      factoryProjectId: input.record.factoryProjectId,
      repositorySlug,
      branch,
    });

    await coordinator.prepare({
      orgId: input.record.orgId,
      userId: preparedSession.userId,
      factoryProjectId: input.record.factoryProjectId,
      sessionId: preparedSession.sessionId,
      defaultModelId: await resolveFactoryDefaultModelId(projects, input.record.factoryProjectId),
      threadTitle: `${input.role === 'review' ? 'PR' : 'Issue'}: ${input.item.title}`,
      kickoffKey: input.record.id,
      destinationStage,
      workItem: {
        id: input.item.id,
        role: input.role,
        input: {
          externalSource: input.item.externalSource,
          parentWorkItemId: input.item.parentWorkItemId,
          title: input.item.title,
          stages: ['intake'],
          sessions: input.item.sessions,
          metadata: input.item.metadata,
        },
      },
    });
  } catch (error) {
    if (error instanceof FactoryDispatchError) throw error;
    if (error instanceof FactorySourceSessionResolutionError) {
      const code = error.reason === 'connection' ? 'source_control_missing' : 'source_repository_missing';
      throw new FactoryDispatchError(code, error.message, { cause: error });
    }
    if (error instanceof SourceControlConnectionNotFoundError) {
      throw new FactoryDispatchError('source_control_missing', error.message, { cause: error });
    }
    if (error instanceof MaterializeError) {
      throw new FactoryDispatchError(MATERIALIZE_FAILURE_CODE[error.code], error.message, { cause: error });
    }
    throw error;
  }
}

/**
 * Build the {@link IntegrationContext} handed to an integration when the
 * factory collects its capabilities (routes, workers). One shape everywhere:
 * `assembleFactoryApiRoutes` uses it per registration, and `MastraFactory` uses it
 * when collecting integration workers at finalize.
 */
export function buildIntegrationContext(
  deps: Pick<
    FactoryApiRoutesDeps,
    'controller' | 'publicOrigin' | 'auth' | 'fleet' | 'factoryStorage' | 'integrationStorage' | 'sourceControlStorage'
  > & {
    stateSigner: StateSigner;
    emitAudit?: AuditEmitter['emit'];
    rules: FactoryRules;
    factoryReady: boolean;
    domains: Pick<
      FactoryApiRoutesDeps['domains'],
      'projects' | 'intake' | 'workItems' | 'channelIdentity' | 'memorySettings'
    >;
    /**
     * Stable id of the registered source-control-owning integration (today:
     * `'github'` when registered). Every call site must derive and pass it so
     * `routes()`, `channels()`, and `workers()` all see the same context shape.
     */
    sourceControlOwnerId?: string;
    /** Base-checkpoint trigger surface, when the factory constructed one. */
    baseCheckpoints?: BaseCheckpointTriggers;
  },
  integrationId: string,
): IntegrationContext {
  return {
    auth: deps.auth,
    fleet: deps.fleet,
    ...(deps.baseCheckpoints ? { baseCheckpoints: deps.baseCheckpoints } : {}),
    factoryStorage: deps.factoryStorage,
    baseUrl: deps.publicOrigin,
    controller: deps.controller,
    stateSigner: deps.stateSigner,
    storage: {
      generic: deps.integrationStorage.forIntegration(integrationId),
      sourceControl: deps.sourceControlStorage.forIntegration(integrationId),
      ...(deps.sourceControlOwnerId
        ? { sourceControlOwner: deps.sourceControlStorage.forIntegration(deps.sourceControlOwnerId) }
        : {}),
      projects: deps.domains.projects,
      intake: deps.domains.intake,
      channelIdentity: deps.domains.channelIdentity,
      memorySettings: deps.domains.memorySettings,
    },
    ...(deps.factoryReady ? { rules: { config: deps.rules, workItems: deps.domains.workItems } } : {}),
    ...(deps.emitAudit ? { hooks: { emitAudit: deps.emitAudit } } : {}),
  };
}

/**
 * Disabled-status stub for the well-known integration ids. The SPA polls
 * `/web/github/status` and `/web/linear/status` unconditionally, so when an
 * integration is absent (or not ready) the status contract must still hold.
 * Unknown custom ids get no stub — the SPA doesn't poll them.
 */
function disabledIntegrationStatusRoutes(deps: FactoryApiRoutesDeps, id: string, configured = false): ApiRoute[] {
  if (id === 'github') {
    return [
      registerApiRoute('/web/github/status', {
        method: 'GET',
        requiresAuth: false,
        handler: c =>
          c.json({
            enabled: false,
            connected: false,
            installations: [],
            reason: 'missing_config',
            diagnostics: getGithubFeatureDiagnostics({
              github: undefined,
              auth: deps.auth,
              appDbConfigured: deps.factoryStorage !== undefined,
              stateSigner: deps.stateSigner,
              fleet: deps.fleet,
            }),
          }),
      }),
    ];
  }
  if (id === 'linear') {
    return [
      registerApiRoute('/web/linear/status', {
        method: 'GET',
        requiresAuth: false,
        handler: c =>
          c.json({
            enabled: false,
            connected: false,
            workspace: null,
            reason: 'missing_config',
            diagnostics: {
              linearAppConfigured: configured,
              factoryAuthEnabled: deps.auth.enabled(),
              appDbConfigured: true,
            },
          }),
      }),
    ];
  }
  return [];
}

/**
 * Stub for `GET /web/channel-accounts` when NO Slack integration is
 * registered. The SPA's Connections section polls the path unconditionally;
 * without a stub the SPA fallback serves HTML, which the UI can only read as
 * "old server / unknown". The machine-readable reason lets it say the truth:
 * the integration isn't registered.
 *
 * Mounted only for ABSENT slack — a registered integration owns the path via
 * its connect routes (or, when the state signer is unstable, gets no routes
 * at all and the UI falls back to the generic copy). Static payload, leaks
 * nothing → no auth needed, same posture as the github/linear stubs.
 */
function absentSlackChannelAccountsRoutes(): ApiRoute[] {
  return [
    registerApiRoute('/web/channel-accounts', {
      method: 'GET',
      requiresAuth: false,
      handler: c => c.json({ accounts: [], canConnect: false, reason: 'not_registered' }),
    }),
  ];
}

/**
 * Assemble the custom `/web/*` API routes as Mastra `server.apiRoutes`:
 *   - fs browser routes (project picker), confined to `fsRoot`
 *   - config routes (provider/API-key/model-pack/OM management)
 *   - every registered integration's `routes()` surface (full set when ready,
 *     disabled-status stub otherwise), plus stubs for absent known ids
 */
export function assembleFactoryApiRoutes(deps: FactoryApiRoutesDeps): ApiRoute[] {
  const emitAudit: AuditEmitter['emit'] = args => deps.audit.emit(args);
  const registrations = deps.integrations ?? [];
  const githubRegistration = registrations.find(({ integration }) => integration.id === 'github');
  const githubStorage = githubRegistration ? deps.sourceControlStorage.forIntegration('github') : undefined;
  const githubIntegration = githubRegistration?.integration as GithubIntegration | undefined;

  const integrationRoutes = registrations.flatMap(registration => {
    const { integration } = registration;
    if (!deps.stateSigner) return disabledIntegrationStatusRoutes(deps, integration.id, true);
    const context = buildIntegrationContext(
      {
        ...deps,
        stateSigner: deps.stateSigner,
        emitAudit,
        ...(githubRegistration ? { sourceControlOwnerId: 'github' } : {}),
      },
      integration.id,
    );
    return guardIntegrationRoutes({ ...registration, routes: integration.routes(context) });
  });
  // Absent known integrations still get their disabled-status stub.
  const absentStubs = ['github', 'linear']
    .filter(id => !registrations.some(({ integration }) => integration.id === id))
    .flatMap(id => disabledIntegrationStatusRoutes(deps, id));
  // Absent slack gets the channel-accounts not-registered stub (registered
  // slack owns the path via its own connect routes).
  const slackAbsentStubs = registrations.some(({ integration }) => integration.id === 'slack')
    ? []
    : absentSlackChannelAccountsRoutes();

  const transitionService = deps.factoryReady
    ? (deps.factoryTransitionService ??
      new FactoryTransitionService({ rules: deps.rules, storage: deps.domains.workItems }))
    : undefined;
  const startCoordinator = transitionService
    ? new FactoryStartCoordinator(
        deps.controller,
        deps.domains.workItems,
        transitionService,
        githubIntegration?.sourceControlStorage,
        deps.domains.memorySettings,
      )
    : undefined;
  if (transitionService && startCoordinator) {
    deps.onFactoryRuntime?.({
      transitionService,
      ...(githubIntegration
        ? {
            prepareBinding: (input: FactoryBindingPreparationInput) =>
              prepareFactoryRuleBinding(githubIntegration, startCoordinator, deps.domains.projects, input),
          }
        : {}),
    });
  }

  return [
    ...buildFsRoutes({
      root: deps.fsRoot,
      sessionFs: {
        auth: deps.auth,
        fleet: deps.fleet,
        sessions: deps.sourceControlStorage.forIntegration('github').sessions,
        filesystem: deps.domains.filesystem,
      },
    }),
    ...new ConfigRoutes({
      auth: deps.auth,
      controller: deps.controller,
      authStorage: deps.authStorage,
      modelCredentials: deps.domains.modelCredentials,
      modelPacks: deps.domains.modelPacks,
      sourceControlSessions: deps.sourceControlStorage.forIntegration('github').sessions,
      memorySettings: deps.domains.memorySettings,
      factoryProjects: deps.domains.projects,
      customProviders: deps.domains.customProviders,
      features: { knowledge: deps.knowledgeEnabled },
      onCredentialsChanged: invalidateTenantCredentialSnapshots,
      onCustomProvidersChanged: invalidateCustomProvidersSnapshots,
    }).routes(),
    ...new OAuthRoutes({
      auth: deps.auth,
      authStorage: deps.authStorage,
      modelCredentials: deps.domains.modelCredentials,
      onCredentialsChanged: invalidateTenantCredentialSnapshots,
    }).routes(),
    ...new SkillRoutes({
      auth: deps.auth,
      controllerId: deps.controllerId,
      controller: deps.controller,
      sourceControlStorage: githubStorage,
      ensureSourceControlReady: githubRegistration?.ensureReady,
    }).routes(),
    ...integrationRoutes,
    ...absentStubs,
    ...slackAbsentStubs,
    ...(deps.intakeReady
      ? new IntakeRoutes({
          auth: deps.auth,
          audit: deps.audit,
          intake: deps.domains.intake,
          projects: deps.domains.projects,
          integrations: (deps.integrations ?? []).flatMap(({ integration }) =>
            integration.intake ? [{ id: integration.id, intake: integration.intake }] : [],
          ),
        }).routes()
      : []),
    ...(deps.factoryReady && deps.knowledgeEnabled
      ? new KnowledgeRoutes({
          auth: deps.auth,
          projects: deps.domains.projects,
          knowledge: async () => deps.factoryStorage?.getMastraStorage().getStore('knowledge'),
        }).routes()
      : []),
    ...(deps.factoryReady
      ? new WorkItemRoutes({
          auth: deps.auth,
          audit: deps.audit,
          projects: deps.domains.projects,
          workItems: deps.domains.workItems,
          queueHealth: deps.domains.queueHealth,
          transitionService,
          startCoordinator,
          liveSessions: new LiveSessions(deps.controller),
        }).routes()
      : []),
  ];
}
