import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import type { SendNotificationSignalInput } from '@mastra/core/notifications';
import { describe, expect, it, vi } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { FactoryRunBindingRecord, WorkItemSubscription } from '../storage/domains/work-items/base.js';
import type { FactoryDeliveryController } from './deliver.js';
import { SIGNAL_RATE_LIMIT, createFactoryMessagingTools } from './messaging-tools.js';
import type { FactoryMessagingToolDependencies } from './messaging-tools.js';
import { FACTORY_TOOLS_WITHOUT_APPROVAL } from './permissions.js';
import type { FactoryToolScope } from './scope.js';
import type { FactoryToolDependencies } from './index.js';
import { createFactoryTools } from './index.js';

const USER: FactoryToolScope = {
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  userId: 'user-1',
  sessionId: 'session-1',
  resourceId: 'session-1',
  threadId: 'thread-session-1',
  kind: 'user',
  interactive: true,
};

const WORKER: FactoryToolScope = {
  ...USER,
  userId: 'user-b',
  sessionId: 'session-b',
  resourceId: 'session-b',
  threadId: 'thread-session-b',
  kind: 'worker',
  interactive: false,
};

function row(sessionId: string, extra: Partial<SourceControlSession> = {}) {
  return {
    sessionId,
    orgId: 'org-1',
    userId: 'user-b',
    factoryProjectId: 'project-1',
    projectRepositoryId: 'repo-link-1',
    visibility: 'org',
    ...extra,
  } as SourceControlSession;
}

const ROWS: Record<string, SourceControlSession> = {
  'session-1': row('session-1', { userId: 'user-1' }),
  'session-b': row('session-b'),
  'session-private': row('session-private', { visibility: 'private' }),
  'session-mine-private': row('session-mine-private', { userId: 'user-1', visibility: 'private' }),
  'session-other-factory': row('session-other-factory', { factoryProjectId: 'project-2' }),
  'session-other-org': row('session-other-org', { orgId: 'org-2' }),
  'session-worker': row('session-worker'),
};

function setup({
  subscriptions = [] as WorkItemSubscription[],
  bindings = [] as FactoryRunBindingRecord[],
  threads = 'live' as 'live' | 'gone',
} = {}) {
  const notifications = new InMemoryNotificationsStorage();
  const sent: Array<{ input: SendNotificationSignalInput; target: { resourceId: string; threadId: string } }> = [];
  const agent = {
    sendNotificationSignal: vi.fn(
      async (input: SendNotificationSignalInput, target: { resourceId: string; threadId: string }) => {
        sent.push({ input, target });
        const record = await notifications.createNotification({ ...input, ...target });
        return { record, decision: { action: 'deliver' }, persisted: Promise.resolve() };
      },
    ),
  };
  const liveSession = (resourceId: string) => ({ thread: { getId: () => `thread-${resourceId}` } });
  const controller = {
    queryThreadById: vi.fn(async ({ threadId }: { threadId: string }) =>
      threads === 'gone' ? undefined : { id: threadId, resourceId: threadId.replace(/^thread-/, '') },
    ),
    queryThreads: vi.fn(async () => []),
    getSessionByResource: vi.fn(async (resourceId: string) => liveSession(resourceId)),
    createSession: vi.fn(),
    getCurrentAgent: vi.fn(() => agent),
  };
  const auditRecorder = { record: vi.fn(async () => undefined) };
  const deps: FactoryMessagingToolDependencies = {
    sessions: { getBySessionId: vi.fn(async (id: string) => ROWS[id] ?? null) },
    workItems: {
      findActiveRunBindingForSession: vi.fn(
        async ({ sessionId }: { sessionId: string }) =>
          bindings.find(binding => binding.sessionId === sessionId && binding.status === 'active') ?? null,
      ),
      getForProject: vi.fn(async (_org: string, _project: string, id: string) =>
        id === 'item-7' ? ({ id, metadata: { number: 7 } } as never) : null,
      ),
      listSessionSubscriptions: vi.fn(async ({ sessionId }: { sessionId: string }) =>
        subscriptions.filter(subscription => subscription.sessionId === sessionId),
      ),
      listRunBindings: vi.fn(async (_org: string, _project: string, workItemId?: string) =>
        bindings.filter(binding => binding.workItemId === workItemId),
      ),
    } as unknown as FactoryMessagingToolDependencies['workItems'],
    auditRecorder: auditRecorder as unknown as FactoryMessagingToolDependencies['auditRecorder'],
    messaging: async () => ({ controller: controller as unknown as FactoryDeliveryController, notifications }),
  };
  const run = async (scope: FactoryToolScope, name: string, input: Record<string, unknown>) => {
    const tools = createFactoryMessagingTools(scope, deps);
    const tool = tools[name];
    if (!tool?.execute) throw new Error(`tool ${name} not registered for this scope`);
    return tool.execute(input as never, {} as never);
  };
  return { notifications, sent, agent, auditRecorder, deps, run };
}

