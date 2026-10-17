import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';

import { boardForWorkItem } from '../boards/index.js';
import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import { hydrateFactorySession, resolveFactorySessionModel } from '../session/factory-session.js';
import { resolveWorkItemRepository } from '../session/work-item-repository.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type { EffectiveModelScope, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlSession, SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { CreateWorkItemInput, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactoryTransitionService } from './transition-service.js';
import { externallyAuthoredWorkItem } from './types.js';
import type { FactoryRuleStage, FactoryTransitionResult } from './types.js';

export interface FactoryStartRequest {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  sessionId: string;
  threadTitle: string;
  kickoffKey: string;
  /** Where the arrival path lands the card; a session opened on an existing card names none. */
  destinationStage?: FactoryRuleStage;
  /** The run's effective scope; a hybrid Factory's runs use the Factory's model and credentials. */
  modelScope: EffectiveModelScope;
  defaultModelId?: string;
  workItem: {
    id?: string;
    role: string;
    input: CreateWorkItemInput;
  };
  requestContext?: RequestContext;
}

export class UntrustedSharedSessionError extends Error {
  constructor(readonly sessionId: string) {
    super(
      `Session ${sessionId} already shares memory with this Factory, so it cannot run untrusted content. Start the run in a new session.`,
    );
    this.name = 'UntrustedSharedSessionError';
  }
}

/**
 * The memory resource a run works on. Trusted runs share the Factory's resource.
 * A run that reads attacker-controllable content (a pull request checkout, or a
 * card written outside the write-access circle) keeps its own resource, so it can
 * neither plant observations that trusted runs read nor read what they observed.
 * A session that was isolated stays isolated; one already sharing memory refuses
 * untrusted work instead of carrying that memory into it.
 */
async function runMemoryResource(
  controller: Pick<FactoryController, 'queryThreadById'>,
  input: { sessionId: string; factoryProjectId: string; untrusted: boolean },
): Promise<string> {
  const existing = await controller.queryThreadById({ threadId: input.sessionId });
  if (existing?.resourceId === input.sessionId) return input.sessionId;
  if (!input.untrusted) return existing?.resourceId ?? input.factoryProjectId;
  if (existing) throw new UntrustedSharedSessionError(input.sessionId);
  return input.sessionId;
}

export class WorkItemRepositoryError extends Error {
  constructor(
    readonly code: 'repository_mismatch' | 'repository_ambiguous' | 'repository_unlinked',
    message: string,
    readonly candidates: string[] = [],
  ) {
    super(message);
    this.name = 'WorkItemRepositoryError';
  }
}

export class FactoryStartTransitionError extends Error {
  readonly result: Extract<FactoryTransitionResult, { status: 'rejected' }>;

  constructor(result: Extract<FactoryTransitionResult, { status: 'rejected' }>) {
    super(result.reason);
    this.name = 'FactoryStartTransitionError';
    this.result = result;
  }
}

export interface FactoryStartPreparedResult {
  workItemId: string;
  bindingId: string;
  threadId: string;
  resourceId: string;
  sessionId: string;
  branch: string;
  revision: number;
  kickoffStatus: 'pending' | 'leased' | 'retry' | 'sent' | 'failed';
  replayed: boolean;
}

type FactoryController = AgentController<MastraCodeState>;
type FactorySession = Awaited<ReturnType<FactoryController['createSession']>>;

async function resolveSourceSession(
  storage: SourceControlStorageHandle,
  request: FactoryStartRequest,
): Promise<SourceControlSession & { projectRepositoryId: string }> {
  const session = await storage.sessions.getBySessionId(request.sessionId);
  if (!session || session.orgId !== request.orgId || session.userId !== request.userId) {
    throw new Error('Factory session not found');
  }
  const projectRepositoryId = session.projectRepositoryId;
  if (!projectRepositoryId) throw new Error('Factory session repository not found');
  const projectRepository = await storage.projectRepositories.get({ orgId: request.orgId, id: projectRepositoryId });
  if (!projectRepository) throw new Error('Factory session repository not found');
  const connection = await storage.connections.get({ orgId: request.orgId, id: projectRepository.connectionId });
  if (!connection || connection.factoryProjectId !== request.factoryProjectId) {
    throw new Error('Factory session does not belong to this project');
  }
  return { ...session, projectRepositoryId };
}

