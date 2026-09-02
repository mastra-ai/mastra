import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute, IUserProvider } from '@mastra/core/server';
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
import { factoryLaneForRole, factoryRuleStage } from '../rules/types.js';
import type { MastraFactorySandboxConfig } from '../sandbox/session-sandbox.js';
import {
  ensureFactorySourceSession,
  FactorySourceSessionResolutionError,
  resolveFactoryDefaultModelId,
  resolveFactoryProjectForSession,
} from '../session/factory-session.js';
import type { EnsuredFactorySourceSession } from '../session/factory-session.js';
import { LiveSessions } from '../session/live-sessions.js';
import type { StateSigner } from '../state-signing.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { ChannelIdentityStorage } from '../storage/domains/channel-identity/base.js';
import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type { CommentsDomain } from '../storage/domains/comments/domain.js';
import { FactoryFeedReader } from '../storage/domains/comments/feed-context.js';
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
import {
  isAgentActor,
  type FactoryDispatchFailureCode,
  type WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
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
  /** Optional user directory for resolving persisted owners to display profiles. */
  users?: Pick<IUserProvider, 'getUser' | 'getUsers'>;
  authStorage: AuthStorage;
  audit: AuditEmitter;
  fsRoot?: string;
  publicOrigin: string;
  stateSigner?: StateSigner;
  /** Sandbox surface (enablement, provider label, create callback). */
  sandbox?: MastraFactorySandboxConfig;
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
    comments: WorkItemCommentsStorage;
  };
  integrations?: IntegrationRegistration[];
  intakeReady: boolean;
  factoryReady: boolean;
  knowledgeEnabled: boolean;
  /** Resolved Factory rule set, threaded from the host (no service locator). */
  rules: FactoryRules;
  /** Work-item feed service, handed to integrations that ingest platform messages. */
  feed: CommentsDomain;
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
 * Resolve the source-control session the work item already holds for this role,
 * when it still resolves to the item's org and factory project. Returns
 * `undefined` when there is no ref or the ref no longer resolves, so the caller
 * falls back to minting one.
 */
async function reuseBoundSession(
  sourceControl: GithubIntegration['sourceControlStorage'],
  input: FactoryBindingPreparationInput,
): Promise<EnsuredFactorySourceSession | undefined> {
  const ref = input.item.sessions[input.role];
  if (!ref) return undefined;
  // At least as strict as the coordinator's resolveSourceSession: a ref it
  // would reject must fall through to minting, not hard-fail the run.
  const resolved = await resolveFactoryProjectForSession({ sourceControl, sessionId: ref.sessionId });
  if (
    !resolved ||
    resolved.orgId !== input.record.orgId ||
    resolved.factoryProjectId !== input.record.factoryProjectId
  ) {
    return undefined;
  }
  const session = await sourceControl.sessions.getBySessionId(ref.sessionId);
  if (!session) return undefined;
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    projectRepositoryId: session.projectRepositoryId,
    branch: session.branch,
    baseBranch: session.baseBranch,
  };
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
    // Only the Intake exit derives a lane from the role: roles don't own lanes,
    // and the Done close-out running in the triage seat must not drag the card back.
    const currentStage = factoryRuleStage(input.item.stages);
    const destinationStage = currentStage === 'intake' ? factoryLaneForRole(input.role) : currentStage;
    if (!destinationStage) {
      throw new FactoryDispatchError(
        'unsupported_provider_item',
        `Factory skill invocation has no destination lane (role "${input.role}", stages [${input.item.stages.join(', ')}]).`,
      );
    }
    const repositorySlug =
      typeof input.item.metadata?.repository === 'string' ? input.item.metadata.repository : undefined;
    // Re-preparing a binding (server restart, retired controller session) must
    // land in the role's existing session: minting a replacement would repoint
    // the work item, flip the session's owner to the approver, and orphan the
    // previous sandbox.
    const approver = input.record.approvedBy ?? undefined;
    const preparedSession =
      (await reuseBoundSession(github.sourceControlStorage, input)) ??
      (await ensureFactorySourceSession({
        sourceControl: github.sourceControlStorage,
        orgId: input.record.orgId,
        factoryProjectId: input.record.factoryProjectId,
        repositorySlug,
        branch,
        // A person who approved the run is its interactive user: attribute it to
        // them, not the repo connector. An agent's pre-approval names no person.
        attributeToUserId: isAgentActor(approver) ? undefined : approver,
      }));

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
    | 'controller'
    | 'publicOrigin'
    | 'auth'
    | 'sandbox'
    | 'users'
    | 'factoryStorage'
    | 'integrationStorage'
    | 'sourceControlStorage'
  > & {
    stateSigner: StateSigner;
    emitAudit?: AuditEmitter['emit'];
    rules: FactoryRules;
    factoryReady: boolean;
    /** Work-item feed service, so a channel integration can ingest platform messages. */
    feed: CommentsDomain;
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
  },
  integrationId: string,
): IntegrationContext {
  return {
    auth: deps.auth,
    sandbox: deps.sandbox,
    ...(deps.users ? { users: deps.users } : {}),
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
    ...(deps.factoryReady ? { workItems: deps.domains.workItems, feed: deps.feed } : {}),
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
              sandbox: deps.sandbox,
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
        new FactoryFeedReader(deps.domains.comments),
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
      memorySettings: deps.domains.memorySettings,
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
          comments: deps.domains.comments,
          queueHealth: deps.domains.queueHealth,
          transitionService,
          startCoordinator,
          liveSessions: new LiveSessions(deps.controller),
        }).routes()
      : []),
  ];
}
