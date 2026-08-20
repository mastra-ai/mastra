import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import type { Skill } from '@mastra/core/skills';

import { hydrateFactorySession } from '../session/factory-session.js';
import type { FactorySkillCatalog } from '../skills/catalog.js';
import { formatSkillInvocationMessage } from '../skills/service.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { SourceControlSession, SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { CreateWorkItemInput, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactoryTransitionService } from './transition-service.js';
import type { FactoryRuleStage, FactoryTransitionResult } from './types.js';

export interface FactoryStartRequest {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  sessionId: string;
  threadTitle: string;
  threadTags?: Record<string, string>;
  kickoffKey: string;
  invocation?: { type: 'prompt'; prompt: string } | { type: 'skill'; skillName: string; arguments: string };
  destinationStage: FactoryRuleStage;
  defaultModelId?: string;
  workItem: {
    id?: string;
    role: string;
    input: CreateWorkItemInput;
  };
  requestContext?: RequestContext;
  /** Arm the item's autonomy in the same transaction that prepares the run. */
  armAutonomy?: boolean;
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

async function resolveKickoffMessage(
  session: FactorySession,
  factorySkills: FactorySkillCatalog,
  invocation: FactoryStartRequest['invocation'],
): Promise<string | null> {
  if (!invocation) return null;
  if (invocation.type === 'prompt') return invocation.prompt;

  let skill: Skill | null | undefined = factorySkills.get(invocation.skillName);
  if (!skill) {
    const skills = session.getWorkspace()?.skills;
    await skills?.maybeRefresh();
    skill = await skills?.get(invocation.skillName);
  }
  if (!skill || skill['user-invocable'] === false) {
    throw new Error(`Skill not found: ${invocation.skillName}.`);
  }
  return formatSkillInvocationMessage(skill, invocation.arguments);
}

async function resolveSourceSession(
  storage: SourceControlStorageHandle,
  request: FactoryStartRequest,
): Promise<SourceControlSession> {
  const session = await storage.sessions.getBySessionId(request.sessionId);
  if (!session || session.orgId !== request.orgId || session.userId !== request.userId) {
    throw new Error('Factory session not found');
  }
  const projectRepository = await storage.projectRepositories.get({
    orgId: request.orgId,
    id: session.projectRepositoryId,
  });
  if (!projectRepository) throw new Error('Factory session repository not found');
  const connection = await storage.connections.get({ orgId: request.orgId, id: projectRepository.connectionId });
  if (!connection || connection.factoryProjectId !== request.factoryProjectId) {
    throw new Error('Factory session does not belong to this project');
  }
  return session;
}

async function configureThread(session: FactorySession, request: FactoryStartRequest): Promise<string> {
  const threadId = session.thread.requireId();
  await session.thread.rename({ title: request.threadTitle });
  const settings = { ...(request.threadTags ?? {}), factorySessionId: request.sessionId };
  await Promise.all(Object.entries(settings).map(([key, value]) => session.thread.setSetting({ key, value })));
  return threadId;
}

export class FactoryStartCoordinator {
  readonly #controller: FactoryController;
  readonly #storage: WorkItemsStorage;
  readonly #factorySkills: FactorySkillCatalog;
  readonly #transitionService?: Pick<FactoryTransitionService, 'transition'>;
  readonly #sourceControl?: SourceControlStorageHandle;
  readonly #memorySettings?: MemorySettingsStorage;

  constructor(
    controller: FactoryController,
    storage: WorkItemsStorage,
    factorySkills: FactorySkillCatalog,
    transitionService?: Pick<FactoryTransitionService, 'transition'>,
    sourceControl?: SourceControlStorageHandle,
    memorySettings?: MemorySettingsStorage,
  ) {
    this.#controller = controller;
    this.#storage = storage;
    this.#factorySkills = factorySkills;
    this.#transitionService = transitionService;
    this.#sourceControl = sourceControl;
    this.#memorySettings = memorySettings;
  }