async function configureThread(session: FactorySession, request: FactoryStartRequest): Promise<string> {
  const threadId = session.thread.requireId();
  // Derived from the work item, not a user rename, so leave the title
  // unpinned and let auto-naming keep refining it.
  await session.thread.rename({ title: request.threadTitle, pin: false });
  await session.thread.setSetting({ key: 'factorySessionId', value: request.sessionId });
  return threadId;
}

export class FactoryStartCoordinator {
  readonly #controller: FactoryController;
  readonly #storage: WorkItemsStorage;
  readonly #transitionService?: Pick<FactoryTransitionService, 'transition'>;
  readonly #sourceControl?:
    | SourceControlStorageHandle
    | ((
        request: FactoryStartRequest,
      ) => SourceControlStorageHandle | undefined | Promise<SourceControlStorageHandle | undefined>);
  readonly #intake?: IntakeStorage;
  readonly #projects?: FactoryProjectsStorage;
  readonly #modelDefaults?: ModelDefaultsStorage;

  constructor(
    controller: FactoryController,
    storage: WorkItemsStorage,
    transitionService?: Pick<FactoryTransitionService, 'transition'>,
    sourceControl?:
      | SourceControlStorageHandle
      | ((
          request: FactoryStartRequest,
        ) => SourceControlStorageHandle | undefined | Promise<SourceControlStorageHandle | undefined>),
    intake?: IntakeStorage,
    sessionModel?: { projects: FactoryProjectsStorage; modelDefaults: ModelDefaultsStorage },
  ) {
    this.#controller = controller;
    this.#storage = storage;
    this.#transitionService = transitionService;
    this.#sourceControl = sourceControl;
    this.#intake = intake;
    this.#projects = sessionModel?.projects;
    this.#modelDefaults = sessionModel?.modelDefaults;
  }

