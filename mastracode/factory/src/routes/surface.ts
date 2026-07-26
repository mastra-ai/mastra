import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { FactoryStorage } from '@mastra/core/storage';

import type { FactoryIntegration, IntegrationContext } from '../integrations/base.js';
import { getGithubFeatureDiagnostics } from '../integrations/github/config.js';
import { ensureFactoryRuleSession } from '../integrations/github/factory-session.js';
import type { GithubIntegration } from '../integrations/github/integration.js';
import { FactoryTransitionApprovalService } from '../rules/approval-service.js';
import type { FactoryBindingPreparationInput } from '../rules/dispatcher.js';
import { FactoryGithubEventService } from '../rules/github-service.js';
import { FactoryLinearIssueService } from '../rules/linear-service.js';
import type { FactoryRunLifecycleObserver } from '../rules/run-lifecycle-observer.js';
import { FactoryStartCoordinator } from '../rules/start-coordinator.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryRules } from '../rules/types.js';
import type { SandboxFleet } from '../sandbox/fleet.js';
import type { StateSigner } from '../state-signing.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { IntegrationStorage } from '../storage/domains/integrations/base.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { ModelPacksStorage } from '../storage/domains/model-packs/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { QueueHealthStorage } from '../storage/domains/queue-health/base.js';
import type { SourceControlStorage } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { ConfigRoutes } from './config.js';
import { invalidateCustomProvidersSnapshots } from './custom-provider-source.js';
import { buildFsRoutes } from './fs.js';
import { IntakeRoutes } from './intake.js';
import { OAuthRoutes } from './oauth.js';
import type { RouteAuth } from './route.js';
import { SkillRoutes } from './skills.js';
import { invalidateTenantCredentialSnapshots } from './tenant-credentials.js';
import { WorkItemRoutes } from './work-items.js';

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
    modelPacks: ModelPacksStorage;
    projects: FactoryProjectsStorage;
    queueHealth: QueueHealthStorage;
    workItems: WorkItemsStorage;
  };
  integrations?: IntegrationRegistration[];
  intakeReady: boolean;
  factoryReady: boolean;
  /** Resolved Factory rule set, threaded from the host (no service locator). */
  rules: FactoryRules;
  factoryTransitionService?: FactoryTransitionService;
  runLifecycleObserver?: Pick<FactoryRunLifecycleObserver, 'observe' | 'subscribeIdle'>;
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

export function factoryRuleBranch(item: FactoryBindingPreparationInput['item']): string {
  const metadata = item.metadata ?? {};
  const issueNumber = metadata.githubIssueNumber ?? metadata.number;
  if (
    item.externalSource?.integrationId === 'github' &&
    item.externalSource.type === 'issue' &&
    typeof issueNumber === 'number'
  ) {
    return `factory/issue-${issueNumber}`;
  }
  const pullRequestNumber = metadata.githubPullRequestNumber ?? metadata.number;
  if (
    item.externalSource?.integrationId === 'github' &&
    item.externalSource.type === 'pull-request' &&
    typeof pullRequestNumber === 'number'
  ) {
    return `factory/pr-${pullRequestNumber}`;
  }
  throw new Error('Factory skill invocation requires a GitHub issue or pull request number.');
}

