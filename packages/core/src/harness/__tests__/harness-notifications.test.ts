import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryNotificationsStorage } from '../../notifications/storage';
import { InMemoryStore, MastraCompositeStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { Harness } from '../harness';

function createSubscription() {
  return {
    stream: [],
    activeRunId: vi.fn(() => null),
    abort: vi.fn(),
    unsubscribe: vi.fn(),
  };
}

function createAgentMock() {
  return {
    id: 'agent-1',
    getMastraInstance: vi.fn(() => undefined),
    subscribeToThread: vi.fn(async () => createSubscription()),
    sendNotificationSignal: vi.fn(async (_input, target) => ({
      accepted: true,
      record: { id: 'notification-1', threadId: target.threadId, source: 'mastracode' },
      decision: { action: 'deliver' },
    })),
  };
}

function createModel() {
  return new MastraLanguageModelV2Mock({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'finish', finishReason: 'stop', usage: {} });
          controller.close();
        },
      }),
    }),
  });
}

describe('Harness notification signals', () => {
  it('creates a thread and delegates notification signals with resource, thread, and idle stream options', async () => {
    const agent = createAgentMock();
    const harness = new Harness({
      id: 'harness-1',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });

    const result = await harness.sendNotificationSignal({
      source: 'mastracode',
      kind: 'manual',
      priority: 'high',
      summary: 'Check this notification',
    });

    const threadId = harness.getCurrentThreadId();
    expect(threadId).toBeTruthy();
    expect(result).toMatchObject({ accepted: true, record: { id: 'notification-1', threadId } });
    expect(agent.subscribeToThread).toHaveBeenCalledTimes(1);
    expect(agent.subscribeToThread).toHaveBeenCalledWith({ resourceId: 'resource-1', threadId });
    expect(agent.sendNotificationSignal).toHaveBeenCalledTimes(1);
    expect(agent.sendNotificationSignal).toHaveBeenCalledWith(
      {
        source: 'mastracode',
        kind: 'manual',
        priority: 'high',
        summary: 'Check this notification',
      },
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId,
        ifIdle: expect.objectContaining({
          streamOptions: expect.objectContaining({
            memory: { resource: 'resource-1', thread: threadId },
            maxSteps: 1000,
            savePerStep: false,
          }),
        }),
      }),
    );
  });

  it('dispatches due notifications after a subscribed turn completes', async () => {
    const agent = new Agent({
      id: 'agent-1',
      name: 'Notification Agent',
      instructions: 'You handle notifications.',
      model: createModel(),
    });
    const harness = new Harness({
      id: 'harness-2',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    const dispatchDueNotifications = vi.spyOn(harness, 'dispatchDueNotifications').mockResolvedValue(undefined);

    await harness.sendMessage({ content: 'hello' });

    expect(dispatchDueNotifications).toHaveBeenCalled();
    await harness.destroy();
  });

  it('dispatches due medium summaries through the current harness thread', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({
      id: 'notification-harness-storage',
      default: new InMemoryStore({ id: 'notification-harness-default-storage' }),
      domains: { notifications },
    });
    const agent = new Agent({
      id: 'agent-1',
      name: 'Notification Agent',
      instructions: 'You handle notifications.',
      model: createModel(),
    });
    const harness = new Harness({
      id: 'harness-2',
      resourceId: 'resource-1',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    await harness.init();
    const thread = await harness.createThread();
    const record = await notifications.createNotification({
      threadId: thread.id,
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'medium',
      summary: 'CI finished',
      summaryAt: new Date(0),
    });
    const sendSignal = vi.spyOn(harness, 'sendSignal').mockImplementation(signal => ({
      id: signal.id,
      type: signal.type,
      accepted: Promise.resolve({ accepted: true, runId: 'notification-run' }),
    }));

    const result = await harness.dispatchDueNotifications();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal.mock.calls[0]?.[0]).toMatchObject({ type: 'notification', tagName: 'notification-summary' });
    expect(result?.signals).toHaveLength(1);
    await expect(notifications.getNotification({ threadId: thread.id, id: record.id })).resolves.toMatchObject({
      status: 'delivered',
      summarySignalId: result?.signals[0]?.id,
    });

    await harness.destroy();
  });

  it('persists due low summaries for idle threads without waking the harness loop', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({
      id: 'low-notification-harness-storage',
      default: new InMemoryStore({ id: 'low-notification-harness-default-storage' }),
      domains: { notifications },
    });
    const agent = new Agent({
      id: 'agent-1',
      name: 'Notification Agent',
      instructions: 'You handle notifications.',
      model: createModel(),
    });
    const harness = new Harness({
      id: 'harness-3',
      resourceId: 'resource-1',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    await harness.init();
    const thread = await harness.createThread();
    const record = await notifications.createNotification({
      threadId: thread.id,
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'low',
      summary: 'CI finished',
      summaryAt: new Date(0),
    });
    const events: Array<{ type: string; message?: { content: unknown[] } }> = [];
    harness.subscribe(event => {
      if (event.type === 'message_update' || event.type === 'agent_start' || event.type === 'agent_end') {
        events.push(event as (typeof events)[number]);
      }
    });
    const currentAgentSendSignal = vi.spyOn(agent, 'sendSignal');

    const result = await harness.dispatchDueNotifications();

    expect(currentAgentSendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notification', tagName: 'notification-summary' }),
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId: thread.id,
        ifIdle: { behavior: 'persist' },
      }),
    );

    await vi.waitFor(() => {
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'message_update',
          message: expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'notification_summary', pending: 1, byPriority: { low: 1 } }),
            ]),
          }),
        }),
      );
    });
    expect(result?.signals).toHaveLength(1);
    await expect(notifications.getNotification({ threadId: thread.id, id: record.id })).resolves.toMatchObject({
      status: 'delivered',
      summarySignalId: result?.signals[0]?.id,
    });

    await harness.destroy();
  });
});