  async prepare(request: FactoryStartRequest): Promise<FactoryStartPreparedResult> {
    const storage = this.#storage;
    const sourceControl =
      typeof this.#sourceControl === 'function' ? await this.#sourceControl(request) : this.#sourceControl;
    if (!sourceControl) throw new Error('Factory source control storage is unavailable');
    const sourceSession = await resolveSourceSession(sourceControl, request);
    const sessionModel =
      this.#projects && this.#modelDefaults
        ? await resolveFactorySessionModel({
            projects: this.#projects,
            modelDefaults: this.#modelDefaults,
            factoryProjectId: request.factoryProjectId,
            orgId: request.orgId,
            ownerUserId: sourceSession.userId,
            context: 'run',
          })
        : { modelScope: request.modelScope, modelId: request.defaultModelId };
    const storedItem = request.workItem.id
      ? await storage.get({ orgId: request.orgId, id: request.workItem.id })
      : null;
    const intakeConfig = await this.#intake?.getConfig({ orgId: request.orgId, integrationIds: ['linear'] });
    let repository = await resolveWorkItemRepository({
      sourceControl,
      orgId: request.orgId,
      factoryProjectId: request.factoryProjectId,
      item: storedItem ?? { metadata: request.workItem.input.metadata ?? null },
      linearRepositoryMap: intakeConfig?.linear?.repositoryByLinearProject,
    });
    if (repository.status === 'ambiguous') {
      // A retry of this role's existing session keeps its already-chosen
      // repository; a newly minted session must not choose for the card.
      if (storedItem?.sessions[request.workItem.role]?.sessionId !== sourceSession.sessionId) {
        throw new WorkItemRepositoryError(
          'repository_ambiguous',
          `Choose a repository for this work item: ${repository.candidates.join(', ')}.`,
          repository.candidates,
        );
      }
      const link = await sourceControl.projectRepositories.get({
        orgId: request.orgId,
        id: sourceSession.projectRepositoryId,
      });
      const linked = link && (await sourceControl.repositories.get({ orgId: request.orgId, id: link.repositoryId }));
      const currentLinks = link
        ? await sourceControl.projectRepositories.list({ orgId: request.orgId, connectionId: link.connectionId })
        : [];
      if (
        !linked ||
        !repository.candidates.includes(linked.slug) ||
        !currentLinks.some(candidate => candidate.id === sourceSession.projectRepositoryId)
      ) {
        throw new WorkItemRepositoryError(
          'repository_unlinked',
          'The existing session repository is not linked to this Factory.',
        );
      }
      repository = { status: 'resolved', slug: linked.slug, projectRepositoryId: sourceSession.projectRepositoryId };
    }
    if (repository.status === 'unlinked') {
      throw new WorkItemRepositoryError('repository_unlinked', repository.hint);
    }
    if (repository.projectRepositoryId !== sourceSession.projectRepositoryId) {
      throw new WorkItemRepositoryError(
        'repository_mismatch',
        `This run session is bound to a different repository than ${repository.slug}.`,
      );
    }
    const requestContext = request.requestContext ?? new RequestContext();
    // Preserve an authenticated caller when present. Autonomous starts still
    // need a principal so deployed credential resolution can authenticate the
    // request before selecting the stamped session owner's exclusive scope.
    const existingUser = requestContext.get('user');
    if (!existingUser || typeof existingUser !== 'object') {
      requestContext.set('user', {
        workosId: request.userId,
        organizationId: request.orgId,
      });
    }
    // Sessions kicked off against third-party content (a PR under review, or
    // any pull-request-sourced work item) get `untrustedCheckout` so the SDK
    // never ingests the checkout's AGENTS.md/CLAUDE.md into the system prompt
    // or reminders — those files are attacker-writable in a PR branch.
    const untrustedCheckout = request.workItem.input.externalSource?.type === 'pull-request';
    // The trusted ref the SDK may serve project instruction files from on an
    // untrusted checkout (the PR's base branch). Prefer the session record's
    // base branch; fall back to the intake metadata captured from the PR.
    const metadataBaseBranch = request.workItem.input.metadata?.baseBranch;
    const baseRef =
      (sourceSession.baseBranch || undefined) ??
      (typeof metadataBaseBranch === 'string' && metadataBaseBranch ? metadataBaseBranch : undefined);
    const memoryResourceId = await runMemoryResource(this.#controller, {
      sessionId: sourceSession.sessionId,
      factoryProjectId: request.factoryProjectId,
      untrusted:
        untrustedCheckout ||
        externallyAuthoredWorkItem(
          storedItem ?? {
            externalSource: request.workItem.input.externalSource ?? null,
            metadata: request.workItem.input.metadata ?? null,
          },
        ),
    });
    const sessionTags = {
      factoryProjectId: request.factoryProjectId,
      projectRepositoryId: sourceSession.projectRepositoryId,
    };
    // The run is addressed by its session id; its threads and memory belong to
    // the Factory, so concurrent runs share resource-scoped memory.
    const session = await this.#controller.createSession({
      id: sourceSession.sessionId,
      ownerId: request.userId,
      resourceId: memoryResourceId,
      threadId: sourceSession.sessionId,
      requestContext,
      tags: sessionTags,
    });
    // Bound-agent authority gates (the transition tool, the factory-phase
    // processor, workspace token selection) resolve the session address from
    // controller state. Seed it server-side — `tags` covers fresh creation,
    // the explicit setState covers get-or-create returning a session another
    // caller created without them — so autonomous runs never depend on a
    // browser connecting to populate the state. `untrustedCheckout` is a
    // boolean so it rides only on state (tags are string-valued).
    const targetRepositoryInstruction = `Target repository: ${repository.slug}. Before editing files or creating a pull request, verify this session's checkout matches the target repository.`;
    const existingPluginInstructions = session.state.get()?.pluginInstructions ?? [];
    await session.state.set({
      ...sessionTags,
      // The authoritative org id for every downstream identity read (the
      // memory seam's organizationId): the session owner is a USER id, not an
      // org, so it must never be improvised from ownerId.
      factoryOrgId: request.orgId,
      factoryModelScope: sessionModel.modelScope,
      factoryOwnerUserId: sourceSession.userId,
      pluginInstructions: [
        ...existingPluginInstructions.filter(instruction => instruction !== targetRepositoryInstruction),
        targetRepositoryInstruction,
      ],
      ...(untrustedCheckout ? { untrustedCheckout: true, ...(baseRef ? { baseRef } : {}) } : {}),
    });
    await primeTenantCredentialsForTenant({
      orgId: request.orgId,
      userId: sourceSession.userId,
      credentialScope: sessionModel.modelScope,
    });
    // Apply the factory's main model before any model-dependent run work.
    // Observational-memory settings are loaded per invocation by the input processor.
    await hydrateFactorySession(session, {
      orgId: request.orgId,
      modelScope: sessionModel.modelScope,
      ownerUserId: sourceSession.userId,
      defaultModelId: sessionModel.modelId,
    });
    // The tool is `requireApproval`, and that prompt parks the run whether or not
    // someone pressed Start — a person is reading the plan, not an approval queue.
    // Starting the run was already the say-so; the rules engine still governs.
    await session.permissions.setForTool({ toolName: 'factory_transition_work_item', policy: 'allow' });
    const threadId = await configureThread(session, request);
    const prepared = await storage.prepareRunStart({
      orgId: request.orgId,
      userId: request.userId,
      factoryProjectId: request.factoryProjectId,
      workItem: { id: request.workItem.id, input: request.workItem.input },
      role: request.workItem.role,
      session: { sessionId: sourceSession.sessionId, branch: sourceSession.branch, threadId },
      resourceId: memoryResourceId,
      kickoffKey: request.kickoffKey,
      kickoffMessage: null,
    });
    await session.thread.setSetting({ key: 'factoryWorkItemId', value: prepared.item.id });

    let revision = prepared.item.revision;
    const destinationStage = request.destinationStage;
    if (destinationStage && (prepared.item.stages.length !== 1 || prepared.item.stages[0] !== destinationStage)) {
      if (!this.#transitionService) throw new Error('Factory transition service is unavailable.');
      const transition = await this.#transitionService.transition({
        orgId: request.orgId,
        factoryProjectId: request.factoryProjectId,
        workItemId: prepared.item.id,
        board: boardForWorkItem(prepared.item),
        stage: destinationStage,
        expectedRevision: prepared.item.revision,
        actor: { type: 'human', id: request.userId },
        ingress: { type: 'human', identity: `start:${request.kickoffKey}:transition` },
        cause: 'run_start',
      });
      if (transition.status === 'rejected') {
        await storage.markPendingStart(prepared.binding.id, 'failed', transition.reason);
        throw new FactoryStartTransitionError(transition);
      }
      revision = transition.revision;
    }

    await storage.markPendingStart(prepared.binding.id, 'sent');
    prepared.pendingStart.status = 'sent';

    return {
      workItemId: prepared.item.id,
      bindingId: prepared.binding.id,
      threadId,
      resourceId: memoryResourceId,
      sessionId: sourceSession.sessionId,
      branch: sourceSession.branch,
      revision,
      kickoffStatus: prepared.pendingStart.status,
      replayed: prepared.replayed,
    };
  }
}
