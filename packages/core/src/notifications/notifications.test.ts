import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../mastra';
import { MastraCompositeStore } from '../storage/base';
import { InMemoryNotificationsStorage } from './storage';
import {
  buildNotificationDispatchSchedule,
  createNotificationDispatchWorkflow,
  NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID,
  parseNotificationDispatchNow,
} from './workflow';
import {
  createNotificationInboxTool,
  createNotificationSignal,
  createNotificationSummarySignal,
  dispatchDueNotifications,
  resolveNotificationDeliveryDecision,
  summarizeNotifications,
} from '.';

describe('notification inbox', () => {
  it('stores thread-scoped notifications and filters inbox queries', async () => {
    const storage = new InMemoryNotificationsStorage();
    await storage.createNotification({
      id: 'n1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'CI failed on main',
      resourceId: 'resource-1',
      agentId: 'agent-1',
    });
    await storage.createNotification({
      id: 'n2',
      threadId: 'thread-2',
      source: 'github',
      kind: 'issue',
      summary: 'Issue opened',
    });

    await expect(storage.listNotifications({ threadId: 'thread-1', status: 'pending' })).resolves.toMatchObject([
      { id: 'n1', threadId: 'thread-1', source: 'github', priority: 'high', status: 'pending' },
    ]);
    await expect(storage.listNotifications({ threadId: 'thread-1', resourceId: 'missing' })).resolves.toEqual([]);
  });

  it('stores same notification id independently across threads', async () => {
    const storage = new InMemoryNotificationsStorage();
    await storage.createNotification({
      id: 'shared',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci',
      summary: 'Thread 1',
    });
    await storage.createNotification({
      id: 'shared',
      threadId: 'thread-2',
      source: 'github',
      kind: 'ci',
      summary: 'Thread 2',
    });

    await expect(storage.getNotification({ threadId: 'thread-1', id: 'shared' })).resolves.toMatchObject({
      threadId: 'thread-1',
      summary: 'Thread 1',
    });
    await expect(storage.getNotification({ threadId: 'thread-2', id: 'shared' })).resolves.toMatchObject({
      threadId: 'thread-2',
      summary: 'Thread 2',
    });
  });

  it('deep-clones notification payload, attributes, and metadata at storage boundaries', async () => {
    const storage = new InMemoryNotificationsStorage();
    const payload = { nested: { count: 1 } };
    const attributes = { nested: { label: 'first' } } as any;
    const metadata = { nested: { version: 1 } };
    const created = await storage.createNotification({
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci',
      summary: 'CI failed',
      payload,
      attributes,
      metadata,
    });

    payload.nested.count = 2;
    attributes.nested.label = 'mutated';
    metadata.nested.version = 2;
    (created.payload as any).nested.count = 3;
    (created.attributes as any).nested.label = 'returned';
    (created.metadata as any).nested.version = 3;

    await expect(storage.getNotification({ threadId: 'thread-1', id: created.id })).resolves.toMatchObject({
      payload: { nested: { count: 1 } },
      attributes: { nested: { label: 'first' } },
      metadata: { nested: { version: 1 } },
    });
  });

  it('coalesces duplicate pending notifications by dedupe or coalesce key', async () => {
    const storage = new InMemoryNotificationsStorage();
    const first = await storage.createNotification({
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      summary: 'CI failed: 1 test',
      dedupeKey: 'main-ci',
    });
    const second = await storage.createNotification({
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      summary: 'CI failed: 3 tests',
      dedupeKey: 'main-ci',
    });

    expect(second.id).toBe(first.id);
    expect(second.summary).toBe('CI failed: 3 tests');
    expect(second.coalescedCount).toBe(2);
    await expect(storage.listNotifications({ threadId: 'thread-1' })).resolves.toHaveLength(1);
  });

  it('does not coalesce notifications with different kinds', async () => {
    const storage = new InMemoryNotificationsStorage();
    await storage.createNotification({
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      summary: 'CI failed',
      dedupeKey: 'shared-key',
    });
    await storage.createNotification({
      threadId: 'thread-1',
      source: 'github',
      kind: 'issue',
      summary: 'Issue opened',
      dedupeKey: 'shared-key',
    });

    await expect(storage.listNotifications({ threadId: 'thread-1' })).resolves.toHaveLength(2);
  });

  it('creates individual and summary notification signals', async () => {
    const storage = new InMemoryNotificationsStorage();
    const github = await storage.createNotification({
      id: 'n1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'CI failed on main: 3 tests',
    });
    const slack = await storage.createNotification({
      id: 'n2',
      threadId: 'thread-1',
      source: 'slack',
      kind: 'mention',
      priority: 'medium',
      summary: 'Jane mentioned you',
    });

    expect(createNotificationSignal(github)).toMatchObject({
      type: 'notification',
      tagName: 'notification',
      contents: 'CI failed on main: 3 tests',
      attributes: { source: 'github', type: 'ci-status', kind: 'ci-status', priority: 'high', status: 'pending' },
      metadata: {
        notification: {
          signal: 'notification',
          recordId: 'n1',
          source: 'github',
          kind: 'ci-status',
          priority: 'high',
          status: 'pending',
        },
      },
    });

    await storage.updateNotification({ threadId: 'thread-1', id: slack.id, status: 'seen' });
    const seenSlack = await storage.getNotification({ threadId: 'thread-1', id: slack.id });
    const summarySignal = createNotificationSummarySignal(summarizeNotifications([github, seenSlack!]));
    expect(summarySignal).toMatchObject({
      type: 'notification',
      tagName: 'notification-summary',
      attributes: { pending: 1, priority: 'high' },
      metadata: {
        notification: {
          signal: 'summary',
          pending: 1,
          groups: [{ source: 'github', count: 1 }],
          byPriority: { high: 1 },
          notificationIds: ['n1'],
          priority: 'high',
        },
      },
    });
    expect(summarySignal.metadata?.notificationSummary).toMatchObject({
      pending: 1,
      notificationIds: ['n1'],
      bySource: { github: 1 },
    });
  });

  it('uses one inbox tool to list, read, search, and update notifications', async () => {
    const storage = new InMemoryNotificationsStorage();
    await storage.createNotification({
      id: 'n1',
      threadId: 'thread-1',
      source: 'email',
      kind: 'direct-message',
      summary: 'Jane sent a launch update',
      payload: { body: 'Launch moved to Friday' },
      resourceId: 'resource-1',
      agentId: 'agent-1',
    });
    await storage.createNotification({
      id: 'n2',
      threadId: 'thread-1',
      source: 'github',
      kind: 'pull-request-activity',
      summary: 'CI is still running',
      resourceId: 'resource-1',
      agentId: 'agent-1',
    });
    const sendSignal = vi.fn(signal => ({
      accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
      signal,
      persisted: Promise.resolve(),
    }));
    const tool = createNotificationInboxTool({ storage });

    await expect(tool.execute?.({ action: 'list' }, { agent: { threadId: 'thread-1' } } as any)).resolves.toMatchObject(
      {
        notifications: expect.arrayContaining([
          expect.objectContaining({ id: 'n1', status: 'pending' }),
          expect.objectContaining({ id: 'n2', status: 'pending' }),
        ]),
      },
    );
    await expect(
      tool.execute?.({ action: 'search', query: 'launch' }, { agent: { threadId: 'thread-1' } } as any),
    ).resolves.toMatchObject({ notifications: [{ id: 'n1' }] });
    await expect(
      tool.execute?.({ action: 'search', query: 'github', status: 'pending', source: 'github' }, {
        agent: { threadId: 'thread-1' },
      } as any),
    ).resolves.toMatchObject({ notifications: [{ id: 'n2' }] });
    await expect(
      tool.execute?.({ action: 'read', id: 'n1' }, {
        agent: { agentId: 'agent-1', threadId: 'thread-1', resourceId: 'resource-1' },
        mastra: { getAgentById: vi.fn(async () => ({ sendSignal })) },
      } as any),
    ).resolves.toMatchObject({
      message: '1 notification will now be delivered.',
      delivered: 1,
    });
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notification', tagName: 'notification', contents: 'Jane sent a launch update' }),
      { resourceId: 'resource-1', threadId: 'thread-1' },
    );
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'seen',
    });
    await expect(
      tool.execute?.({ action: 'archive', id: 'n1' }, { agent: { threadId: 'thread-1' } } as any),
    ).resolves.toMatchObject({
      notification: { id: 'n1', status: 'archived' },
    });
  });

  it('resolves priority-aware default delivery decisions', async () => {
    const now = new Date('2026-05-30T12:00:00Z');
    const baseRecord = {
      id: 'n1',
      threadId: 'thread-1',
      source: 'mastracode',
      kind: 'manual',
      status: 'pending',
      summary: 'Test notification',
      createdAt: now,
      updatedAt: now,
    } as const;

    await expect(
      resolveNotificationDeliveryDecision({
        now,
        threadState: 'active',
        record: { ...baseRecord, priority: 'urgent' },
      }),
    ).resolves.toMatchObject({ action: 'deliver', reason: 'urgent' });
    await expect(
      resolveNotificationDeliveryDecision({
        now,
        threadState: 'active',
        record: { ...baseRecord, priority: 'high' },
      }),
    ).resolves.toMatchObject({
      action: 'summarize',
      summaryAt: now,
      deliverAt: now,
      reason: 'active-high-summary-then-full',
    });
    await expect(
      resolveNotificationDeliveryDecision({
        now,
        threadState: 'idle',
        record: { ...baseRecord, priority: 'high' },
      }),
    ).resolves.toMatchObject({ action: 'deliver', reason: 'idle-high' });
    await expect(
      resolveNotificationDeliveryDecision({
        now,
        threadState: 'active',
        record: { ...baseRecord, priority: 'medium' },
      }),
    ).resolves.toMatchObject({ action: 'summarize', summaryAt: now, reason: 'active-batch-summary' });
    await expect(
      resolveNotificationDeliveryDecision({
        now,
        threadState: 'idle',
        record: { ...baseRecord, priority: 'medium' },
      }),
    ).resolves.toMatchObject({ action: 'deliver', reason: 'idle-medium' });
    await expect(
      resolveNotificationDeliveryDecision({
        now,
        threadState: 'active',
        record: { ...baseRecord, priority: 'low' },
      }),
    ).resolves.toMatchObject({ action: 'summarize', summaryAt: now, reason: 'active-batch-summary' });
    await expect(
      resolveNotificationDeliveryDecision({
        now,
        threadState: 'idle',
        record: { ...baseRecord, priority: 'low' },
      }),
    ).resolves.toMatchObject({ action: 'summarize', summaryAt: now, reason: 'idle-low-summary' });
  });

  it('lists due notifications across threads and ignores future or terminal records', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    await storage.createNotification({
      id: 'future',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      summary: 'Future notification',
      deliverAt: new Date('2026-05-30T12:05:00Z'),
    });
    await storage.createNotification({
      id: 'due-later',
      threadId: 'thread-2',
      source: 'slack',
      kind: 'mention',
      summary: 'Due second',
      deliverAt: new Date('2026-05-30T11:59:00Z'),
    });
    await storage.createNotification({
      id: 'due-first',
      threadId: 'thread-3',
      source: 'email',
      kind: 'direct-message',
      summary: 'Due first',
      deliverAt: new Date('2026-05-30T11:58:00Z'),
    });
    await storage.updateNotification({ id: 'due-first', threadId: 'thread-3', status: 'delivered' });
    await storage.createNotification({
      id: 'summary-due',
      threadId: 'thread-4',
      source: 'linear',
      kind: 'issue',
      summary: 'Summary due',
      summaryAt: new Date('2026-05-30T11:57:00Z'),
    });

    await expect(storage.listDueNotifications({ now })).resolves.toMatchObject([
      { id: 'summary-due' },
      { id: 'due-later' },
    ]);
  });

  it('dispatches due individual notifications and marks them delivered', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sent: any[] = [];
    const sendSignal = vi.fn((signal, target) => {
      sent.push({ signal, target });
      return { accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }), signal };
    });
    const mastra = { getAgentById: vi.fn(async () => ({ sendSignal })) } as any;
    await storage.createNotification({
      id: 'n1',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'CI failed',
      deliverAt: now,
    });

    const result = await dispatchDueNotifications({ mastra, storage, now });

    expect(result.failed).toEqual([]);
    expect(result.delivered).toMatchObject([
      { id: 'n1', status: 'delivered', deliveredSignalId: result.signals[0]?.id },
    ]);
    expect(sent).toMatchObject([
      {
        signal: {
          type: 'notification',
          tagName: 'notification',
          contents: 'CI failed',
          attributes: { status: 'delivered' },
        },
        target: { resourceId: 'resource-1', threadId: 'thread-1' },
      },
    ]);
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'delivered',
      deliveredSignalId: result.signals[0]?.id,
    });
  });

  it('records delivery failure when a notification signal is rejected', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sendSignal = vi.fn((signal, _target) => ({
      accepted: Promise.reject(new Error('signal routing failed: no model configured')),
      signal,
    }));
    const mastra = { getAgentById: vi.fn(async () => ({ sendSignal })) } as any;
    await storage.createNotification({
      id: 'n1',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'CI failed',
      deliverAt: now,
    });

    const result = await dispatchDueNotifications({ mastra, storage, now });

    expect(result.delivered).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.failed).toMatchObject([
      { record: { id: 'n1' }, error: 'signal routing failed: no model configured' },
    ]);
    const stored = await storage.getNotification({ threadId: 'thread-1', id: 'n1' });
    expect(stored).toMatchObject({
      status: 'pending',
      deliveryAttempts: 1,
      lastDeliveryError: 'signal routing failed: no model configured',
    });
    expect(stored?.deliveredSignalId).toBeUndefined();
  });

  it('groups due summary notifications by agent, resource, and thread', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sendSignal = vi.fn((signal, _target) => ({
      accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
      signal,
    }));
    const mastra = { getAgentById: vi.fn(async () => ({ sendSignal })) } as any;
    for (const id of ['n1', 'n2']) {
      await storage.createNotification({
        id,
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        source: id === 'n1' ? 'github' : 'slack',
        kind: 'mention',
        summary: `${id} summary`,
        summaryAt: now,
      });
    }

    const result = await dispatchDueNotifications({ mastra, storage, now });

    expect(result.failed).toEqual([]);
    expect(result.delivered).toMatchObject([
      { id: 'n1', status: 'pending', summarySignalId: result.signals[0]?.id },
      { id: 'n2', status: 'pending', summarySignalId: result.signals[0]?.id },
    ]);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notification', tagName: 'notification-summary' }),
      {
        resourceId: 'resource-1',
        threadId: 'thread-1',
      },
    );
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'pending',
      summaryAt: undefined,
      summarySignalId: result.signals[0]?.id,
    });
  });

  it('records summary delivery failure when a notification summary signal is rejected', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sendSignal = vi.fn((signal, _target) => ({
      accepted: Promise.reject(new Error('signal routing failed: no model configured')),
      signal,
    }));
    const mastra = { getAgentById: vi.fn(async () => ({ sendSignal })) } as any;
    await storage.createNotification({
      id: 'n1',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'medium',
      summary: 'CI failed',
      summaryAt: now,
    });

    const result = await dispatchDueNotifications({ mastra, storage, now });

    expect(result.delivered).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.failed).toMatchObject([
      { record: { id: 'n1' }, error: 'signal routing failed: no model configured' },
    ]);
    const stored = await storage.getNotification({ threadId: 'thread-1', id: 'n1' });
    expect(stored).toMatchObject({
      status: 'pending',
      summaryAt: now,
      deliveryAttempts: 1,
      lastDeliveryError: 'signal routing failed: no model configured',
    });
    expect(stored?.summarySignalId).toBeUndefined();
  });

  it('summarizes high-priority active notifications before full idle delivery', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sendSignal = vi.fn((signal, _target) => ({
      accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
      signal,
    }));
    const getPubSub = vi.fn();
    const mastra = { getAgentById: vi.fn(async () => ({ id: 'agent-1', getPubSub, sendSignal })) } as any;
    await storage.createNotification({
      id: 'n1',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'High priority update',
      summaryAt: now,
      deliverAt: now,
    });

    const summaryResult = await dispatchDueNotifications({ mastra, storage, now });

    expect(summaryResult.failed).toEqual([]);
    expect(summaryResult.signals).toHaveLength(1);
    expect(summaryResult.signals[0]).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'pending',
      summaryAt: undefined,
      deliverAt: now,
      summarySignalId: summaryResult.signals[0]?.id,
    });

    sendSignal.mockClear();
    const deliveryResult = await dispatchDueNotifications({ mastra, storage, now });

    expect(deliveryResult.failed).toEqual([]);
    expect(deliveryResult.signals[0]).toMatchObject({
      type: 'notification',
      tagName: 'notification',
      contents: 'High priority update',
    });
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'delivered',
      deliveredSignalId: deliveryResult.signals[0]?.id,
    });
  });

  it('skips high-priority full delivery after it has already been read', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sendSignal = vi.fn((signal, _target) => ({
      accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
      signal,
    }));
    const mastra = { getAgentById: vi.fn(async () => ({ id: 'agent-1', sendSignal })) } as any;
    await storage.createNotification({
      id: 'n1',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'High priority update',
      deliverAt: now,
    });
    await storage.updateNotification({ threadId: 'thread-1', id: 'n1', summarySignalId: 'summary-1' });
    await storage.updateNotification({ threadId: 'thread-1', id: 'n1', status: 'seen' });

    const result = await dispatchDueNotifications({ mastra, storage, now });

    expect(result.delivered).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('persists low-priority summary dispatch without waking idle loops', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sendSignal = vi.fn((signal, _target) => ({
      accepted: Promise.resolve({ action: 'persist' }),
      signal,
      persisted: Promise.resolve(),
    }));
    const mastra = { getAgentById: vi.fn(async () => ({ sendSignal })) } as any;
    await storage.createNotification({
      id: 'n1',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'low',
      summary: 'Low priority update',
      summaryAt: now,
    });

    const result = await dispatchDueNotifications({ mastra, storage, now });

    expect(result.failed).toEqual([]);
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notification', tagName: 'notification-summary' }),
      { resourceId: 'resource-1', threadId: 'thread-1', ifIdle: { behavior: 'persist' } },
    );
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'pending',
      summaryAt: undefined,
      summarySignalId: result.signals[0]?.id,
    });
  });

  it('attaches resolved stream options when a wake dispatch starts a run', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sendSignal = vi.fn((signal, _target) => ({
      accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
      signal,
      persisted: Promise.resolve(),
    }));
    const streamOptions = { memory: { thread: 'thread-1', resource: 'resource-1' }, maxSteps: 1000 };
    const getNotificationStreamOptions = vi.fn(async (_source: string, _target: unknown) => streamOptions);
    const mastra = {
      getAgentById: vi.fn(async () => ({
        sendSignal,
        getNotificationStreamOptions,
      })),
    } as any;
    await storage.createNotification({
      id: 'n1',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'High priority update',
      deliverAt: now,
    });

    const result = await dispatchDueNotifications({ mastra, storage, now });

    expect(result.failed).toEqual([]);
    expect(getNotificationStreamOptions).toHaveBeenCalledWith('github', {
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notification', tagName: 'notification' }),
      { resourceId: 'resource-1', threadId: 'thread-1', ifIdle: { behavior: 'wake', streamOptions } },
    );
  });

  it('keeps failed deliveries pending with attempt metadata', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const mastra = {
      getAgentById: vi.fn(async () => ({
        sendSignal: vi.fn(() => {
          throw new Error('agent offline');
        }),
      })),
    } as any;
    await storage.createNotification({
      id: 'n1',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      source: 'github',
      kind: 'ci-status',
      summary: 'CI failed',
      deliverAt: now,
    });

    const result = await dispatchDueNotifications({ mastra, storage, now });

    expect(result.delivered).toEqual([]);
    expect(result.failed).toMatchObject([{ record: { id: 'n1' }, error: 'agent offline' }]);
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'pending',
      deliveryAttempts: 1,
      lastDeliveryError: 'agent offline',
    });
  });

  it('registers notification dispatch workflow by default', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({
      id: 'notification-workflow-registration-storage',
      domains: { notifications },
    });
    const mastra = new Mastra({
      storage,
      logger: false,
    });

    try {
      const workflow = (mastra as any).getWorkflow('__mastra_notification_dispatcher');
      expect(workflow.id).toBe('__mastra_notification_dispatcher');
      expect(mastra.listWorkflows()).not.toHaveProperty('__mastra_notification_dispatcher');
      // The dispatcher must not declare a schedule — its schedule row is
      // created lazily on the first deferred notification so idle apps never
      // start the scheduler (see #18864).
      expect(workflow.getScheduleConfigs()).toEqual([]);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('allows notification dispatch workflow registration to be disabled', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({
      id: 'notification-workflow-disabled-storage',
      domains: { notifications },
    });
    const mastra = new Mastra({
      storage,
      logger: false,
      notifications: { dispatch: { enabled: false } },
    });

    try {
      expect(() => (mastra as any).getWorkflow('__mastra_notification_dispatcher')).toThrow(
        'Workflow with ID __mastra_notification_dispatcher not found',
      );
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('builds the dispatcher schedule row from the dispatch config', () => {
    const schedule = buildNotificationDispatchSchedule({ cron: '*/5 * * * *', batchSize: 25 });

    expect(schedule).toMatchObject({
      id: NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID,
      cron: '*/5 * * * *',
      status: 'active',
      target: {
        type: 'workflow',
        workflowId: '__mastra_notification_dispatcher',
        inputData: { limit: 25 },
      },
      metadata: { internal: true, feature: 'notifications' },
    });
    expect(schedule.nextFireAt).toBeGreaterThan(Date.now());
    // Not `wf_`-prefixed: declarative orphan-cleanup must leave it alone.
    expect(schedule.id.startsWith('wf_')).toBe(false);
  });

  it('rejects invalid notification dispatch workflow times', () => {
    expect(() => parseNotificationDispatchNow('not-a-date')).toThrow('Invalid notification dispatch time: not-a-date');
  });

  it('creates an unscheduled notification dispatch workflow', () => {
    const workflow = createNotificationDispatchWorkflow({ batchSize: 25 });

    expect(workflow.id).toBe('__mastra_notification_dispatcher');
    expect((workflow as any).getScheduleConfigs()).toEqual([]);
  });
});