  async prepare(request: FactoryStartRequest): Promise<FactoryStartPreparedResult> {
    const storage = this.#storage;
    if (!this.#sourceControl) throw new Error('Factory source control storage is unavailable');
    const sourceSession = await resolveSourceSession(this.#sourceControl, request);
    const requestContext = request.requestContext ?? new RequestContext();
    if (!requestContext.get('user')) {
      requestContext.set('user', { workosId: request.userId, organizationId: request.orgId });
    }
    // Sessions kicked off against third-party content (a PR under review, or
    // any pull-request-sourced work item) get `untrustedCheckout` so the SDK
    // never ingests the checkout's AGENTS.md/CLAUDE.md into the system prompt
    // or reminders — those files are attacker-writable in a PR branch.
    const untrustedCheckout =
      request.workItem.input.externalSource?.type === 'pull-request' ||
      (request.invocation?.type === 'skill' &&
        (request.invocation.skillName === 'factory-review' || request.invocation.skillName === 'factory-rereview'));
    // The trusted ref the SDK may serve project instruction files from on an
    // untrusted checkout (the PR's base branch). Prefer the session record's
    // base branch; fall back to the intake metadata captured from the PR.
    const metadataBaseBranch = request.workItem.input.metadata?.baseBranch;
    const baseRef =
      (sourceSession.baseBranch || undefined) ??
      (typeof metadataBaseBranch === 'string' && metadataBaseBranch ? metadataBaseBranch : undefined);
    const sessionTags = {
      factoryProjectId: request.factoryProjectId,
      projectRepositoryId: sourceSession.projectRepositoryId,
    };
    const session = await this.#controller.createSession({
      id: sourceSession.sessionId,
      ownerId: request.userId,
      resourceId: sourceSession.sessionId,
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
    await session.state.set({
      ...sessionTags,
      // The authoritative org id for every downstream identity read (the
      // memory seam's organizationId): the session owner is a USER id, not an
      // org, so it must never be improvised from ownerId.
      factoryOrgId: request.orgId,
      ...(untrustedCheckout ? { untrustedCheckout: true, ...(baseRef ? { baseRef } : {}) } : {}),
    });
    await hydrateFactorySession(session, {
      orgId: request.orgId,
      userId: request.userId,
      defaultModelId: request.defaultModelId,
      memorySettings: this.#memorySettings,
    });
    const threadId = await configureThread(session, request);
    const kickoffMessage = await resolveKickoffMessage(session, this.#factorySkills, request.invocation);
    const prepared = await storage.prepareRunStart({
      orgId: request.orgId,
      userId: request.userId,
      factoryProjectId: request.factoryProjectId,
      workItem: { id: request.workItem.id, input: request.workItem.input },
      role: request.workItem.role,
      session: { sessionId: sourceSession.sessionId, branch: sourceSession.branch, threadId },
      resourceId: sourceSession.sessionId,
      kickoffKey: request.kickoffKey,
      kickoffMessage,
      armAutonomy: request.armAutonomy === true,
    });
    await session.thread.setSetting({ key: 'factoryWorkItemId', value: prepared.item.id });

    let revision = prepared.item.revision;
    if (prepared.item.stages.length !== 1 || prepared.item.stages[0] !== request.destinationStage) {
      if (!this.#transitionService) throw new Error('Factory transition service is unavailable.');
      const transition = await this.#transitionService.transition({
        orgId: request.orgId,
        factoryProjectId: request.factoryProjectId,
        workItemId: prepared.item.id,
        board: prepared.item.externalSource?.type === 'pull-request' ? 'review' : 'work',
        stage: request.destinationStage,
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

    if (kickoffMessage === null) {
      await storage.markPendingStart(prepared.binding.id, 'sent');
      prepared.pendingStart.status = 'sent';
    }

    return {
      workItemId: prepared.item.id,
      bindingId: prepared.binding.id,
      threadId,
      resourceId: sourceSession.sessionId,
      sessionId: sourceSession.sessionId,
      branch: sourceSession.branch,
      revision,
      kickoffStatus: prepared.pendingStart.status,
      replayed: prepared.replayed,
    };
  }
}
