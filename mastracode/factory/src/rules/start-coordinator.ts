import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';

import type { CreateWorkItemInput, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactoryTransitionService } from './transition-service.js';
import type { FactoryRuleStage, FactoryTransitionResult } from './types.js';

export interface FactoryStartRequest {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  resourceId: string;
  projectPath: string;
  branch: string;
  threadTitle: string;
  threadTags?: Record<string, string>;
  kickoffKey: string;
  kickoffMessage: string | null;
  destinationStage: FactoryRuleStage;
  workItem: {
    id?: string;
    role: string;
    input: CreateWorkItemInput;
  };
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
  projectPath: string;
  branch: string;
  revision: number;
  kickoffStatus: 'pending' | 'leased' | 'retry' | 'sent' | 'failed';
  replayed: boolean;
}

type FactoryController = AgentController<MastraCodeState>;
type ScopedSession = Awaited<ReturnType<FactoryController['createSession']>>;

type CreateSessionWithScope = (input: {
  id: string;
  ownerId: string;
  resourceId: string;
  scope: string;
  tags: Record<string, string>;
}) => ReturnType<FactoryController['createSession']>;

function createScopedSession(
  controller: FactoryController,
  request: FactoryStartRequest,
): ReturnType<CreateSessionWithScope> {
  return (controller.createSession as CreateSessionWithScope)({
    id: request.projectPath,
    ownerId: request.userId,
    resourceId: request.resourceId,
    scope: request.projectPath,
    tags: { projectPath: request.projectPath },
  });
}

async function resolveThread(
  session: ScopedSession,
  request: FactoryStartRequest,
  existingThreadId?: string,
): Promise<string> {
  const identityTags = {
    projectPath: request.projectPath,
    ...(request.workItem.id ? { factoryWorkItemId: request.workItem.id } : {}),
  };
  if (existingThreadId) {
    await session.thread.switch({ threadId: existingThreadId });
  } else {
    const matching = await session.thread.list({ metadata: identityTags });
    const thread = [...matching].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (thread) await session.thread.switch({ threadId: thread.id });
    else await session.thread.create({ title: request.threadTitle });
  }
  const settings = { ...(request.threadTags ?? {}), ...identityTags };
  await Promise.all(Object.entries(settings).map(([key, value]) => session.thread.setSetting({ key, value })));
  return session.thread.requireId();
}

export class FactoryStartCoordinator {
  readonly #controller: FactoryController;
  readonly #storage: WorkItemsStorage;
  readonly #transitionService?: Pick<FactoryTransitionService, 'transition'>;

  constructor(
    controller: FactoryController,
    storage: WorkItemsStorage,
    transitionService?: Pick<FactoryTransitionService, 'transition'>,
  ) {
    this.#controller = controller;
    this.#storage = storage;
    this.#transitionService = transitionService;
  }

  async prepare(request: FactoryStartRequest): Promise<FactoryStartPreparedResult> {
    const storage = this.#storage;
    const existingItem = request.workItem.id
      ? await storage.get({ orgId: request.orgId, id: request.workItem.id })
      : null;
    const existingThreadId = existingItem ? Object.values(existingItem.sessions).at(-1)?.threadId : undefined;
    const session = await createScopedSession(this.#controller, request);
    const threadId = await resolveThread(session, request, existingThreadId);
    const prepared = await storage.prepareRunStart({
      orgId: request.orgId,
      userId: request.userId,
      factoryProjectId: request.factoryProjectId,
      workItem: { id: request.workItem.id, input: request.workItem.input },
      role: request.workItem.role,
      session: { projectPath: request.projectPath, branch: request.branch, threadId },
      resourceId: request.resourceId,
      kickoffKey: request.kickoffKey,
      kickoffMessage: request.kickoffMessage,
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

    if (request.kickoffMessage === null) {
      await storage.markPendingStart(prepared.binding.id, 'sent');
      prepared.pendingStart.status = 'sent';
    }

    return {
      workItemId: prepared.item.id,
      bindingId: prepared.binding.id,
      threadId,
      resourceId: request.resourceId,
      projectPath: request.projectPath,
      branch: request.branch,
      revision,
      kickoffStatus: prepared.pendingStart.status,
      replayed: prepared.replayed,
    };
  }
}
