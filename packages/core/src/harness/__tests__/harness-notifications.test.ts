import { describe, expect, it, vi } from 'vitest';
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
      record: { id: 'notification-1', threadId: target.threadId, source: 'mastracode' },
      decision: { action: 'deliver' },
    })),
  };
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

    const threadId = harness.session.thread.getId();
    expect(threadId).toBeTruthy();
    expect(result).toMatchObject({ decision: { action: 'deliver' }, record: { id: 'notification-1', threadId } });
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
});