async function prepareFactoryRuleBinding(
  github: GithubIntegration,
  coordinator: FactoryStartCoordinator,
  input: FactoryBindingPreparationInput,
): Promise<void> {
  const branch = factoryRuleBranch(input.item);
  const repositorySlug =
    typeof input.item.metadata?.repository === 'string' ? input.item.metadata.repository : undefined;
  const preparedSession = await ensureFactoryRuleSession({
    github,
    orgId: input.record.orgId,
    factoryProjectId: input.record.factoryProjectId,
    repositorySlug,
    branch,
  });
  const destinationStage = input.item.stages.length === 1 ? input.item.stages[0] : undefined;
  if (!destinationStage) throw new Error('Factory skill invocation requires one exclusive board stage.');

  await coordinator.prepare({
    orgId: input.record.orgId,
    userId: preparedSession.userId,
    factoryProjectId: input.record.factoryProjectId,
    sessionId: preparedSession.sessionId,
    threadTitle: `${input.role === 'review' ? 'PR' : 'Issue'}: ${input.item.title}`,
    kickoffKey: input.record.id,
    destinationStage: destinationStage as 'intake' | 'triage' | 'planning' | 'execute' | 'review' | 'done',
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
    domains: Pick<FactoryApiRoutesDeps['domains'], 'projects' | 'intake'>;
  },
  integrationId: string,
): IntegrationContext {
  return {
    auth: deps.auth,
    fleet: deps.fleet,
    factoryStorage: deps.factoryStorage,
    baseUrl: deps.publicOrigin,
    controller: deps.controller,
    stateSigner: deps.stateSigner,
    storage: {
      generic: deps.integrationStorage.forIntegration(integrationId),
      sourceControl: deps.sourceControlStorage.forIntegration(integrationId),
      projects: deps.domains.projects,
      intake: deps.domains.intake,
    },
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
  const linearRegistration = registrations.find(({ integration }) => integration.id === 'linear');
  const githubStorage = githubRegistration ? deps.sourceControlStorage.forIntegration('github') : undefined;
  const githubIntegration = githubRegistration?.integration as GithubIntegration | undefined;
  const workItems = deps.factoryReady ? deps.domains.workItems : undefined;
  const githubEventService =
    githubIntegration && githubStorage && workItems
      ? new FactoryGithubEventService({
          github: githubIntegration,
          sourceControl: githubStorage,
          integrationStorage: deps.integrationStorage.forIntegration('github'),
          projects: deps.domains.projects,
          storage: workItems,
          rules: deps.rules,
        })
      : undefined;
  const linearIssueService =
    linearRegistration && workItems
      ? new FactoryLinearIssueService({
          projects: deps.domains.projects,
          storage: workItems,
          rules: deps.rules,
        })
      : undefined;

  const integrationRoutes = registrations.flatMap(registration => {
    const { integration } = registration;
    if (!deps.stateSigner) return disabledIntegrationStatusRoutes(deps, integration.id, true);
    const context = buildIntegrationContext({ ...deps, stateSigner: deps.stateSigner, emitAudit }, integration.id);
    if (integration.id === 'github') {
      context.hooks = {
        ...context.hooks,
        ...(githubEventService ? { ingestGithubEvent: event => githubEventService.ingest(event) } : {}),
      };
    }
    if (integration.id === 'linear' && linearIssueService) {
      context.hooks = { ...context.hooks, ingestLinearIssues: input => linearIssueService.ingest(input) };
    }
    return guardIntegrationRoutes({ ...registration, routes: integration.routes(context) });
  });
  // Absent known integrations still get their disabled-status stub.
  const absentStubs = ['github', 'linear']
    .filter(id => !registrations.some(({ integration }) => integration.id === id))
    .flatMap(id => disabledIntegrationStatusRoutes(deps, id));

  const transitionService = deps.factoryReady
    ? (deps.factoryTransitionService ??
      new FactoryTransitionService({ rules: deps.rules, storage: deps.domains.workItems }))
    : undefined;
  const approvalService = deps.factoryReady
    ? new FactoryTransitionApprovalService({ storage: deps.domains.workItems })
    : undefined;
  const startCoordinator = transitionService
    ? new FactoryStartCoordinator(
        deps.controller,
        deps.domains.workItems,
        transitionService,
        githubIntegration?.sourceControlStorage,
        deps.domains.memorySettings,
        deps.runLifecycleObserver,
      )
    : undefined;
  if (transitionService && startCoordinator) {
    deps.onFactoryRuntime?.({
      transitionService,
      ...(githubIntegration
        ? {
            prepareBinding: (input: FactoryBindingPreparationInput) =>
              prepareFactoryRuleBinding(githubIntegration, startCoordinator, input),
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
      },
    }),
    ...new ConfigRoutes({
      auth: deps.auth,
      controller: deps.controller,
      authStorage: deps.authStorage,
      modelCredentials: deps.domains.modelCredentials,
      modelPacks: deps.domains.modelPacks,
      memorySettings: deps.domains.memorySettings,
      customProviders: deps.domains.customProviders,
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
    ...(deps.intakeReady
      ? new IntakeRoutes({
          auth: deps.auth,
          audit: deps.audit,
          intake: deps.domains.intake,
          integrations: (deps.integrations ?? []).flatMap(({ integration }) =>
            integration.intake ? [{ id: integration.id, intake: integration.intake }] : [],
          ),
        }).routes()
      : []),
    ...(deps.factoryReady
      ? new WorkItemRoutes({
          auth: deps.auth,
          audit: deps.audit,
          projects: deps.domains.projects,
          workItems: deps.domains.workItems,
          queueHealth: deps.domains.queueHealth,
          approvalService: approvalService!,
          transitionService,
          startCoordinator,
        }).routes()
      : []),
  ];
}
