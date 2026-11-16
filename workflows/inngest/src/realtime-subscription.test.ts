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
      // vi.fn() attaches handlers to returned promises to track settled results, which would
      // hide unhandled rejections from the code under test. Hand back an untracked promise.
      subscribe: (...args: unknown[]) => {
        const result = subscribeMock(...args);
        return result instanceof Promise ? new Promise((resolve, reject) => result.then(resolve, reject)) : result;
      },
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

  describe('InngestRun.watch', () => {
    const flush = async () => {
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
    };

    const createWatchRun = async ({ withMastra }: { withMastra: boolean }) => {
      const { init } = await import('./index');
      const inngest = new Inngest({ id: 'watch-subscription-test' });
      const { createWorkflow, createStep } = init(inngest);
      const step = createStep({
        id: 'noop',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      });
      const workflow = createWorkflow({
        id: 'watch-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step],
      })
        .then(step)
        .commit();
      const mastra = withMastra
        ? new Mastra({ storage: new MockStore(), workflows: { 'watch-workflow': workflow as any } })
        : undefined;
      const run = (await workflow.createRun({ runId: 'watch-run' })) as unknown as InngestRun;
      return { run, mastra, workflow };
    };

    let unhandled: unknown[];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };

    beforeEach(() => {
      unhandled = [];
      process.on('unhandledRejection', onUnhandled);
    });

    afterEach(() => {
      process.off('unhandledRejection', onUnhandled);
      vi.restoreAllMocks();
    });

    it.each([
      ['a failed subscription-token request', new TypeError('fetch failed')],
      ['a raw WebSocket error event', { type: 'error', message: 'socket hang up' }],
    ])('handles %s without an unhandled rejection', async (_label, reason) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      subscribeMock.mockRejectedValue(reason);
      const { run } = await createWatchRun({ withMastra: false });
      const cb = vi.fn();

      const unwatch = run.watch(cb);
      await flush();

      expect(unhandled).toEqual([]);
      expect(cb).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Inngest realtime watch subscription failed'), reason);

      expect(() => unwatch()).not.toThrow();
      await flush();
      expect(unhandled).toEqual([]);
    });

    it('logs a failed subscription through the Mastra logger when available', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = new TypeError('fetch failed');
      subscribeMock.mockRejectedValue(error);
      const { run, mastra } = await createWatchRun({ withMastra: true });
      const loggerWarn = vi.spyOn(mastra!.getLogger(), 'warn').mockImplementation(() => {});

      run.watch(vi.fn());
      await flush();

      expect(unhandled).toEqual([]);
      expect(loggerWarn).toHaveBeenCalledTimes(1);
      expect(loggerWarn).toHaveBeenCalledWith(expect.stringContaining('Inngest realtime watch subscription failed'), {
        error,
      });
      expect(consoleWarn).not.toHaveBeenCalled();
    });

    it('closes a subscription that resolves after unwatch', async () => {
      let resolveSubscription!: (subscription: { close: () => void; unsubscribe: () => void }) => void;
      subscribeMock.mockReturnValue(
        new Promise(resolve => {
          resolveSubscription = resolve;
        }),
      );
      const { run, workflow } = await createWatchRun({ withMastra: false });

      const unwatch = run.watch(vi.fn());
      expect(subscribeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: `workflow:${workflow.id}:${run.runId}`,
          topics: ['watch'],
          onMessage: expect.any(Function),
        }),
      );

      unwatch();
      const close = vi.fn();
      resolveSubscription({ close, unsubscribe: vi.fn() });
      await flush();

      expect(close).toHaveBeenCalledTimes(1);
    });

    it('closes an already-open subscription on unwatch and drops later messages', async () => {
      const close = vi.fn();
      subscribeMock.mockResolvedValue({ close, unsubscribe: vi.fn() });
      const { run } = await createWatchRun({ withMastra: false });
      const cb = vi.fn();

      const unwatch = run.watch(cb);
      await flush();
      const { onMessage } = subscribeMock.mock.calls[0][0];

      onMessage({ data: { type: 'workflow-step-start', payload: { id: 'noop' } } });
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith({ type: 'workflow-step-start', payload: { id: 'noop' } });

      unwatch();
      await flush();
      expect(close).toHaveBeenCalledTimes(1);

      onMessage({ data: { type: 'workflow-step-result', payload: { id: 'noop' } } });
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
