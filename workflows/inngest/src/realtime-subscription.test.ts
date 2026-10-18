import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { InngestRun } from './run';

const subscribeMock = vi.fn();

describe('Inngest realtime subscriptions', () => {
  beforeEach(() => {
    vi.resetModules();
    subscribeMock.mockReset();
    vi.doMock('inngest/realtime', () => ({
      subscribe: subscribeMock,
    }));
  });

  afterEach(() => {
    vi.doUnmock('inngest/realtime');
    vi.resetModules();
  });

  it('uses callback-only subscriptions and closes after the final PubSub callback unsubscribes', async () => {
    const { InngestPubSub } = await import('./pubsub');
    const close = vi.fn();
    subscribeMock.mockResolvedValue({ close });
    const pubsub = new InngestPubSub(new Inngest({ id: 'pubsub-subscription-test' }), 'workflow-id');
    const first = vi.fn();
    const second = vi.fn();

    await pubsub.subscribe('agent.stream.run-id', first);
    await pubsub.subscribe('agent.stream.run-id', second);

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'agent:run-id',
        topics: ['agent-stream'],
        onMessage: expect.any(Function),
      }),
    );

    await pubsub.unsubscribe('agent.stream.run-id', first);
    expect(close).not.toHaveBeenCalled();

    await pubsub.unsubscribe('agent.stream.run-id', second);
    expect(close).toHaveBeenCalledTimes(1);
  });

  describe('agent control routing', () => {
    it('subscribes agent.control topics on the agent-control realtime topic of the run channel', async () => {
      const { InngestPubSub } = await import('./pubsub');
      subscribeMock.mockResolvedValue({ close: vi.fn() });
      const pubsub = new InngestPubSub(new Inngest({ id: 'control-subscribe-test' }), 'workflow-id');

      await pubsub.subscribe('agent.control.run-1', vi.fn());

      expect(subscribeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'agent:run-1',
          topics: ['agent-control'],
          onMessage: expect.any(Function),
        }),
      );
    });

    it('delivers abort-request events to control subscribers with generated id/createdAt', async () => {
      const { InngestPubSub } = await import('./pubsub');
      subscribeMock.mockResolvedValue({ close: vi.fn() });
      const pubsub = new InngestPubSub(new Inngest({ id: 'control-delivery-test' }), 'workflow-id');
      const received: any[] = [];

      await pubsub.subscribe('agent.control.run-1', event => received.push(event));

      const { onMessage } = subscribeMock.mock.calls[0][0];
      onMessage({ data: { type: 'abort-request', runId: 'run-1', data: {} } });

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ type: 'abort-request', runId: 'run-1', data: {} });
      expect(received[0].id).toEqual(expect.any(String));
      expect(received[0].createdAt).toEqual(expect.any(Date));
    });

    it('publishes agent.control events with the full envelope on the agent-control topic', async () => {
      const { InngestPubSub } = await import('./pubsub');
      const realtimePublish = vi.fn(async () => undefined);
      const inngest = { realtime: { publish: realtimePublish } } as unknown as Inngest;
      const pubsub = new InngestPubSub(inngest, 'workflow-id');
      const event = { type: 'abort-request', runId: 'run-1', data: {} };

      await pubsub.publish('agent.control.run-1', event);

      expect(realtimePublish).toHaveBeenCalledTimes(1);
      expect(realtimePublish).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'agent:run-1', topic: 'agent-control' }),
        event,
      );
    });

    it('keeps agent.stream events on the agent-stream topic, isolated from agent-control', async () => {
      const { InngestPubSub } = await import('./pubsub');
      const realtimePublish = vi.fn(async () => undefined);
      const inngest = { realtime: { publish: realtimePublish } } as unknown as Inngest;
      const pubsub = new InngestPubSub(inngest, 'workflow-id');
      const event = { type: 'chunk', runId: 'run-1', data: { text: 'hello' } };

      await pubsub.publish('agent.stream.run-1', event);

      expect(realtimePublish).toHaveBeenCalledTimes(1);
      expect(realtimePublish).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'agent:run-1', topic: 'agent-stream' }),
        event,
      );
    });

    it('surfaces agent.control publish failures to the caller', async () => {
      const { InngestPubSub } = await import('./pubsub');
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
        pubsub.publish('agent.control.run-1', { type: 'abort-request', runId: 'run-1', data: {} }),
      ).rejects.toBe(failure);
    });
  });

  it('closes a pending run-output subscription after polling wins', async () => {
    const { init } = await import('./index');
    let resolveSubscription!: (subscription: { close: () => void }) => void;
    subscribeMock.mockReturnValue(
      new Promise(resolve => {
        resolveSubscription = resolve;
      }),
    );

    const inngest = new Inngest({ id: 'run-output-subscription-test' });
    const { createWorkflow, createStep } = init(inngest);
    const step = createStep({
      id: 'step',
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      execute: async () => ({ done: true }),
    });
    const workflow = createWorkflow({
      id: 'run-output-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      steps: [step],
    })
      .then(step)
      .commit();
    const mastra = new Mastra({
      storage: new MockStore(),
      workflows: { 'run-output-workflow': workflow as any },
    });
    const run = (await workflow.createRun({ runId: 'run-output-run' })) as unknown as InngestRun;
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId: run.runId,
      snapshot: {
        runId: run.runId,
        status: 'success',
        result: { done: true },
        context: { input: {} } as any,
        value: {},
        activePaths: [],
        suspendedPaths: {},
        activeStepsPath: {},
        resumeLabels: {},
        waitingPaths: {},
        serializedStepGraph: run.serializedStepGraph,
        timestamp: Date.now(),
      },
    });

    await expect(run.getRunOutput('event-id')).resolves.toMatchObject({
      output: { result: { status: 'success', result: { done: true } } },
    });
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: `workflow:${workflow.id}:${run.runId}`,
        topics: ['watch'],
        onMessage: expect.any(Function),
      }),
    );

    const close = vi.fn();
    resolveSubscription({ close });
    await new Promise(resolve => setImmediate(resolve));

    expect(close).toHaveBeenCalledTimes(1);
  });
});
