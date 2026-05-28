import { describe, expect, it } from 'vitest';
import { InMemoryNotificationsStorage } from './storage';
import {
  createNotificationInboxTool,
  createNotificationSignal,
  createNotificationSummarySignal,
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
});
