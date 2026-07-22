import { describe, expect, it, vi } from 'vitest';

import { seedFactoryStorageForTests } from '../../storage/test-utils';
import { defaultFactoryRules } from './defaults';
import { FactoryStartCoordinator } from './start-coordinator';
import { FactoryTransitionService } from './transition-service';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function makeController(sendMessage = vi.fn(async () => {})) {
  let threadId: string | undefined;
  const session = {
    thread: {
      list: vi.fn(async () => []),
      switch: vi.fn(async ({ threadId: id }: { threadId: string }) => {
        threadId = id;
      }),
      create: vi.fn(async () => {
        threadId = 'unexpected-thread';
        return { id: threadId };
      }),
      rename: vi.fn(async () => {}),
      setSetting: vi.fn(async () => {}),
      requireId: vi.fn(() => {
        if (!threadId) throw new Error('missing thread');
        return threadId;
      }),
    },
    getWorkspace: vi.fn(() => ({ skills: undefined })),
    sendMessage,
  };
  return {
    controller: {
      createSession: vi.fn(async ({ threadId: exactThreadId }: { threadId: string }) => {
        threadId = exactThreadId;
        return session;
      }),
    },
    session,
    sendMessage,
  };
}

function makeSourceControl() {
  const sessions = new Map([
    [
      'session-1',
      {
        id: 'source-session-1',
        sessionId: 'session-1',
        projectRepositoryId: 'project-repository-1',
        orgId: 'org-1',
        userId: 'user-1',
        branch: 'factory/issue-1',
        baseBranch: 'main',
      },
    ],
    [
      'session-2',
      {
        id: 'source-session-2',
        sessionId: 'session-2',
        projectRepositoryId: 'project-repository-2',
        orgId: 'org-2',
        userId: 'user-1',
        branch: 'factory/issue-2',
        baseBranch: 'main',
      },
    ],
  ]);
  return {
    sessions: { getBySessionId: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null) },
    projectRepositories: {
      get: vi.fn(async ({ id }: { id: string }) => ({ id, connectionId: `connection-${id}` })),
    },
    connections: { get: vi.fn(async () => ({ factoryProjectId: PROJECT_ID })) },
  };
}

function startRequest(
  overrides: Partial<{
    sessionId: string;
    kickoffKey: string;
    role: string;
    kickoffMessage: string | null;
    id: string;
  }> = {},
) {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    sessionId: overrides.sessionId ?? 'session-1',
    threadTitle: 'Investigate issue 1',
    threadTags: { role: overrides.role ?? 'work' },
    kickoffKey: overrides.kickoffKey ?? 'kickoff-1',
    invocation:
      overrides.kickoffMessage === null
        ? undefined
        : { type: 'prompt' as const, prompt: overrides.kickoffMessage ?? 'Start work' },
    destinationStage: 'intake' as const,
    workItem: {
      id: overrides.id,
      role: overrides.role ?? 'work',
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue' as const,
          externalId: '1',
        },
        title: 'Fix issue 1',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    },
  };
}

