import type { AgentController } from '@mastra/core/agent-controller';
import type { MastraCodeState } from '@mastra/code-sdk/schema';

import type { CreateWorkItemInput, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { getFactoryStorage } from '../../runtime-config.js';

const MAX_KICKOFF_ERROR_LENGTH = 512;

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
  workItem: {
    id?: string;
    role: string;
    input: CreateWorkItemInput;
  };
}

export interface FactoryStartPreparedResult {
  workItemId: string;
  bindingId: string;
  threadId: string;
  resourceId: string;
  projectPath: string;
  branch: string;
  revision: number;
  kickoffStatus: 'pending' | 'sent' | 'failed';
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

async function resolveThread(session: ScopedSession, request: FactoryStartRequest): Promise<string> {
  const tags = {
    projectPath: request.projectPath,
    factoryWorkItemRole: request.workItem.role,
    ...(request.threadTags ?? {}),
  };
  const matching = await session.thread.list({ metadata: tags });
  const thread = [...matching].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  if (thread) await session.thread.switch({ threadId: thread.id });
  else await session.thread.create({ title: request.threadTitle });
  await Promise.all(Object.entries(tags).map(([key, value]) => session.thread.setSetting({ key, value })));
  return session.thread.requireId();
}

export class FactoryStartCoordinator {
  readonly #controller: FactoryController;
  readonly #storage?: WorkItemsStorage;

  constructor(controller: FactoryController, storage?: WorkItemsStorage) {
    this.#controller = controller;
    this.#storage = storage;
  }

  async prepare(request: FactoryStartRequest): Promise<FactoryStartPreparedResult> {
    const session = await createScopedSession(this.#controller, request);
    const threadId = await resolveThread(session, request);
    const storage = this.#storage ?? getFactoryStorage().getDomain<WorkItemsStorage>('work-items');
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

    if (request.kickoffMessage === null) {
      await storage.markPendingStart(prepared.binding.id, 'sent');
      prepared.pendingStart.status = 'sent';
    } else if (!prepared.replayed || prepared.pendingStart.status === 'failed') {
      void session.sendMessage({ content: request.kickoffMessage }).then(
        () => storage.markPendingStart(prepared.binding.id, 'sent'),
        (error: unknown) =>
          storage.markPendingStart(
            prepared.binding.id,
            'failed',
            (error instanceof Error ? error.message : String(error)).slice(0, MAX_KICKOFF_ERROR_LENGTH),
          ),
      );
    }

    return {
      workItemId: prepared.item.id,
      bindingId: prepared.binding.id,
      threadId,
      resourceId: request.resourceId,
      projectPath: request.projectPath,
      branch: request.branch,
      revision: prepared.item.revision,
      kickoffStatus: prepared.pendingStart.status,
      replayed: prepared.replayed,
    };
  }
}
