import { describe, expect, it, vi } from 'vitest';

import { seedFactoryStorageForTests } from '../../storage/test-utils';
import { defaultFactoryRules } from './defaults';
import { FactoryStartCoordinator } from './start-coordinator';
import { FactoryTransitionService } from './transition-service';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function makeController(sendMessage = vi.fn(async () => {}), threads: Array<{ id: string; updatedAt: Date }> = []) {
  let threadId: string | undefined;
  const session = {
    thread: {
      list: vi.fn(async () => threads),
      switch: vi.fn(async ({ threadId: id }: { threadId: string }) => {
        threadId = id;
      }),
      create: vi.fn(async () => {
        threadId = 'thread-1';
        return { id: threadId };
      }),
      setSetting: vi.fn(async () => {}),
      requireId: vi.fn(() => {
        if (!threadId) throw new Error('missing thread');
        return threadId;
      }),
    },
    sendMessage,
  };
  return {
    controller: { createSession: vi.fn(async () => session) },
    session,
    sendMessage,
  };
}

function startRequest(
  overrides: Partial<{ kickoffKey: string; role: string; kickoffMessage: string | null; id: string }> = {},
) {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    resourceId: 'resource-1',
    projectPath: '/worktrees/issue-1',
    branch: 'factory/issue-1',
    threadTitle: 'Investigate issue 1',
    threadTags: { role: overrides.role ?? 'work' },
    kickoffKey: overrides.kickoffKey ?? 'kickoff-1',
    kickoffMessage: overrides.kickoffMessage === undefined ? 'Start work' : overrides.kickoffMessage,
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
  it('commits the item session, exact binding, and durable pending start without dispatching inline', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage);

    const prepared = await coordinator.prepare(startRequest());

    expect(prepared).toMatchObject({
      threadId: 'thread-1',
      kickoffStatus: 'pending',
      replayed: false,
    });
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('pending');
    expect(await storage.listRunBindings('org-1', PROJECT_ID)).toHaveLength(1);
    expect(sendMessage).not.toHaveBeenCalled();
    const item = await storage.get({ orgId: 'org-1', id: prepared.workItemId });
    expect(item?.sessions.work).toMatchObject({
      threadId: 'thread-1',
      projectPath: '/worktrees/issue-1',
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
    const coordinator = new FactoryStartCoordinator(controller as never, storage, transitionService);

    const prepared = await coordinator.prepare({ ...startRequest(), destinationStage: 'execute' });

    expect(prepared.revision).toBe(2);
    expect((await storage.get({ orgId: 'org-1', id: prepared.workItemId }))?.stages).toEqual(['execute']);
    expect(bindingsDuringRule).toBe(1);
    expect(sendMessage).not.toHaveBeenCalled();
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('pending');
  });

  it('reuses the newest server-resolved tagged thread instead of creating one in the browser', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller, session } = makeController(
      vi.fn(async () => {}),
      [
        { id: 'thread-old', updatedAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'thread-new', updatedAt: new Date('2026-02-01T00:00:00Z') },
      ],
    );
    const coordinator = new FactoryStartCoordinator(controller as never, storage);

    const prepared = await coordinator.prepare(startRequest({ kickoffMessage: null }));

    expect(prepared.threadId).toBe('thread-new');
    expect(session.thread.list).toHaveBeenCalledWith({ metadata: { projectPath: '/worktrees/issue-1' } });
    expect(session.thread.switch).toHaveBeenCalledWith({ threadId: 'thread-new' });
    expect(session.thread.create).not.toHaveBeenCalled();
  });

  it('reuses one work-item thread across roles and converges every session ref', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage);

    const triage = await coordinator.prepare(
      startRequest({ role: 'triage', kickoffKey: 'triage-1', kickoffMessage: null }),
    );
    const plan = await coordinator.prepare(
      startRequest({ id: triage.workItemId, role: 'plan', kickoffKey: 'plan-1', kickoffMessage: null }),
    );

    expect(plan.threadId).toBe(triage.threadId);
    expect(session.thread.create).toHaveBeenCalledTimes(1);
    expect(session.thread.switch).toHaveBeenCalledWith({ threadId: triage.threadId });
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
    const coordinator = new FactoryStartCoordinator(controller as never, storage, transitionService);

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
    const coordinator = new FactoryStartCoordinator(controller as never, storage);

    await expect(coordinator.prepare(startRequest())).rejects.toThrow('commit failed');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('replays the same durable pending kickoff and binding without dispatching it inline', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(controller as never, storage);
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
    const coordinator = new FactoryStartCoordinator(controller as never, storage);
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
    const coordinator = new FactoryStartCoordinator(controller as never, storage);
    const first = await coordinator.prepare(startRequest({ kickoffMessage: null }));
    const second = await coordinator.prepare({
      ...startRequest({ kickoffMessage: null }),
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
