import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute, IUserProvider } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { InlineSkill } from '@mastra/core/skills';
import type { FactoryStorage } from '@mastra/core/storage';
import type { FactorySandbox } from '@mastra/core/workspace';

import {
  boardFlow,
  boardForWorkItem,
  hasPullRequest,
  isPullRequestReviewPhase,
  REVIEW_CONTEXT,
  reviewedChangeRequest,
} from '../boards/index.js';
import type { BoardRegistry, InstalledBoard } from '../boards/index.js';
import { legacyPlanRoleFor, workLaneForRole } from '../boards/legacy-plan-role.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardCache, ProjectBoardSource } from '../boards/project-boards.js';
import type { FactoryIntegration, IntegrationContext, IntegrationHooks } from '../integrations/base.js';
import { getGithubFeatureDiagnostics } from '../integrations/github/config.js';
import type { GithubIntegration } from '../integrations/github/integration.js';
import { MaterializeError } from '../integrations/github/sandbox.js';
import type { CardSource } from '../integrations/kept-cards.js';
import { FactoryDispatchError } from '../rules/dispatch-errors.js';
import type { FactoryBindingPreparationInput } from '../rules/dispatcher.js';
import { FactoryStartCoordinator } from '../rules/start-coordinator.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { workItemSource } from '../rules/types.js';
import type { FactoryRuleActor } from '../rules/types.js';
import { secretKeyMismatchHint, secretKeyProblem } from '../secret-encryption.js';
import {
  createSourceControlSessionLookup,
  ensureFactorySourceSession,
  FactorySourceSessionResolutionError,
  resolveFactorySourceControl,
  requireOrganizationModelKey,
} from '../session/factory-session.js';
import type { EnsuredFactorySourceSession, OrganizationModelSources } from '../session/factory-session.js';
import type { LiveSessions } from '../session/live-sessions.js';
import { resolveWorkItemRepository } from '../session/work-item-repository.js';
import type { StateSigner } from '../state-signing.js';
import { isHumanActorId } from '../storage/domains/audit/actors.js';
import type { AuditEmitter, AuditRecorder } from '../storage/domains/audit/domain.js';
import type { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { ChannelIdentityStorage } from '../storage/domains/channel-identity/base.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import type { FilesystemStorage } from '../storage/domains/filesystem/base.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { IntegrationStorage } from '../storage/domains/integrations/base.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { effectiveModelScope, factoryPrincipalId, isFactoryPrincipalId } from '../storage/domains/projects/base.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { QueueHealthStorage } from '../storage/domains/queue-health/base.js';
import type { SkillOverridesStorage } from '../storage/domains/skill-overrides/base.js';
import {
  SessionBranchHeldError,
  SessionOwnershipMismatchError,
  SourceControlConnectionNotFoundError,
} from '../storage/domains/source-control/base.js';
import type { SourceControlStorage, SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { VoiceSettingsStorage } from '../storage/domains/voice-settings/base.js';
import type { FactoryDispatchFailureCode, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import {
  legacyGithubWorkItemBranch,
  pullRequestBranch,
  workItemBranch,
  workItemBranchSource,
  workItemThreadTitle,
} from '../work-item-branch.js';
import type { WorkItemBranchSource } from '../work-item-branch.js';
import { buildAutomationRunRoutes } from './automation-runs.js';
import { BoardRoutes } from './boards.js';
import { ConfigRoutes } from './config.js';
import { invalidateCustomProvidersSnapshots } from './custom-provider-source.js';
import { buildFsRoutes } from './fs.js';
import { IntakeRouteRoutes } from './intake-routes.js';
import { IntakeRoutes } from './intake.js';
import { KnowledgeRoutes } from './knowledge.js';
import { OAuthRoutes } from './oauth.js';
import type { RouteAuth } from './route.js';
import { SkillRoutes } from './skills.js';
import { buildSourceControlSessionRoutes } from './source-control-sessions.js';
import { buildSourceControlSettingsRoutes } from './source-control-settings.js';
import { invalidateTenantCredentialSnapshots } from './tenant-credentials.js';
import { VoiceRoutes } from './voice.js';
import { WorkItemRoutes } from './work-items.js';

const MATERIALIZE_FAILURE_CODE = {
  'git-missing': 'repository_git_missing',
  'sandbox-unresponsive': 'repository_sandbox_unresponsive',
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
  /** Registry of the sessions this process holds, owned by the host so it can watch them too. */
  liveSessions: LiveSessions;
  /** Request-auth seam threaded from the host (no service locator). */
  auth: RouteAuth;
  /** Optional user directory for resolving persisted owners to display profiles. */
  users?: Pick<IUserProvider, 'getUser' | 'getUsers'>;
  authStorage: AuthStorage;
  audit: AuditEmitter & AuditRecorder;
  fsRoot?: string;
  publicOrigin: string;
  stateSigner?: StateSigner;
  /** Sandbox surface (enablement, provider label, create callback). */
  sandbox?: FactorySandbox;
  /** Push hand-off for environment builds, present when the sandbox can build templates. */
  onRepositoryPush?: IntegrationHooks['onRepositoryPush'];
  /** Saved-environment hand-off for environment builds, present when the sandbox can build templates. */
  onEnvironmentSaved?: (projectId: string) => void;
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
    modelDefaults: ModelDefaultsStorage;
    projects: FactoryProjectsStorage;
    queueHealth: QueueHealthStorage;
    workItems: WorkItemsStorage;
    channelIdentity: ChannelIdentityStorage;
    skillOverrides: SkillOverridesStorage;
    voiceSettings: VoiceSettingsStorage;
  };
  integrations?: IntegrationRegistration[];
  intakeReady: boolean;
  factoryReady: boolean;
  knowledgeEnabled: boolean;
  /** The Factory MCP endpoint is mounted; surfaced so the UI can show its URL. */
  mcpEnabled: boolean;
  /** Providers the operator opted in to run on the server process's own credentials. */
  deploymentModelProviders?: ReadonlySet<string>;
  /** App skills from `MastraFactory({ skills })`. */
  skills?: readonly InlineSkill[];
  knowledgeKey?: string;
  /** Resolved Factory rule set, threaded from the host (no service locator). */
  configVersion: string;
  /** Each project's boards; integrations use the code boards (`codeRegistry`). */
  boardRegistry: BoardRegistry | ProjectBoardSource;
  /** Stored boards and their cache; mounts the board management routes when present. */
  storedBoards?: { storage: StoredBoardsStorage; cache: ProjectBoardCache };
  factoryTransitionService?: FactoryTransitionService;
  sessionRetirement?: import('../sandbox/session-retirement.js').SessionRetirementCoordinator;
  /** Moves a thread with its observation vectors onto another memory resource. */
  moveThread?: (input: { threadId: string; resourceId: string }) => Promise<unknown>;
  /** This process's dispatcher run slots, for the run queue; `undefined` until the dispatcher exists. */
  runSlots?: () => { inUse: number; cap: number; interactive: { inUse: number; cap: number } } | undefined;
  onFactoryRuntime?: (runtime: {
    transitionService: FactoryTransitionService;
    startCoordinator: FactoryStartCoordinator;
    prepareBinding?: (input: FactoryBindingPreparationInput) => Promise<void>;
  }) => void;
}

const REPEAT_UNAVAILABLE_LOG_MS = 5 * 60_000;

function guardIntegrationRoutes({
  integration,
  ready,
  ensureReady,
  routes,
}: IntegrationRegistration & { routes: ApiRoute[] }): ApiRoute[] {
  if (ready) return routes;
  // Each retry throws a fresh error, so dedupe by message and repeat it periodically.
  let lastReported: { message: string; at: number } | undefined;
  const checkReady = async () => {
    try {
      await ensureReady();
      return undefined;
    } catch (error) {
      // The response only names a key mismatch, so this log is the only trace of any other cause.
      const message = String(error);
      const now = Date.now();
      if (lastReported?.message !== message || now - lastReported.at >= REPEAT_UNAVAILABLE_LOG_MS) {
        lastReported = { message, at: now };
        console.error(
          `[factory] ${integration.id} integration is unavailable: its storage failed to initialize:`,
          error,
        );
      }
      const cause =
        secretKeyMismatchHint(error) ??
        `Its storage failed to start. The server log line "[factory] ${integration.id} integration is unavailable" has the cause.`;
      return { error: 'integration_unavailable', message: `${integration.id} integration is unavailable. ${cause}` };
    }
  };
  return routes.map(route => {
    if ('handler' in route) {
      const handler = route.handler;
      return {
        ...route,
        handler: async (context: Parameters<typeof handler>[0]) => {
          const unavailable = await checkReady();
          if (unavailable) return context.json(unavailable, 503);
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
          const unavailable = await checkReady();
          if (unavailable) return context.json(unavailable, 503);
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
  sourceControl: SourceControlStorageHandle,
  input: FactoryBindingPreparationInput,
  role: string = input.role,
): Promise<EnsuredFactorySourceSession | undefined> {
  const ref = input.item.sessions[role];
  if (!ref) return undefined;
  // At least as strict as the coordinator's resolveSourceSession: a ref it
  // would reject must fall through to minting, not hard-fail the run.
  const session = await sourceControl.sessions.getBySessionId(ref.sessionId);
  if (
    !session?.projectRepositoryId ||
    session.orgId !== input.record.orgId ||
    session.factoryProjectId !== input.record.factoryProjectId
  ) {
    return undefined;
  }
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    projectRepositoryId: session.projectRepositoryId,
    branch: session.branch,
    baseBranch: session.baseBranch,
  };
}

/**
 * Work cards planned before Planning moved into the `work` context hold the
 * plan's session under `plan`. Building continues in it, on the same branch and
 * repository a fresh session would use, so those cards keep the plan's context.
 */
async function legacyPlanSession(
  sourceControl: SourceControlStorageHandle,
  input: FactoryBindingPreparationInput,
  boardId: string,
  branch: string,
  projectRepositoryId: string,
): Promise<EnsuredFactorySourceSession | undefined> {
  const legacyRole = legacyPlanRoleFor(boardId, input.role);
  if (!legacyRole) return undefined;
  const session = await reuseBoundSession(sourceControl, input, legacyRole);
  if (
    session &&
    (session.branch === branch || session.branch === legacyGithubWorkItemBranch(branch)) &&
    session.projectRepositoryId === projectRepositoryId
  ) {
    return session;
  }
  return undefined;
}

function sameBranch(held: string, branch: string): boolean {
  return held === branch || held === legacyGithubWorkItemBranch(branch);
}

/** The branch a binding's session works on: the reviewed pull request's for PR review of an attached one. */
function reviewBranch(
  input: FactoryBindingPreparationInput,
  board: InstalledBoard | undefined,
  stage: string,
  source: WorkItemBranchSource,
): string {
  const metadata = input.item.workItem.metadata;
  if (input.role === REVIEW_CONTEXT && isPullRequestReviewPhase(board, stage)) {
    const change = reviewedChangeRequest({ ...input.item, source });
    if (change && !change.standalone && change.number !== undefined) {
      return pullRequestBranch({ id: input.item.id, provider: change.provider, number: change.number });
    }
  }
  return workItemBranch({ id: input.item.id, source, metadata });
}

/**
 * The lane a run started on a resting card moves it to: a review of a card with a pull request
 * goes to the board's pull request review; otherwise the first phase that runs in the role's
 * context. Work's phases share contexts, so its roles keep their own lanes: `work` builds and
 * the old `plan` role plans.
 */
function restingExitLane(board: InstalledBoard | undefined, role: string, hasPullRequest: boolean): string | undefined {
  const pullRequestReview = boardFlow(board).pullRequestReview;
  if (hasPullRequest && role === REVIEW_CONTEXT && pullRequestReview) return pullRequestReview;
  return workLaneForRole(board, role) ?? board?.phaseForRole(role);
}

/** What the autonomous start reads to decide who a phase session runs as. */
export interface PhaseSessionOwnerSources extends OrganizationModelSources {
  workItems?: Pick<WorkItemsStorage, 'findRunBindingById'>;
}

/**
 * Who a newly minted phase session runs as. Wherever runs use the Factory's credentials
 * that is the Factory itself, whoever moved the card: the mover is the actor on the move,
 * not the owner of the run. A Factory whose runs use personal credentials has no keys of
 * its own, so there a person owns the run: whoever moved or approved the card, or the user
 * of the session whose agent moved it, else whoever created the Factory. `undefined`
 * leaves the last resort to the caller: whoever connected the repository.
 */
async function phaseSessionOwner(args: {
  sourceControl: SourceControlStorageHandle;
  workItems: Pick<WorkItemsStorage, 'findRunBindingById'> | undefined;
  project: FactoryProject;
  approver: string | undefined;
}): Promise<string | undefined> {
  const { sourceControl, workItems, project, approver } = args;
  if (effectiveModelScope(project.modelScope, 'run') === 'factory') return factoryPrincipalId(project.id);
  if (approver?.startsWith('agent:')) {
    // `agent:session:<sessionId>` is a person's own session; `agent:<bindingId>` a phase run.
    const ref = approver.slice('agent:'.length);
    const sessionId = ref.startsWith('session:')
      ? ref.slice('session:'.length)
      : (await workItems?.findRunBindingById({ orgId: project.orgId, factoryProjectId: project.id, id: ref }))
          ?.sessionId;
    const session = sessionId ? await sourceControl.sessions.getBySessionId(sessionId) : null;
    if (session && session.orgId === project.orgId && isHumanActorId(session.userId)) return session.userId;
  } else if (isHumanActorId(approver)) {
    return approver;
  }
  return isHumanActorId(project.createdBy) ? project.createdBy : undefined;
}

/**
 * Who started the work, as the move that starts the run records them. An agent stays an
 * agent: recorded as a person, its move would count as a person accepting the work.
 */
async function starterOf(
  workItems: Pick<WorkItemsStorage, 'findRunBindingById'> | undefined,
  project: Pick<FactoryProject, 'id' | 'orgId'>,
  approver: string,
): Promise<FactoryRuleActor> {
  if (!approver.startsWith('agent:')) return { type: 'human', id: approver };
  const bindingId = approver.slice('agent:'.length);
  if (bindingId.startsWith('session:')) return { type: 'agent', bindingId, role: 'session' };
  const binding = await workItems?.findRunBindingById({
    orgId: project.orgId,
    factoryProjectId: project.id,
    id: bindingId,
  });
  return { type: 'agent', bindingId, role: binding?.role ?? 'agent' };
}

/**
 * Start a factory run for a rule binding: ensure the source-control session the
 * coordinator requires, then hand it to `prepare` along with the factory's
 * default model. Exported for tests — this is the autonomous entry point with no
 * browser and no interactive user, so nothing else would catch a regression in
 * what it forwards.
 */
export async function prepareFactoryRuleBinding(
  sourceControlProvider: SourceControlStorageHandle | Pick<GithubIntegration, 'sourceControlStorage'>,
  coordinator: Pick<FactoryStartCoordinator, 'prepare'>,
  projects: FactoryProjectsStorage,
  boards: BoardRegistry | ProjectBoardSource,
  input: FactoryBindingPreparationInput,
  intake?: Pick<IntakeStorage, 'getConfig'>,
  owner?: PhaseSessionOwnerSources,
): Promise<void> {
  try {
    const sourceControl =
      'sourceControlStorage' in sourceControlProvider
        ? sourceControlProvider.sourceControlStorage
        : sourceControlProvider;
    const source = workItemBranchSource(input.item.externalSource);
    // Only leaving a resting phase derives a lane from the role: roles don't own lanes,
    // and the Done close-out running in the triage seat must not drag the card back.
    // Both the current phase and the role's lane come from the installed board; an
    // unknown board or phase yields no destination rather than a guessed one.
    const boardId = boardForWorkItem(input.item);
    const board = (await toBoardSource(boards).load(input.record)).get(boardId);
    const currentStage = input.item.stages.length === 1 ? input.item.stages[0] : undefined;
    const currentKind = currentStage === undefined ? undefined : board?.phaseKind(currentStage);
    const destinationStage =
      currentKind === undefined
        ? undefined
        : currentKind === 'resting'
          ? restingExitLane(board, input.role, hasPullRequest({ ...input.item, source }))
          : currentStage;
    if (!destinationStage) {
      throw new FactoryDispatchError(
        'unsupported_provider_item',
        `Factory skill invocation has no destination lane (role "${input.role}", stages [${input.item.stages.join(', ')}]).`,
      );
    }
    // A PR review on an issue card checks the pull request out on its own branch, apart from
    // the builder's issue branch; every other seat works on the card's own branch.
    const branch = reviewBranch(input, board, destinationStage, source);
    const connections = await sourceControl.connections.list({
      orgId: input.record.orgId,
      factoryProjectId: input.record.factoryProjectId,
    });
    if (!connections.some(connection => connection.integrationId === sourceControl.integrationId)) {
      throw new FactoryDispatchError('source_control_missing', 'Factory source-control connection not found.');
    }
    const project = await projects.getById({ id: input.record.factoryProjectId });
    if (!project || project.orgId !== input.record.orgId) {
      throw new FactoryDispatchError(
        'session_unavailable',
        `Factory model policy is unavailable for project ${input.record.factoryProjectId}.`,
      );
    }
    // A retry may already own a role session. Check it before treating a
    // repository-less card as ambiguous, but never override an explicit signal.
    const reusable = await reuseBoundSession(sourceControl, input);
    // The review seat moves between branches on one card (self-review on the builder's branch,
    // PR review on each pull request's), so its session is reused only on the branch it holds.
    const boundSession =
      reusable && input.role === REVIEW_CONTEXT && !sameBranch(reusable.branch, branch) ? undefined : reusable;
    const intakeConfig = await intake?.getConfig({ orgId: input.record.orgId, integrationIds: ['linear'] });
    let repository = await resolveWorkItemRepository({
      sourceControl,
      orgId: input.record.orgId,
      factoryProjectId: input.record.factoryProjectId,
      item: input.item,
      linearRepositoryMap: intakeConfig?.linear?.repositoryByLinearProject,
    });
    if (repository.status === 'ambiguous' && boundSession) {
      const link = await sourceControl.projectRepositories.get({
        orgId: input.record.orgId,
        id: boundSession.projectRepositoryId,
      });
      const linked =
        link && (await sourceControl.repositories.get({ orgId: input.record.orgId, id: link.repositoryId }));
      if (linked && repository.candidates.includes(linked.slug)) {
        repository = { status: 'resolved', slug: linked.slug, projectRepositoryId: link.id };
      }
    }
    if (repository.status !== 'resolved') {
      const detail =
        repository.status === 'ambiguous'
          ? `Choose one of the linked repositories: ${repository.candidates.join(', ')}.`
          : repository.hint;
      throw new FactoryDispatchError('source_repository_ambiguous', detail);
    }
    // Re-preparing a binding (server restart, retired controller session) must
    // land in the role's existing session: minting a replacement would repoint
    // the work item, flip the session's owner to the approver, and orphan the
    // previous sandbox.
    const approver = input.record.approvedBy ?? undefined;
    if (boundSession && boundSession.projectRepositoryId !== repository.projectRepositoryId) {
      throw new FactoryDispatchError(
        'source_repository_ambiguous',
        `The existing session is bound to a different repository than ${repository.slug}. Choose the correct repository and retry.`,
      );
    }
    // The session is filed under the card's repository: the sandbox holds
    // every environment repository, but the coordinator, the PR tools and the
    // subscriptions follow the session's link, and the card names which one.
    const existingSession =
      boundSession ?? (await legacyPlanSession(sourceControl, input, boardId, branch, repository.projectRepositoryId));
    const ownerUserId =
      existingSession?.userId ??
      (await phaseSessionOwner({ sourceControl, workItems: owner?.workItems, project, approver }));
    if (isFactoryPrincipalId(ownerUserId)) await requireOrganizationModelKey(owner, project);
    const preparedSession =
      existingSession ??
      (await ensureFactorySourceSession({
        sourceControl,
        orgId: input.record.orgId,
        factoryProjectId: input.record.factoryProjectId,
        projectRepositoryId: repository.projectRepositoryId,
        branch,
        attributeToUserId: ownerUserId,
      }).catch(error => {
        if (error instanceof FactorySourceSessionResolutionError && error.reason === 'repository') {
          // The card resolved to a linked repository the sandbox will not check out.
          throw new FactoryDispatchError(
            'source_repository_missing',
            `Repository ${repository.slug} is linked but not pre-cloned for this Factory. Turn on Pre-clone under Settings → Repositories, then retry.`,
            { cause: error },
          );
        }
        if (error instanceof SessionBranchHeldError) {
          throw new FactoryDispatchError(
            'session_unavailable',
            `${error.message} The run cannot start until branch ${branch} is free for this repository.`,
            { cause: error },
          );
        }
        if (!(error instanceof SessionOwnershipMismatchError)) throw error;
        throw new FactoryDispatchError(
          'session_unavailable',
          `Session ${error.sessionId} on branch ${branch} predates factory ownership and cannot be reused. Delete that session, then retry.`,
          { cause: error },
        );
      }));

    const modelScope = effectiveModelScope(project.modelScope, 'run');
    await coordinator.prepare({
      orgId: input.record.orgId,
      userId: preparedSession.userId,
      ...(approver ? { startedBy: await starterOf(owner?.workItems, project, approver) } : {}),
      factoryProjectId: input.record.factoryProjectId,
      sessionId: preparedSession.sessionId,
      modelScope,
      defaultModelId: modelScope === 'factory' ? (project.defaultModelId ?? undefined) : undefined,
      threadTitle: workItemThreadTitle({ source, title: input.item.title, metadata: input.item.workItem.metadata }),
      kickoffKey: input.record.id,
      destinationStage,
      workItem: {
        id: input.item.id,
        role: input.role,
        input: {
          externalSource: input.item.externalSource,
          parentWorkItemId: input.item.parentWorkItemId,
          title: input.item.title,
          stages: [...input.item.stages],
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
    | 'integrations'
  > & {
    stateSigner: StateSigner;
    emitAudit?: AuditEmitter['emit'];
    onRepositoryPush?: IntegrationHooks['onRepositoryPush'];
    configVersion: string;
    boardRegistry: BoardRegistry | ProjectBoardSource;
    /** Passed for the workers' context only: routes do not sweep. */
    keptCards?: CardSource;
    factoryReady: boolean;
    domains: Pick<
      FactoryApiRoutesDeps['domains'],
      | 'projects'
      | 'intake'
      | 'workItems'
      | 'channelIdentity'
      | 'memorySettings'
      | 'modelDefaults'
      | 'modelCredentials'
      | 'voiceSettings'
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
      sourceControls: (deps.integrations ?? [])
        .filter(({ integration }) => integration.versionControl)
        .map(({ integration }) => deps.sourceControlStorage.forIntegration(integration.id)),
      projects: deps.domains.projects,
      intake: deps.domains.intake,
      channelIdentity: deps.domains.channelIdentity,
      memorySettings: deps.domains.memorySettings,
      modelDefaults: deps.domains.modelDefaults,
      modelCredentials: deps.domains.modelCredentials,
      voiceSettings: deps.domains.voiceSettings,
    },
    ...(deps.factoryReady ? { workItems: deps.domains.workItems } : {}),
    ...(deps.factoryReady
      ? {
          runtime: {
            configVersion: deps.configVersion,
            workItems: deps.domains.workItems,
            boards: deps.boardRegistry,
            ...(deps.keptCards ? { keptCards: deps.keptCards } : {}),
          },
        }
      : {}),
    ...(deps.emitAudit || deps.onRepositoryPush
      ? {
          hooks: {
            ...(deps.emitAudit ? { emitAudit: deps.emitAudit } : {}),
            ...(deps.onRepositoryPush ? { onRepositoryPush: deps.onRepositoryPush } : {}),
          },
        }
      : {}),
  };
}

/**
 * Disabled-status stub for the well-known integration ids. The SPA polls
 * `/web/github/status`, `/web/linear/status`, and `/web/jira/status`
 * unconditionally, so when an integration is absent (or not ready) the status
 * contract must still hold. Unknown custom ids get no stub — the SPA doesn't
 * poll them.
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
  if (id === 'jira') {
    return [
      registerApiRoute('/web/jira/status', {
        method: 'GET',
        requiresAuth: false,
        handler: c =>
          c.json({
            enabled: false,
            configured,
            site: null,
            reason: 'missing_config',
            diagnostics: {
              jiraConfigured: configured,
              factoryAuthEnabled: deps.auth.enabled(),
              appDbConfigured: deps.factoryStorage !== undefined,
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

export interface FactoryStatusProblem {
  code: 'secret_key_mismatch';
  title: string;
  message: string;
  /** The one step that fixes it. Env var names are wrapped in backticks. */
  fix: string;
  /** Where an operator reads more, such as how to rotate keys. */
  docsUrl: string;
}

/** Domains that hold encrypted secrets; Factory can't run if they can't be read. */
const SECRET_DOMAINS = ['integrations', 'model-credentials', 'custom-providers'];

/**
 * `GET /web/status`: problems that stop the whole Factory from working, so the
 * UI shows one alert banner instead of every page failing on its own. Only a
 * key problem counts, since only a redeploy with the right key clears it. Read
 * from the latest storage init result, so a key failure found by a later init
 * retry shows up too. Only client-safe copy goes out.
 */
function factoryStatusRoutes(storage: FactoryStorage | undefined): ApiRoute[] {
  return [
    registerApiRoute('/web/status', {
      method: 'GET',
      requiresAuth: false,
      handler: c => {
        const problem = SECRET_DOMAINS.map(domain => secretKeyProblem(storage?.domainInitError(domain))).find(Boolean);
        const problems: FactoryStatusProblem[] = problem
          ? [
              {
                code: 'secret_key_mismatch',
                ...problem,
                docsUrl: 'https://factory.mastra.ai/troubleshooting#stored-credentials-stop-working',
              },
            ]
          : [];
        return c.json({ problems });
      },
    }),
  ];
}

/**
 * Assemble the custom `/web/*` API routes as Mastra `server.apiRoutes`:
 *   - fs browser routes (project picker), confined to `fsRoot`
 *   - config routes (provider/API-key/default-model/OM management)
 *   - every registered integration's `routes()` surface (full set when ready,
 *     disabled-status stub otherwise), plus stubs for absent known ids
 */
export function assembleFactoryApiRoutes(deps: FactoryApiRoutesDeps): ApiRoute[] {
  const emitAudit: AuditEmitter['emit'] = args => deps.audit.emit(args);
  const registrations = deps.integrations ?? [];
  const githubRegistration = registrations.find(({ integration }) => integration.id === 'github');
  const githubStorage = githubRegistration ? deps.sourceControlStorage.forIntegration('github') : undefined;
  const githubIntegration = githubRegistration?.integration as GithubIntegration | undefined;
  const sourceControlRegistrations = registrations.filter(({ integration }) => integration.versionControl);
  const sourceControlIntegrationIds = [
    ...new Set(['github', ...sourceControlRegistrations.map(({ integration }) => integration.id)]),
  ];
  const sourceControls = sourceControlIntegrationIds.map(id => deps.sourceControlStorage.forIntegration(id));
  const sourceControlSessions = createSourceControlSessionLookup(sourceControls);

  const integrationRoutes = registrations.flatMap(registration => {
    const { integration } = registration;
    if (!deps.stateSigner) return disabledIntegrationStatusRoutes(deps, integration.id, true);
    const context = buildIntegrationContext(
      {
        ...deps,
        // Integrations evaluate code behaviors and place new cards with the code boards.
        boardRegistry: toBoardSource(deps.boardRegistry).codeRegistry,
        stateSigner: deps.stateSigner,
        emitAudit,
        ...(githubRegistration ? { sourceControlOwnerId: 'github' } : {}),
      },
      integration.id,
    );
    return guardIntegrationRoutes({ ...registration, routes: integration.routes(context) });
  });
  // Session persistence belongs to the linked source-control provider, not to
  // GitHub. Replace legacy GitHub-owned handlers with one resolver spanning
  // the legacy GitHub partition and every registered source-control partition.
  const sharedSessionRouteKeys = new Set([
    'GET /web/github/projects/:id/sessions',
    'POST /web/github/projects/:id/sessions',
    'GET /web/user-sessions/:sessionId',
    'DELETE /web/user-sessions/:sessionId',
    'POST /web/user-sessions/:sessionId/owner',
    'POST /web/user-sessions/:sessionId/title',
  ]);
  const providerRoutes = integrationRoutes.filter(
    route => !sharedSessionRouteKeys.has(route.method + ' ' + route.path),
  );
  const sourceControlSessionRoutes =
    sourceControls.length === 0
      ? []
      : buildSourceControlSessionRoutes({
          auth: deps.auth,
          sourceControls,
          projects: deps.domains.projects,
          ...(deps.users ? { users: deps.users } : {}),
          controller: deps.controller,
          audit: deps.audit,
          memorySettings: deps.domains.memorySettings,
          sessionRetirement: deps.sessionRetirement,
          // A local sandbox's destroy keeps the session directory, so recreate
          // couldn't deliver the fresh checkout it promises there.
          sandboxRecreateSupported: deps.sandbox !== undefined && deps.sandbox.provider !== 'local',
          filesystem: deps.domains.filesystem,
          ...(deps.factoryReady ? { workItems: deps.domains.workItems } : {}),
          ...(deps.moveThread ? { moveThread: deps.moveThread } : {}),
          ...(githubStorage ? { githubRepositories: githubStorage.repositories } : {}),
        });
  // Absent known integrations still get their disabled-status stub.
  const absentStubs = ['github', 'linear', 'jira']
    .filter(id => !registrations.some(({ integration }) => integration.id === id))
    .flatMap(id => disabledIntegrationStatusRoutes(deps, id));
  // Absent slack gets the channel-accounts not-registered stub (registered
  // slack owns the path via its own connect routes).
  const slackAbsentStubs = registrations.some(({ integration }) => integration.id === 'slack')
    ? []
    : absentSlackChannelAccountsRoutes();

  const transitionService = deps.factoryReady
    ? (deps.factoryTransitionService ??
      new FactoryTransitionService({
        configVersion: deps.configVersion,
        boards: deps.boardRegistry,
        storage: deps.domains.workItems,
        audit: deps.audit,
      }))
    : undefined;
  const startCoordinator = transitionService
    ? new FactoryStartCoordinator(
        deps.controller,
        deps.domains.workItems,
        transitionService,
        request =>
          resolveFactorySourceControl({
            sourceControls,
            orgId: request.orgId,
            factoryProjectId: request.factoryProjectId,
            sessionId: request.sessionId,
          }),
        deps.domains.intake,
        { projects: deps.domains.projects, modelDefaults: deps.domains.modelDefaults },
        deps.boardRegistry,
      )
    : undefined;
  if (transitionService && startCoordinator) {
    deps.onFactoryRuntime?.({
      transitionService,
      startCoordinator,
      ...(sourceControlRegistrations.length > 0
        ? {
            prepareBinding: async (input: FactoryBindingPreparationInput) => {
              const sourceControl = await resolveFactorySourceControl({
                sourceControls,
                orgId: input.record.orgId,
                factoryProjectId: input.record.factoryProjectId,
              });
              if (!sourceControl) {
                throw new FactoryDispatchError(
                  'source_control_missing',
                  'Factory project has no linked source-control repository.',
                );
              }
              return prepareFactoryRuleBinding(
                sourceControl,
                startCoordinator,
                deps.domains.projects,
                deps.boardRegistry,
                input,
                deps.domains.intake,
                {
                  workItems: deps.domains.workItems,
                  modelCredentials: deps.domains.modelCredentials,
                  customProviders: deps.domains.customProviders,
                  deploymentModelProviders: deps.deploymentModelProviders,
                },
              );
            },
          }
        : {}),
    });
  }

  return [
    ...factoryStatusRoutes(deps.factoryStorage),
    ...buildFsRoutes({
      root: deps.fsRoot,
      sessionFs: {
        auth: deps.auth,
        sessions: sourceControlSessions,
        controller: deps.controller,
        ...(deps.factoryReady ? { workItems: deps.domains.workItems } : {}),
      },
    }),
    ...new ConfigRoutes({
      auth: deps.auth,
      controller: deps.controller,
      authStorage: deps.authStorage,
      modelCredentials: deps.domains.modelCredentials,
      modelDefaults: deps.domains.modelDefaults,
      sourceControlSessions,
      sourceControls,
      workItems: deps.domains.workItems,
      memorySettings: deps.domains.memorySettings,
      factoryProjects: deps.domains.projects,
      customProviders: deps.domains.customProviders,
      features: { knowledge: deps.knowledgeEnabled, mcp: deps.mcpEnabled },
      deploymentProviders: deps.deploymentModelProviders,
      onCredentialsChanged: invalidateTenantCredentialSnapshots,
      onCustomProvidersChanged: invalidateCustomProvidersSnapshots,
    }).routes(),
    ...new OAuthRoutes({
      auth: deps.auth,
      authStorage: deps.authStorage,
      modelCredentials: deps.domains.modelCredentials,
      onCredentialsChanged: invalidateTenantCredentialSnapshots,
    }).routes(),
    ...new VoiceRoutes({
      auth: deps.auth,
      authStorage: deps.authStorage,
      modelCredentials: deps.domains.modelCredentials,
      voiceSettings: deps.domains.voiceSettings,
      factoryProjects: deps.domains.projects,
    }).routes(),
    ...new SkillRoutes({
      auth: deps.auth,
      controllerId: deps.controllerId,
      controller: deps.controller,
      sourceControlStorage: githubStorage,
      ensureSourceControlReady: githubRegistration?.ensureReady,
      ...(deps.skills ? { skills: deps.skills } : {}),
      overrides: { projects: deps.domains.projects, storage: deps.domains.skillOverrides, audit: deps.audit },
    }).routes(),
    ...sourceControlSessionRoutes,
    ...(sourceControls.length === 0
      ? []
      : buildSourceControlSettingsRoutes({
          auth: deps.auth,
          sourceControls,
          ...(deps.onEnvironmentSaved ? { onEnvironmentSaved: deps.onEnvironmentSaved } : {}),
        })),
    ...providerRoutes,
    ...absentStubs,
    ...slackAbsentStubs,
    ...(deps.intakeReady
      ? new IntakeRoutes({
          auth: deps.auth,
          audit: deps.audit,
          intake: deps.domains.intake,
          projects: deps.domains.projects,
          integrations: (deps.integrations ?? []).flatMap(({ integration }) => [
            ...(integration.intake ? [{ id: integration.id, intake: integration.intake }] : []),
            ...(integration.additionalIntakes ?? []),
          ]),
        }).routes()
      : []),
    ...(deps.factoryReady && deps.knowledgeEnabled
      ? new KnowledgeRoutes({
          auth: deps.auth,
          projects: deps.domains.projects,
          knowledge: async key => deps.controller.getMastra()?.getKnowledge(key),
          defaultKnowledgeKey: deps.knowledgeKey,
        }).routes()
      : []),
    ...(deps.factoryReady
      ? new WorkItemRoutes({
          auth: deps.auth,
          audit: deps.audit,
          projects: deps.domains.projects,
          workItems: deps.domains.workItems,
          boardRegistry: deps.boardRegistry,
          intakeRoutes: deps.storedBoards?.storage,
          queueHealth: deps.domains.queueHealth,
          transitionService,
          startCoordinator,
          liveSessions: deps.liveSessions,
          runSlots: deps.runSlots,
        }).routes()
      : []),
    ...(deps.factoryReady && deps.storedBoards
      ? new BoardRoutes({
          auth: deps.auth,
          audit: deps.audit,
          projects: deps.domains.projects,
          workItems: deps.domains.workItems,
          storage: deps.storedBoards.storage,
          boards: deps.storedBoards.cache,
        }).routes()
      : []),
    ...(deps.factoryReady && deps.storedBoards
      ? new IntakeRouteRoutes({
          auth: deps.auth,
          audit: deps.audit,
          projects: deps.domains.projects,
          workItems: deps.domains.workItems,
          storage: deps.storedBoards.storage,
          boards: deps.storedBoards.cache,
        }).routes()
      : []),
    ...(deps.factoryReady
      ? buildAutomationRunRoutes({
          auth: deps.auth,
          audit: deps.audit,
          projects: deps.domains.projects,
          workItems: deps.domains.workItems,
          configVersion: deps.configVersion,
          boards: deps.boardRegistry,
        })
      : []),
  ];
}
