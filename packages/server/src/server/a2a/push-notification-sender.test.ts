import type { Task } from '@mastra/core/a2a';
import { describe, expect, it, vi } from 'vitest';
import { DefaultPushNotificationSender } from './push-notification-sender';
import { InMemoryPushNotificationStore } from './push-notification-store';

const task: Task = {
  id: 'task-1',
  contextId: 'context-1',
  kind: 'task',
  status: {
    state: 'completed',
    timestamp: '2025-05-08T11:47:38.458Z',
    message: undefined,
  },
  artifacts: [],
  metadata: undefined,
};

describe('DefaultPushNotificationSender', () => {
  it('rejects loopback notification targets before fetch', async () => {
    const store = new InMemoryPushNotificationStore();
    const fetchMock = vi.fn();
    const sender = new DefaultPushNotificationSender(store, {
      fetch: fetchMock,
    });

    store.set({
      agentId: 'test-agent',
      config: {
        taskId: task.id,
        pushNotificationConfig: {
          url: 'http://localhost:9999/webhook',
        },
      },
    });

    const logger = { error: vi.fn() } as any;
    await sender.sendNotifications({
      agentId: 'test-agent',
      task,
      logger,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Failed to deliver A2A push notification', expect.any(Error));
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    const store = new InMemoryPushNotificationStore();
    const fetchMock = vi.fn();
    const sender = new DefaultPushNotificationSender(store, {
      fetch: fetchMock,
      lookup: vi.fn().mockResolvedValue([{ address: '10.0.0.5', family: 4 }]),
    });

    store.set({
      agentId: 'test-agent',
      config: {
        taskId: task.id,
        pushNotificationConfig: {
          url: 'https://example.com/webhook',
        },
      },
    });

    const logger = { error: vi.fn() } as any;
    await sender.sendNotifications({
      agentId: 'test-agent',
      task,
      logger,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Failed to deliver A2A push notification', expect.any(Error));
  });
});
