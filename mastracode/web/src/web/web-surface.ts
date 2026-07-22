import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { MastraCodeState } from '@mastra/code-sdk/schema';

import type { AuditEmitter } from './audit/domain.js';
import { buildConfigRoutes } from './config-routes.js';
import type { FactoryIntegration, IntegrationContext } from './factory-integration.js';
import { getGithubFeatureDiagnostics } from './github/config.js';
import { getLinearFeatureDiagnostics } from './linear/config.js';
import { buildFactoryRoutes } from './factory/routes.js';
import { FactoryGithubEventService } from './factory/rules/github-service.js';
import { FactoryLinearIssueService } from './factory/rules/linear-service.js';
import type { FactoryBindingPreparationInput } from './factory/rules/dispatcher.js';
import { FactoryStartCoordinator } from './factory/rules/start-coordinator.js';
import { FactoryTransitionService } from './factory/rules/transition-service.js';
import { buildFsRoutes } from './fs-routes.js';
import { ensureFactoryRuleSession } from './github/factory-session.js';
import type { GithubIntegration } from './github/integration.js';
import { buildIntakeRoutes } from './intake/routes.js';
import { buildOAuthRoutes } from './oauth-routes.js';
import { getFactoryStorage, getSeededFactoryRules } from './runtime-config.js';
import type { FactoryProjectsStorage } from './storage/domains/projects/base.js';
import type { WorkItemsStorage } from './storage/domains/work-items/base.js';
import { registerSandboxReattach } from './sandbox-reattach-registration.js';
import { buildSkillRoutes } from './skills/routes.js';
import type { StateSigner } from './state-signing.js';
import type { IntegrationStorage } from './storage/domains/integrations/base.js';
import type { SourceControlStorage } from './storage/domains/source-control/base.js';

registerSandboxReattach();

export interface IntegrationRegistration {
  integration: FactoryIntegration;
  ready: boolean;
  ensureReady: () => Promise<void>;
}

export interface WebApiRoutesDeps {
  controllerId: string;
  controller: AgentController<MastraCodeState>;
  authStorage: AuthStorage;
  audit: AuditEmitter;
  fsRoot?: string;
  publicOrigin: string;
  stateSigner?: StateSigner;
  integrationStorage: IntegrationStorage;
  sourceControlStorage: SourceControlStorage;
  integrations?: IntegrationRegistration[];
  intakeReady: boolean;
  factoryReady: boolean;
  factoryTransitionService?: FactoryTransitionService;
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
 * `assembleWebApiRoutes` uses it per registration, and `MastraFactory` uses it
 * when collecting integration workers at finalize.
 */
export function buildIntegrationContext(
  deps: Pick<WebApiRoutesDeps, 'controller' | 'publicOrigin' | 'integrationStorage' | 'sourceControlStorage'> & {
    stateSigner: StateSigner;
    emitAudit?: AuditEmitter['emit'];
  },
  integrationId: string,
): IntegrationContext {
  return {
    baseUrl: deps.publicOrigin,
    controller: deps.controller,
    stateSigner: deps.stateSigner,
    storage: {
      generic: deps.integrationStorage.forIntegration(integrationId),
      sourceControl: deps.sourceControlStorage.forIntegration(integrationId),
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
function disabledIntegrationStatusRoutes(id: string): ApiRoute[] {
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
            diagnostics: getGithubFeatureDiagnostics(),
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
            diagnostics: getLinearFeatureDiagnostics(),
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
export function assembleWebApiRoutes(deps: WebApiRoutesDeps): ApiRoute[] {
  const emitAudit: AuditEmitter['emit'] = args => deps.audit.emit(args);
  const registrations = deps.integrations ?? [];
  const githubRegistration = registrations.find(({ integration }) => integration.id === 'github');
  const linearRegistration = registrations.find(({ integration }) => integration.id === 'linear');
  const githubStorage = githubRegistration ? deps.sourceControlStorage.forIntegration('github') : undefined;
  const githubIntegration = githubRegistration?.integration as GithubIntegration | undefined;
  const workItems = deps.factoryReady ? getFactoryStorage().getDomain<WorkItemsStorage>('work-items') : undefined;
  const githubEventService =
    githubIntegration && githubStorage && workItems
      ? new FactoryGithubEventService({
          github: githubIntegration,
          sourceControl: githubStorage,
          integrationStorage: deps.integrationStorage.forIntegration('github'),
          storage: workItems,
          rules: getSeededFactoryRules()!,
        })
      : undefined;
  const linearIssueService =
    linearRegistration && workItems
      ? new FactoryLinearIssueService({
          projects: getFactoryStorage().getDomain<FactoryProjectsStorage>('projects'),
          storage: workItems,
          rules: getSeededFactoryRules()!,
        })
      : undefined;

  const integrationRoutes = registrations.flatMap(registration => {
    const { integration } = registration;
    if (!deps.stateSigner) return disabledIntegrationStatusRoutes(integration.id);
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
    .flatMap(disabledIntegrationStatusRoutes);
  const factoryRoutes = (() => {
    if (!deps.factoryReady || !workItems) return [];
    const transitionService =
      deps.factoryTransitionService ??
      new FactoryTransitionService({ rules: getSeededFactoryRules(), storage: workItems });
    const startCoordinator = new FactoryStartCoordinator(
      deps.controller,
      workItems,
      transitionService,
      githubIntegration?.sourceControlStorage,
    );
    deps.onFactoryRuntime?.({
      transitionService,
      ...(githubIntegration
        ? {
            prepareBinding: (input: FactoryBindingPreparationInput) =>
              prepareFactoryRuleBinding(githubIntegration, startCoordinator, input),
          }
        : {}),
    });
    return buildFactoryRoutes({
      audit: deps.audit,
      transitionService,
      startCoordinator,
      decisionStorage: workItems,
    });
  })();
  return [
    ...buildFsRoutes({ root: deps.fsRoot }),
    ...buildConfigRoutes({ controller: deps.controller, authStorage: deps.authStorage }),
    ...buildOAuthRoutes({ authStorage: deps.authStorage }),
    ...buildSkillRoutes({
      controllerId: deps.controllerId,
      controller: deps.controller,
      sourceControlStorage: githubStorage,
      ensureSourceControlReady: githubRegistration?.ensureReady,
    }),
    ...integrationRoutes,
    ...absentStubs,
    ...(deps.intakeReady
      ? buildIntakeRoutes({
          audit: deps.audit,
          integrations: (deps.integrations ?? []).flatMap(({ integration }) =>
            integration.intake ? [{ id: integration.id, intake: integration.intake }] : [],
          ),
        })
      : []),
    ...factoryRoutes,
  ];
}
