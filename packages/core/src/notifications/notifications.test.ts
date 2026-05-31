import { describe, expect, it, vi } from 'vitest';
import { InMemoryNotificationsStorage } from './storage';
import {
  createNotificationInboxTool,
  createNotificationDispatchWorkflow,
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
      attributes: { source: 'github', type: 'ci-status', priority: 'high' },
    });

    const summarySignal = createNotificationSummarySignal(summarizeNotifications([github, slack]));
    expect(summarySignal).toMatchObject({
      type: 'notification',
      tagName: 'notification-summary',
      attributes: { pending: 2 },
    });
    expect(summarySignal.metadata?.notificationSummary).toMatchObject({
      notificationIds: ['n1', 'n2'],
      bySource: { github: 1, slack: 1 },
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
    });
    const tool = createNotificationInboxTool({ storage });

    await expect(tool.execute?.({ action: 'list' }, { agent: { threadId: 'thread-1' } } as any)).resolves.toMatchObject(
      {
        notifications: [{ id: 'n1', status: 'pending' }],
      },
    );
    await expect(
      tool.execute?.({ action: 'search', query: 'launch' }, { agent: { threadId: 'thread-1' } } as any),
    ).resolves.toMatchObject({ notifications: [{ id: 'n1' }] });
    await expect(
      tool.execute?.({ action: 'read', id: 'n1' }, { agent: { threadId: 'thread-1' } } as any),
    ).resolves.toMatchObject({
      notification: { id: 'n1', status: 'seen' },
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
    ).resolves.toMatchObject({ action: 'defer', deliverAt: now, reason: 'active-batch-full' });
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
    ).resolves.toMatchObject({ action: 'persist', reason: 'low-priority-inbox' });
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
      return { accepted: true, runId: 'run-1', signal };
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
        signal: { type: 'notification', tagName: 'notification', contents: 'CI failed' },
        target: { resourceId: 'resource-1', threadId: 'thread-1' },
      },
    ]);
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'delivered',
      deliveredSignalId: result.signals[0]?.id,
    });
  });

  it('groups due summary notifications by agent, resource, and thread', async () => {
    const storage = new InMemoryNotificationsStorage();
    const now = new Date('2026-05-30T12:00:00Z');
    const sendSignal = vi.fn((signal, _target) => ({ accepted: true, runId: 'run-1', signal }));
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
    expect(result.delivered).toHaveLength(2);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(sendSignal).toHaveBeenCalledTimes(1);
    await expect(storage.getNotification({ threadId: 'thread-1', id: 'n1' })).resolves.toMatchObject({
      status: 'delivered',
      summarySignalId: result.signals[0]?.id,
    });
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

  it('creates a scheduled notification dispatch workflow', () => {
    const workflow = createNotificationDispatchWorkflow({ cron: '*/5 * * * *', batchSize: 25 });

    expect(workflow.id).toBe('__mastra_notification_dispatcher');
    expect((workflow as any).getScheduleConfigs()).toMatchObject([
      {
        id: 'dispatch',
        cron: '*/5 * * * *',
        inputData: { limit: 25 },
      },
    ]);
  });
});