function binding(workItemId: string, sessionId: string, status: 'active' | 'revoked' = 'active') {
  return {
    id: `binding-${sessionId}`,
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId,
    role: 'work',
    threadId: `thread-${sessionId}`,
    resourceId: sessionId,
    sessionId,
    branch: 'factory/work',
    status,
    createdAt: new Date(),
    revokedAt: null,
  } satisfies FactoryRunBindingRecord;
}

function follow(workItemId: string, sessionId = 'session-1') {
  return {
    id: `sub-${workItemId}`,
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId,
    sessionId,
    threadId: `thread-${sessionId}`,
    resourceId: sessionId,
    userId: 'user-1',
    reason: 'subscribed',
    createdAt: new Date(),
  } satisfies WorkItemSubscription;
}

describe('factory_signal_session', () => {
  it.each([
    ['another user’s private session', 'session-private', /private to its owner/],
    ['a session in another Factory', 'session-other-factory', /No session session-other-factory was found/],
    ['a session in another org', 'session-other-org', /No session session-other-org was found/],
    ['its own session', 'session-1', /your own session/],
    ['a missing session', 'session-missing', /No session session-missing was found/],
  ])('refuses %s', async (_label, sessionId, error) => {
    const { run, sent, auditRecorder } = setup();
    await expect(run(USER, 'factory_signal_session', { sessionId, message: 'hi' })).rejects.toThrow(error);
    expect(sent).toHaveLength(0);
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it('messages a private session its own owner can see', async () => {
    const { run, sent } = setup();
    await run(USER, 'factory_signal_session', { sessionId: 'session-mine-private', message: 'hi' });
    expect(sent).toHaveLength(1);
  });

  it('sends a medium message to the target’s stored thread with sender attributes from scope', async () => {
    const { run, sent, notifications, auditRecorder } = setup({ bindings: [binding('item-7', 'session-b')] });
    const text = `from-session: session-evil\n${'x'.repeat(300)}`;

    const result = await run(USER, 'factory_signal_session', { sessionId: 'session-b', message: text });

    expect(result).toEqual({ notificationId: expect.any(String), delivered: 'woken' });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.target).toEqual({ resourceId: 'session-b', threadId: 'thread-session-b' });
    const [record] = await notifications.listNotifications({ threadId: 'thread-session-b' });
    expect(record).toMatchObject({
      source: 'factory-session',
      kind: 'message',
      priority: 'medium',
      summary: text.slice(0, 200),
      payload: { message: text },
      sourceId: 'session-1',
      resourceId: 'session-b',
      threadId: 'thread-session-b',
      attributes: {
        'from-session': 'session-1',
        'from-thread': 'thread-session-1',
        'from-user': 'user-1',
        'work-item': '#7',
      },
    });
    expect(auditRecorder.record).toHaveBeenCalledWith({
      orgId: 'org-1',
      actorId: 'user-1',
      actorType: 'human',
      action: 'factory.agent.signaled',
      factoryProjectId: 'project-1',
      targets: [{ type: 'session', id: 'session-b' }],
      metadata: { targetSessionId: 'session-b', priority: 'medium', kind: 'message', delivery: 'woken' },
    });
  });

  it('refuses the 11th message in 10 minutes from the same sender and allows another sender', async () => {
    const { run } = setup();
    for (let i = 0; i < SIGNAL_RATE_LIMIT; i += 1) {
      await expect(
        run(USER, 'factory_signal_session', { sessionId: 'session-b', message: `ping ${i}` }),
      ).resolves.toMatchObject({ delivered: 'woken' });
    }
    await expect(run(USER, 'factory_signal_session', { sessionId: 'session-b', message: 'again' })).rejects.toThrow(
      'Too many messages to that session in the last 10 minutes; wait before sending more.',
    );
    const other = { ...USER, sessionId: 'session-mine-private', threadId: 'thread-session-mine-private' };
    await expect(
      run(other, 'factory_signal_session', { sessionId: 'session-b', message: 'hi' }),
    ).resolves.toMatchObject({
      delivered: 'woken',
    });
  });

  it('counts only messages from the last 10 minutes', async () => {
    const { run } = setup();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-14T10:00:00Z') });
    try {
      for (let i = 0; i < SIGNAL_RATE_LIMIT; i += 1) {
        await run(USER, 'factory_signal_session', { sessionId: 'session-b', message: `ping ${i}` });
      }
      vi.setSystemTime(new Date('2026-10-14T10:10:01Z'));
      await expect(
        run(USER, 'factory_signal_session', { sessionId: 'session-b', message: 'later' }),
      ).resolves.toMatchObject({ delivered: 'woken' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns the unavailable message and writes no audit when the target thread is gone', async () => {
    const { run, sent, auditRecorder } = setup({ threads: 'gone' });
    await expect(run(USER, 'factory_signal_session', { sessionId: 'session-b', message: 'hi' })).rejects.toThrow(
      'The session is not available (thread-not-found).',
    );
    expect(sent).toHaveLength(0);
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it('on a turn nobody signed in started, only reaches active workers of followed items', async () => {
    const nonInteractive = { ...USER, interactive: false };
    const { run, sent } = setup({
      subscriptions: [follow('item-7')],
      bindings: [binding('item-7', 'session-worker'), binding('item-9', 'session-b')],
    });

    await expect(
      run(nonInteractive, 'factory_signal_session', { sessionId: 'session-b', message: 'hi' }),
    ).rejects.toThrow(/sessions working on items this session follows/);
    expect(sent).toHaveLength(0);

    await expect(
      run(nonInteractive, 'factory_signal_session', { sessionId: 'session-worker', message: 'hi' }),
    ).resolves.toMatchObject({ delivered: 'woken' });
  });

  it('audits a turn nobody signed in started as the thread agent, not the person', async () => {
    const { run, auditRecorder } = setup({
      subscriptions: [follow('item-7')],
      bindings: [binding('item-7', 'session-worker')],
    });
    await run({ ...USER, interactive: false }, 'factory_signal_session', {
      sessionId: 'session-worker',
      message: 'hi',
    });
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'agent:thread-session-1', actorType: 'agent' }),
    );
  });

  it('does not reach a revoked worker of a followed item on a non-interactive turn', async () => {
    const { run } = setup({
      subscriptions: [follow('item-7')],
      bindings: [binding('item-7', 'session-worker', 'revoked')],
    });
    await expect(
      run({ ...USER, interactive: false }, 'factory_signal_session', { sessionId: 'session-worker', message: 'hi' }),
    ).rejects.toThrow();
  });
});

describe('factory_message_origin', () => {
  async function messaged(setupResult: ReturnType<typeof setup>) {
    const sent = (await setupResult.run(USER, 'factory_signal_session', {
      sessionId: 'session-b',
      message: 'Is the build green?',
    })) as { notificationId: string };
    return sent.notificationId;
  }

  it('answers a message on the original sender’s thread, audited as a reply', async () => {
    const env = setup();
    const messageId = await messaged(env);
    env.auditRecorder.record.mockClear();

    const result = await env.run(WORKER, 'factory_message_origin', {
      message: 'Yes, all green.',
      inReplyTo: messageId,
      status: 'done',
    });

    expect(result).toEqual({ notificationId: expect.any(String), delivered: 'woken' });
    expect(env.sent.at(-1)!.target).toEqual({ resourceId: 'session-1', threadId: 'thread-session-1' });
    const [reply] = await env.notifications.listNotifications({ threadId: 'thread-session-1' });
    expect(reply).toMatchObject({
      source: 'factory-session',
      kind: 'reply',
      priority: 'high',
      payload: { message: 'Yes, all green.' },
      threadId: 'thread-session-1',
      resourceId: 'session-1',
      attributes: {
        'from-session': 'session-b',
        'from-thread': 'thread-session-b',
        'from-user': 'user-b',
        'in-reply-to': messageId,
        status: 'done',
      },
    });
    expect(env.auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'factory.agent.signaled',
        actorType: 'agent',
        actorId: 'agent:thread-session-b',
        metadata: { targetSessionId: 'session-1', priority: 'high', kind: 'reply', delivery: 'woken' },
      }),
    );
  });

  it('audits an interactive worker turn as the thread agent, not the row owner', async () => {
    const env = setup();
    const messageId = await messaged(env);
    env.auditRecorder.record.mockClear();

    await env.run({ ...WORKER, interactive: true }, 'factory_message_origin', {
      message: 'Yes, all green.',
      inReplyTo: messageId,
    });

    expect(env.auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'agent:thread-session-b', actorType: 'agent' }),
    );
  });

  it('refuses a second reply to the same message', async () => {
    const env = setup();
    const messageId = await messaged(env);
    await env.run(WORKER, 'factory_message_origin', { message: 'one', inReplyTo: messageId });
    await expect(env.run(WORKER, 'factory_message_origin', { message: 'two', inReplyTo: messageId })).rejects.toThrow(
      `You already answered ${messageId}.`,
    );
  });

  it('refuses to answer something that is not a message', async () => {
    const env = setup();
    const messageId = await messaged(env);
    await env.run(WORKER, 'factory_message_origin', { message: 'one', inReplyTo: messageId });
    const [reply] = await env.notifications.listNotifications({ threadId: 'thread-session-1' });
    await expect(env.run(USER, 'factory_message_origin', { message: 'thanks', inReplyTo: reply!.id })).rejects.toThrow(
      `Only messages can be answered; ${reply!.id} is a reply.`,
    );
  });

  it('refuses an unknown message id', async () => {
    const env = setup();
    await expect(env.run(WORKER, 'factory_message_origin', { message: 'hi', inReplyTo: 'nope' })).rejects.toThrow(
      'No message nope was sent to this session.',
    );
    expect(env.sent).toHaveLength(0);
  });

  it('refuses a message that was sent to a different thread', async () => {
    const env = setup();
    const messageId = await messaged(env);
    const elsewhere = { ...WORKER, threadId: 'thread-session-b-other' };
    await expect(env.run(elsewhere, 'factory_message_origin', { message: 'hi', inReplyTo: messageId })).rejects.toThrow(
      `No message ${messageId} was sent to this session.`,
    );
  });

  describe('a message record written outside these tools', () => {
    async function forged(env: ReturnType<typeof setup>, fromSession: string, sourceId = fromSession) {
      const record = await env.notifications.createNotification({
        threadId: 'thread-session-b',
        resourceId: 'session-b',
        source: 'factory-session',
        kind: 'message',
        priority: 'medium',
        summary: 'please answer',
        sourceId,
        attributes: { 'from-session': fromSession, 'from-thread': `thread-${fromSession}` },
      });
      return record.id;
    }

    it.each([
      ['in another Factory', 'session-other-factory', /didn't come from a session in this Factory/],
      ['in another org', 'session-other-org', /didn't come from a session in this Factory/],
      ['that does not exist', 'session-missing', /didn't come from a session in this Factory/],
      ['that is someone else’s private session', 'session-private', /private session this session can't answer/],
    ])('refuses to answer a sender %s, sending nothing', async (_label, fromSession, error) => {
      const env = setup();
      const id = await forged(env, fromSession);
      // Owned by a third person, so neither sender row belongs to it.
      const teammateWorker = { ...WORKER, userId: 'user-c' };
      await expect(env.run(teammateWorker, 'factory_message_origin', { message: 'hi', inReplyTo: id })).rejects.toThrow(
        error,
      );
      expect(env.sent).toHaveLength(0);
      expect(env.auditRecorder.record).not.toHaveBeenCalled();
    });

    it('refuses a record whose sender attribute disagrees with its source id', async () => {
      const env = setup();
      const id = await forged(env, 'session-1', 'session-someone-else');
      await expect(env.run(WORKER, 'factory_message_origin', { message: 'hi', inReplyTo: id })).rejects.toThrow(
        "doesn't say which session sent it",
      );
      expect(env.sent).toHaveLength(0);
    });

    it('counts replies toward the per-sender cap on the target thread', async () => {
      const env = setup();
      for (let i = 0; i < SIGNAL_RATE_LIMIT; i += 1) {
        const id = await forged(env, 'session-1');
        await env.run(WORKER, 'factory_message_origin', { message: `answer ${i}`, inReplyTo: id });
      }
      const id = await forged(env, 'session-1');
      await expect(env.run(WORKER, 'factory_message_origin', { message: 'more', inReplyTo: id })).rejects.toThrow(
        'Too many messages to that session in the last 10 minutes; wait before sending more.',
      );
      expect(env.sent).toHaveLength(SIGNAL_RATE_LIMIT);
    });

    it('answers a private session when it belongs to the same person', async () => {
      const env = setup();
      const id = await forged(env, 'session-mine-private');
      const ownWorker = { ...WORKER, userId: 'user-1' };
      await expect(
        env.run(ownWorker, 'factory_message_origin', { message: 'hi', inReplyTo: id }),
      ).resolves.toMatchObject({ delivered: 'woken' });
      expect(env.sent[0]!.target).toEqual({
        resourceId: 'session-mine-private',
        threadId: 'thread-session-mine-private',
      });
    });
  });

  it('asks for inReplyTo when it is missing', async () => {
    const env = setup();
    await expect(env.run(WORKER, 'factory_message_origin', { message: 'hi' })).rejects.toThrow(
      'Pass inReplyTo with the id of the message you are answering.',
    );
  });
});

describe('Factory toolset composition', () => {
  const deps = {
    ...setup().deps,
    workItems: {},
    comments: {},
    audit: {},
    boards: {},
    feed: {},
  } as unknown as FactoryToolDependencies;
  const names = (scope: FactoryToolScope) => Object.keys(createFactoryTools({ scope, deps })).sort();

  it('gives a worker session exactly factory_message_origin', () => {
    expect(names(WORKER)).toEqual(['factory_message_origin']);
  });

  it('gives a user session the Segment 1 tools plus both messaging tools', () => {
    expect(names(USER)).toEqual(
      [
        'factory_list_work_items',
        'factory_inspect_work_item',
        'factory_list_attention',
        'factory_create_work_item',
        'factory_update_work_item',
        'factory_transition_work_item',
        'factory_retry_decision',
        'factory_dismiss_decision',
        'factory_resolve_proposal',
        'factory_subscribe_work_item',
        'factory_unsubscribe_work_item',
        'factory_signal_session',
        'factory_message_origin',
      ].sort(),
    );
  });

  it('gives a non-interactive user turn read tools plus messaging', () => {
    expect(names({ ...USER, interactive: false })).toEqual(
      [
        'factory_list_work_items',
        'factory_inspect_work_item',
        'factory_list_attention',
        'factory_signal_session',
        'factory_message_origin',
      ].sort(),
    );
  });

  it('runs both messaging tools without approval', () => {
    const tools = createFactoryTools({ scope: USER, deps });
    for (const name of ['factory_signal_session', 'factory_message_origin']) {
      expect(tools[name]?.requireApproval).toBeFalsy();
      expect(FACTORY_TOOLS_WITHOUT_APPROVAL).toContain(name);
    }
  });
});
