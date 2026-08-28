import type { Inngest } from 'inngest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { subscribeMock } = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
}));

vi.mock('inngest/realtime', () => ({
  subscribe: subscribeMock,
}));

import { InngestPubSub } from './pubsub';

describe('InngestPubSub', () => {
  beforeEach(() => {
    subscribeMock.mockReset();
  });

  it('round-trips agent.control events through the agent-control realtime topic', async () => {
    let onMessage: ((message: { data: unknown }) => void) | undefined;
    subscribeMock.mockImplementation(async options => {
      onMessage = options.onMessage;
      return { close: vi.fn() };
    });

    const realtimePublish = vi.fn(async (_ref: unknown, data: unknown) => {
      onMessage?.({ data });
    });
    const inngest = {
      realtime: { publish: realtimePublish },
    } as unknown as Inngest;

    const pubsub = new InngestPubSub(inngest, 'workflow-id');
    const runId = 'run-control';
    const event = {
      type: 'abort-request',
      runId,
      data: {},
    };
    const received: Array<{ type?: string; runId?: string; data?: unknown }> = [];

    await pubsub.subscribe(`agent.control.${runId}`, receivedEvent => {
      received.push(receivedEvent);
    });
    await pubsub.publish(`agent.control.${runId}`, event);

    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: `agent:${runId}`,
        topics: ['agent-control'],
        app: inngest,
      }),
    );
    expect(realtimePublish).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: `agent:${runId}`,
        topic: 'agent-control',
      }),
      event,
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject(event);
  });

  it('keeps agent.stream events on the agent-stream realtime topic', async () => {
    const realtimePublish = vi.fn(async () => undefined);
    const inngest = {
      realtime: { publish: realtimePublish },
    } as unknown as Inngest;

    const pubsub = new InngestPubSub(inngest, 'workflow-id');
    const runId = 'run-stream';
    const event = {
      type: 'chunk',
      runId,
      data: { text: 'hello' },
    };

    await pubsub.publish(`agent.stream.${runId}`, event);

    expect(realtimePublish).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: `agent:${runId}`,
        topic: 'agent-stream',
      }),
      event,
    );
  });

  it('keeps workflow events on the watch realtime topic with their existing data payload', async () => {
    const realtimePublish = vi.fn(async () => undefined);
    const inngest = {
      realtime: { publish: realtimePublish },
    } as unknown as Inngest;

    const pubsub = new InngestPubSub(inngest, 'workflow-id');
    const runId = 'run-workflow';
    const data = { status: 'finished' };

    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'finish',
      runId,
      data,
    });

    expect(realtimePublish).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: `workflow:workflow-id:${runId}`,
        topic: 'watch',
      }),
      data,
    );
  });

  it('surfaces agent.control publish failures to the caller', async () => {
    const failure = new Error('realtime publish failed');
    const inngest = {
      realtime: {
        publish: vi.fn(async () => {
          throw failure;
        }),
      },
    } as unknown as Inngest;

    const pubsub = new InngestPubSub(inngest, 'workflow-id');

    await expect(
      pubsub.publish('agent.control.run-failure', {
        type: 'abort-request',
        runId: 'run-failure',
        data: {},
      }),
    ).rejects.toBe(failure);
  });
});