describe('FactoryStartCoordinator', () => {
  it('commits the item session, exact binding, and durable pending start', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, undefined, makeSourceControl() as never);

    const prepared = await coordinator.prepare(startRequest());

    expect(prepared).toMatchObject({
      threadId: 'session-1',
      resourceId: 'session-1',
      sessionId: 'session-1',
      kickoffStatus: 'pending',
      replayed: false,
    });
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('pending');
    expect(sendMessage).not.toHaveBeenCalled();
    const item = await storage.get({ orgId: 'org-1', id: prepared.workItemId });
    expect(item?.sessions.work).toMatchObject({
      threadId: 'session-1',
      sessionId: 'session-1',
      branch: 'factory/issue-1',
      startedBy: 'user-1',
    });
  });

  it('binds before requesting the governed run-stage transition', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    let bindingsDuringRule = 0;
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: {
            execute: {
              issue: {
                onEnter: async () => {
                  bindingsDuringRule = (await storage.listRunBindings('org-1', PROJECT_ID)).length;
                },
              },
            },
          },
        },
      }),
    });
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, transitionService, makeSourceControl() as never);

    const prepared = await coordinator.prepare({ ...startRequest(), destinationStage: 'execute' });

    expect(prepared.revision).toBe(2);
    expect((await storage.get({ orgId: 'org-1', id: prepared.workItemId }))?.stages).toEqual(['execute']);
    expect(bindingsDuringRule).toBe(1);
    expect(sendMessage).not.toHaveBeenCalled();
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('pending');
  });

  it('binds the controller session to the exact Factory session thread', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, undefined, makeSourceControl() as never);

    const prepared = await coordinator.prepare(startRequest({ kickoffMessage: null }));

    expect(prepared).toMatchObject({ threadId: 'session-1', resourceId: 'session-1', sessionId: 'session-1' });
    expect(controller.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1', resourceId: 'session-1', threadId: 'session-1' }),
    );
    expect(session.thread.list).not.toHaveBeenCalled();
    expect(session.thread.switch).not.toHaveBeenCalled();
    expect(session.thread.create).not.toHaveBeenCalled();
  });

  it('reuses the exact Factory session thread across roles', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, undefined, makeSourceControl() as never);

    const triage = await coordinator.prepare(
      startRequest({ role: 'triage', kickoffKey: 'triage-1', kickoffMessage: null }),
    );
    const plan = await coordinator.prepare(
      startRequest({ id: triage.workItemId, role: 'plan', kickoffKey: 'plan-1', kickoffMessage: null }),
    );

    expect(plan.threadId).toBe('session-1');
    expect(plan.threadId).toBe(triage.threadId);
    expect(session.thread.create).not.toHaveBeenCalled();
    expect(session.thread.switch).not.toHaveBeenCalled();
    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'factoryWorkItemId', value: triage.workItemId });
    const item = await storage.get({ orgId: 'org-1', id: triage.workItemId });
    expect(item?.sessions.triage?.threadId).toBe(triage.threadId);
    expect(item?.sessions.plan?.threadId).toBe(triage.threadId);
  });

  it('keeps the bound pending start recoverable and sends nothing when the governed transition rejects', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: { execute: { issue: { onEnter: () => ({ type: 'reject', code: 'forbidden', reason: 'Blocked' }) } } },
        },
      }),
    });
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, transitionService, makeSourceControl() as never);

    await expect(coordinator.prepare({ ...startRequest(), destinationStage: 'execute' })).rejects.toMatchObject({
      result: { status: 'rejected', code: 'forbidden' },
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(await storage.listRunBindings('org-1', PROJECT_ID)).toHaveLength(1);
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({ status: 'failed' });
  });

  it('never sends a kickoff when the binding transaction fails', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    vi.spyOn(storage, 'prepareRunStart').mockRejectedValueOnce(new Error('commit failed'));
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, undefined, makeSourceControl() as never);

    await expect(coordinator.prepare(startRequest())).rejects.toThrow('commit failed');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('replays the same durable pending kickoff and binding without dispatching it inline', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, undefined, makeSourceControl() as never);
    const input = startRequest();

    const first = await coordinator.prepare(input);
    const replay = await coordinator.prepare(input);

    expect(replay).toMatchObject({ workItemId: first.workItemId, bindingId: first.bindingId, replayed: true });
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({ status: 'pending' });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(await storage.listRunBindings('org-1', PROJECT_ID)).toHaveLength(1);
  });

  it('revokes only the prior binding for the same item role', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, undefined, makeSourceControl() as never);
    const first = await coordinator.prepare(startRequest({ kickoffMessage: null }));

    await coordinator.prepare(
      startRequest({ id: first.workItemId, kickoffKey: 'kickoff-2', role: 'work', kickoffMessage: null }),
    );
    const bindings = await storage.listRunBindings('org-1', PROJECT_ID, first.workItemId);
    expect(bindings.map(binding => binding.status).sort()).toEqual(['active', 'revoked']);
    expect(bindings.every(binding => binding.role === 'work')).toBe(true);
  });

  it('scopes kickoff idempotency to tenant and project', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage, undefined, makeSourceControl() as never);
    const first = await coordinator.prepare(startRequest({ kickoffMessage: null }));
    const second = await coordinator.prepare({
      ...startRequest({ sessionId: 'session-2', kickoffMessage: null }),
      orgId: 'org-2',
      workItem: {
        ...startRequest().workItem,
        input: {
          ...startRequest().workItem.input,
          externalSource: { integrationId: 'github', type: 'issue' as const, externalId: '2' },
        },
      },
    });

    expect(second.replayed).toBe(false);
    expect(second.workItemId).not.toBe(first.workItemId);
    expect(await storage.listPendingStarts('org-1', PROJECT_ID)).toHaveLength(1);
    expect(await storage.listPendingStarts('org-2', PROJECT_ID)).toHaveLength(1);
  });
});
