import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultFactoryRules } from './defaults.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryStartCoordinator } from './start-coordinator.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactoryCommitDecision } from './types.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function createItem(storage: WorkItemsStorage, sourceKey = 'github-issue:1') {
  return (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: sourceKey },
        title: 'Fix issue',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    })
  ).item;
}

function createSession(accepted?: Promise<unknown>) {
  let threadId = 'thread-1';
  const consumeStream = vi.fn(async () => {});
  const notificationAccepted = accepted ?? Promise.resolve({ action: 'wake', output: { consumeStream } });
  const deliveredKeys = new Set<string>();
  const deliveredSignals = new Set<string>();
  const delivered: string[] = [];
  const sendNotificationSignal = vi.fn(
    async (input: { dedupeKey?: string }, _options?: { requestContext?: { get(key: string): unknown } }) => {
      if (input.dedupeKey && !deliveredKeys.has(input.dedupeKey)) {
        deliveredKeys.add(input.dedupeKey);
        delivered.push(input.dedupeKey);
      }
      return { persisted: Promise.resolve(), accepted: notificationAccepted };
    },
  );
  const session = {
    thread: {
      list: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: threadId })),
      switch: vi.fn(async ({ threadId: next }: { threadId: string }) => {
        threadId = next;
      }),
      setSetting: vi.fn(async () => {}),
      rename: vi.fn(async () => {}),
      requireId: vi.fn(() => threadId),
      listActiveMessages: vi.fn(async () => [...deliveredSignals].map(id => ({ id }))),
    },
    getWorkspace: () => ({
      skills: {
        maybeRefresh: vi.fn(async () => {}),
        get: vi.fn(async (name: string) => ({ name, instructions: 'Follow the skill.' })),
      },
    }),
    sendMessage: vi.fn(async () => {}),
    sendSignal: vi.fn((input: { id: string }, _options: { requestContext: { get(key: string): unknown } }) => {
      deliveredSignals.add(input.id);
      return { accepted: Promise.resolve({ accepted: true }) };
    }),
    sendNotificationSignal,
  };
  const controller = {
    createSession: vi.fn(async () => session),
    getSessionByResource: vi.fn(async (): Promise<typeof session | undefined> => session),
  };
  return { controller, session, delivered, sendNotificationSignal, consumeStream };
}

async function queueDecision(storage: WorkItemsStorage, decision: FactoryCommitDecision) {
  const item = await createItem(storage);
  const rules = defaultFactoryRules({
    version: 'rules-v1',
    overrides: { work: { execute: { issue: { onEnter: () => decision } } } },
  });
  const transitionService = new FactoryTransitionService({ storage, rules });
  const result = await transitionService.transition({
    orgId: 'org-1',
    factoryProjectId: PROJECT_ID,
    workItemId: item.id,
    board: 'work',
    stage: 'execute',
    expectedRevision: item.revision,
    actor: { type: 'human', id: 'user-1' },
    ingress: { type: 'human', identity: 'move-1' },
    cause: 'test',
  });
  expect(result.status).toBe('accepted');
  return { item, transitionService };
}

describe('FactoryDecisionDispatcher', () => {
  it('reconciles persisted tool results before claiming each dispatch batch', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const reconcileToolResults = vi.fn(async () => {});
    const { controller } = createSession();
    const transitionService = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      reconcileToolResults,
    });

    await dispatcher.runOnce();

    expect(reconcileToolResults).toHaveBeenCalledTimes(1);
  });

  it('allows only one concurrent lease owner to claim a decision', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const now = new Date('2030-01-01T00:00:00Z');

    const [left, right] = await Promise.all([
      storage.claimDeferredDecisions({
        ownerId: 'left',
        now,
        leaseExpiresAt: new Date(now.getTime() + 30_000),
        limit: 1,
      }),
      storage.claimDeferredDecisions({
        ownerId: 'right',
        now,
        leaseExpiresAt: new Date(now.getTime() + 30_000),
        limit: 1,
      }),
    ]);

    expect(left.length + right.length).toBe(1);
  });

  it('recovers an expired lease and fences the stale owner', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const firstNow = new Date('2030-01-01T00:00:00Z');
    const [first] = await storage.claimDeferredDecisions({
      ownerId: 'first',
      now: firstNow,
      leaseExpiresAt: new Date(firstNow.getTime() + 1_000),
      limit: 1,
    });
    const secondNow = new Date(firstNow.getTime() + 2_000);
    const [recovered] = await storage.claimDeferredDecisions({
      ownerId: 'second',
      now: secondNow,
      leaseExpiresAt: new Date(secondNow.getTime() + 1_000),
      limit: 1,
    });

    expect(recovered).toMatchObject({ id: first!.id, attempts: 2, leaseOwner: 'second' });
    await expect(
      storage.completeDeferredDecision(
        { id: first!.id, orgId: 'org-1', factoryProjectId: PROJECT_ID, ownerId: 'first' },
        secondNow,
      ),
    ).resolves.toBeNull();
  });

  it('dispatches a bound session message through notification dedupe and marks the effect succeeded', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const { controller, delivered } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect(delivered).toEqual(['message-1']);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'succeeded',
      attempts: 1,
    });
  });

  it('prepares a binding, delivers to active sessions, and consumes idle wake streams for an urgent stage transition', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'plan',
      message: 'This work was moved from the triage stage to the planning stage.',
      priority: 'urgent',
      idleBehavior: 'wake',
      prepareBinding: true,
      idempotencyKey: 'stage-transition-1',
    });
    const { controller, sendNotificationSignal, consumeStream } = createSession();
    const prepareBinding = vi.fn(async () => {
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: item.externalSource,
            title: item.title,
            stages: ['execute'],
            sessions: {},
            metadata: item.metadata,
          },
        },
        role: 'plan',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'stage-transition-1',
        kickoffMessage: null,
      });
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      prepareBinding,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(prepareBinding).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: item.id }), role: 'plan' }),
    );
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rule-message',
        priority: 'urgent',
        summary: 'This work was moved from the triage stage to the planning stage.',
      }),
      {
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'wake' },
        requestContext: expect.anything(),
      },
    );
    const requestContext = sendNotificationSignal.mock.calls[0]?.[1]?.requestContext;
    expect(requestContext?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(consumeStream).toHaveBeenCalledOnce();
  });

  it('renews the lease while an external delivery remains in flight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    try {
      const storage = (await createFactoryStorageForTests()).workItems;
      const { item, transitionService } = await queueDecision(storage, {
        type: 'sendMessage',
        role: 'work',
        message: 'Review completion.',
        idempotencyKey: 'message-1',
      });
      let accept!: (value: unknown) => void;
      const accepted = new Promise<unknown>(resolve => {
        accept = resolve;
      });
      const { controller } = createSession(accepted);
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
            title: 'Fix issue',
            stages: ['execute'],
            sessions: {},
            metadata: {},
          },
        },
        role: 'work',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'kickoff-null',
        kickoffMessage: null,
      });
      const renew = vi.spyOn(storage, 'renewDeferredDecisionLease');
      const dispatcher = new FactoryDecisionDispatcher({
        controller: controller as never,
        transitionService,
        storage,
        ownerId: 'worker-1',
      });

      const dispatch = dispatcher.runOnce();
      await vi.advanceTimersByTimeAsync(10_001);
      expect(renew).toHaveBeenCalledOnce();
      expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.leaseExpiresAt?.toISOString()).toBe(
        '2030-01-01T00:00:40.000Z',
      );
      accept({ action: 'wake', output: { consumeStream: vi.fn(async () => {}) } });
      await dispatch;
      expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the resolved skill activation as the bound session kickoff prompt', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      arguments: 'Issue 42',
      idempotencyKey: 'skill-1',
      precedingMessage: 'This work was moved from the planning stage to the execute stage.',
    });
    const { controller, session, sendNotificationSignal } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    const primeCredentials = vi.fn(async () => {});
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      primeCredentials,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(primeCredentials).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      {
        source: 'factory',
        kind: 'stage-transition',
        summary: 'This work was moved from the planning stage to the execute stage.',
        priority: 'medium',
        payload: { message: 'This work was moved from the planning stage to the execute stage.' },
        sourceId: expect.stringMatching(/:stage-transition$/),
        dedupeKey: 'skill-1:stage-transition',
      },
      {
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'persist' },
        requestContext: expect.anything(),
      },
    );
    expect(sendNotificationSignal.mock.invocationCallOrder[0]).toBeLessThan(
      session.sendSignal.mock.invocationCallOrder[0]!,
    );
    expect(session.sendSignal).toHaveBeenCalledWith(
      {
        id: expect.any(String),
        type: 'user',
        tagName: 'user',
        contents: expect.stringMatching(/<skill name="understand-issue">[\s\S]*ARGUMENTS: Issue 42[\s\S]*<\/skill>/),
      },
      { requestContext: expect.anything() },
    );
    const requestContext = session.sendSignal.mock.calls[0]?.[1]?.requestContext;
    expect(requestContext?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
  });

  it('prepares a missing binding before dispatching a rule-driven skill', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-auto-start',
    });
    const { controller, session } = createSession();
    const prepareBinding = vi.fn(async () => {
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: item.externalSource,
            title: item.title,
            stages: ['intake'],
            sessions: {},
            metadata: item.metadata,
          },
        },
        role: 'triage',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'skill-auto-start',
        kickoffMessage: null,
      });
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      prepareBinding,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(prepareBinding).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: item.id }), role: 'triage' }),
    );
    expect(session.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ contents: expect.stringContaining('<skill name="understand-issue">') }),
      { requestContext: expect.anything() },
    );
  });

  it('recreates a missing controller session before dispatching to an active binding', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-session-recovery',
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: item.externalSource,
          title: item.title,
          stages: ['intake'],
          sessions: {},
          metadata: item.metadata,
        },
      },
      role: 'triage',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'skill-session-recovery',
      kickoffMessage: null,
    });
    const { controller, session } = createSession();
    controller.getSessionByResource.mockResolvedValueOnce(undefined as never).mockResolvedValue(session);
    const prepareBinding = vi.fn(async () => {
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: item.externalSource,
            title: item.title,
            stages: ['intake'],
            sessions: {},
            metadata: item.metadata,
          },
        },
        role: 'triage',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-2' },
        resourceId: PROJECT_ID,
        kickoffKey: 'skill-session-recovery-replacement',
        kickoffMessage: null,
      });
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      prepareBinding,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(prepareBinding).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: item.id }), role: 'triage' }),
    );
    expect(session.thread.switch).toHaveBeenCalledWith({ threadId: 'thread-2' });
    expect(session.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ contents: expect.stringContaining('<skill name="understand-issue">') }),
      { requestContext: expect.anything() },
    );
  });

  it('does not deliver a skill kickoff twice after completion ambiguity', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-ambiguity',
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: item.externalSource,
          title: item.title,
          stages: ['intake'],
          sessions: {},
          metadata: item.metadata,
        },
      },
      role: 'triage',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'skill-ambiguity',
      kickoffMessage: null,
    });
    const [decision] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    const { controller, session } = createSession();
    vi.spyOn(storage, 'completeDeferredDecision').mockRejectedValueOnce(new Error('database unavailable'));
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    const first = new Date('2030-01-01T00:00:00Z');
    await dispatcher.runOnce(first);
    await dispatcher.runOnce(new Date(first.getTime() + 2_000));

    expect(session.sendSignal).toHaveBeenCalledTimes(1);
    expect(session.sendSignal).toHaveBeenCalledWith(expect.objectContaining({ id: decision?.id }), {
      requestContext: expect.anything(),
    });
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('retries after post-delivery completion ambiguity without delivering the notification twice', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const { controller, delivered, sendNotificationSignal } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    vi.spyOn(storage, 'completeDeferredDecision').mockRejectedValueOnce(new Error('database unavailable'));
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    const first = new Date('2030-01-01T00:00:00Z');
    await dispatcher.runOnce(first);
    await dispatcher.runOnce(new Date(first.getTime() + 2_000));

    expect(sendNotificationSignal).toHaveBeenCalledTimes(2);
    expect(delivered).toEqual(['message-1']);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('recovers linked-item materialization after an upsert crash and fires Intake onEnter exactly once', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const parent = await createItem(storage);
    const intakeEntered = vi.fn();
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'upsertLinkedWorkItem',
                idempotencyKey: 'linked-1',
                board: 'work',
                source: 'github-issue',
                sourceKey: 'github-issue:2',
                title: 'Linked issue',
                url: null,
                stage: 'intake',
              }),
            },
          },
          intake: { issue: { onEnter: intakeEntered } },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: parent.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: parent.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-linked' },
      cause: 'test',
    });
    let failInitialEntry = true;
    const recoveringTransition = {
      transition: vi.fn(async (request: Parameters<FactoryTransitionService['transition']>[0]) => {
        if (request.initialEntry && failInitialEntry) {
          failInitialEntry = false;
          throw new Error('crash after upsert');
        }
        return transitionService.transition(request);
      }),
    };
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService: recoveringTransition,
      storage,
      ownerId: 'worker-1',
    });
    const first = new Date('2030-01-01T00:00:00Z');

    await dispatcher.runOnce(first);
    await dispatcher.runOnce(new Date(first.getTime() + 2_000));

    const linked = (await storage.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).find(
      item => item.externalSource?.externalId === 'github-issue:2',
    );
    expect(linked).toMatchObject({ parentWorkItemId: parent.id, stages: ['intake'] });
    expect(intakeEntered).toHaveBeenCalledTimes(1);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('removes a newly materialized linked item when its initial Intake entry is rejected', async () => {
    const { workItems: storage } = await createFactoryStorageForTests();
    const parent = await createItem(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'upsertLinkedWorkItem',
                idempotencyKey: 'linked-rejected',
                board: 'work',
                source: 'github-issue',
                sourceKey: 'github-issue:2',
                title: 'Rejected linked issue',
                url: null,
                stage: 'intake',
              }),
            },
          },
          intake: {
            issue: {
              onEnter: () => ({ type: 'reject', code: 'forbidden', reason: 'Intake is closed.' }),
            },
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: parent.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: parent.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-linked-rejected' },
      cause: 'test',
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(
      (await storage.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).find(
        item => item.externalSource?.externalId === 'github-issue:2',
      ),
    ).toBeUndefined();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      lastError: 'forbidden: Intake is closed.',
    });
  });

  it('does not replay Intake onEnter when a linked upsert reuses an independently-created item', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const parent = await createItem(storage);
    await createItem(storage, 'github-issue:2');
    const intakeEntered = vi.fn();
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'upsertLinkedWorkItem',
                idempotencyKey: 'linked-1',
                board: 'work',
                source: 'github-issue',
                sourceKey: 'github-issue:2',
                title: 'Linked issue',
                url: null,
                stage: 'intake',
              }),
            },
          },
          intake: { issue: { onEnter: intakeEntered } },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: parent.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: parent.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-linked' },
      cause: 'test',
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(intakeEntered).not.toHaveBeenCalled();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('rejects a chained effect at the bounded causal depth before external dispatch', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'sendMessage',
                role: 'work',
                message: 'Too deep.',
                idempotencyKey: 'message-deep',
              }),
            },
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: item.revision,
      actor: { type: 'system', id: 'test' },
      ingress: { type: 'rule', identity: 'deep-chain' },
      cause: 'test',
      causalChain: Array.from({ length: 8 }, (_, index) => ({
        ingressId: `ancestor-${index}`,
        decisionType: 'transition' as const,
      })),
    });
    const { controller, sendNotificationSignal } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      lastError: 'Factory rule causal depth exceeded.',
    });
  });

  it('backs off missing bindings and reaches a bounded terminal failure with sanitized errors', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });
    const start = new Date('2030-01-01T00:00:00Z');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await dispatcher.runOnce(new Date(start.getTime() + attempt * 120_000));
    }

    const [decision] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decision).toMatchObject({ status: 'failed', attempts: 5 });
    expect(decision!.lastError).toBe('No active Factory binding for role work.');
    expect(decision!.lastError!.length).toBeLessThanOrEqual(512);
  });

  it('recovers and dispatches a prepared kickoff after the coordinator returns', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, delivered, sendNotificationSignal } = createSession();
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const transitionService = new FactoryTransitionService({ storage, rules });
    const sourceControl = {
      sessions: {
        getBySessionId: async () => ({
          id: 'source-session-1',
          sessionId: 'session-1',
          projectRepositoryId: 'project-repository-1',
          orgId: 'org-1',
          userId: 'user-1',
          branch: 'factory/issue-1',
          baseBranch: 'main',
        }),
      },
      projectRepositories: { get: async ({ id }: { id: string }) => ({ id, connectionId: 'connection-1' }) },
      connections: { get: async () => ({ factoryProjectId: PROJECT_ID }) },
    };
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      transitionService,
      sourceControl as never,
    );
    await coordinator.prepare({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      sessionId: 'session-1',
      threadTitle: 'Fix issue',
      kickoffKey: 'kickoff-1',
      invocation: { type: 'prompt', prompt: 'Investigate the issue.' },
      destinationStage: 'triage',
      workItem: {
        role: 'work',
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      },
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    const restarted = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-2',
    });
    await restarted.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect(delivered).toEqual(['factory-kickoff:kickoff-1']);
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('sent');
  });

  it('starts one polling loop and stops claiming before shutdown returns', async () => {
    vi.useFakeTimers();
    try {
      const storage = (await createFactoryStorageForTests()).workItems;
      const deferredClaim = vi.spyOn(storage, 'claimDeferredDecisions');
      const pendingClaim = vi.spyOn(storage, 'claimPendingStarts');
      const { controller } = createSession();
      const transitionService = new FactoryTransitionService({
        storage,
        rules: defaultFactoryRules({ version: 'rules-v1' }),
      });
      const dispatcher = new FactoryDecisionDispatcher({
        controller: controller as never,
        transitionService,
        storage,
        ownerId: 'worker-1',
      });

      dispatcher.start();
      dispatcher.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(deferredClaim).toHaveBeenCalledTimes(1);
      expect(pendingClaim).toHaveBeenCalledTimes(1);

      await dispatcher.stop();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(deferredClaim).toHaveBeenCalledTimes(1);
      expect(pendingClaim).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
