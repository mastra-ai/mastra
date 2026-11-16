/**
 * Durable tool-call: the step subscribes to cross-process abort requests, and retries the
 * subscription when an earlier step in the run failed to subscribe.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackgroundTaskManager } from '../../../../background-tasks/manager';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { MastraTimeoutError } from '../../../../loop/timeout';
import { Mastra } from '../../../../mastra';
import { MockStore } from '../../../../storage';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { MessageList } from '../../../message-list';
import { ensureRemoteAbortListener, publishAbortRequest, RUN_DEADLINE_KEY } from '../../abort-transport';
import { globalRunRegistry } from '../../run-registry';
import type { RunRegistryEntry } from '../../types';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'run-tool-call-abort-listener';

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
});

describe('durable tool-call remote abort listener', () => {
  it('retries the subscription when an earlier step failed to subscribe', async () => {
    const pubsub = new EventEmitterPubSub();
    const started = Promise.withResolvers<void>();
    let toolSignal: AbortSignal | undefined;
    const entry = {
      tools: {
        wait: {
          id: 'wait',
          execute: async (_args: unknown, { abortSignal }: { abortSignal?: AbortSignal }) => {
            toolSignal = abortSignal;
            started.resolve();
            await new Promise<void>(resolve => {
              if (abortSignal?.aborted) return resolve();
              abortSignal?.addEventListener('abort', () => resolve(), { once: true });
              setTimeout(resolve, 2000);
            });
            return 'done';
          },
        },
      },
      model: {},
      saveQueueManager: {},
      outputProcessors: [],
      processorStates: new Map(),
    } as unknown as RunRegistryEntry;
    globalRunRegistry.set(RUN_ID, entry);

    // An earlier step's subscribe failed: the entry has a controller but no listener.
    const subscribe = pubsub.subscribe.bind(pubsub);
    const failing = vi.spyOn(pubsub, 'subscribe').mockRejectedValueOnce(new Error('pubsub down'));
    await expect(ensureRemoteAbortListener(pubsub, RUN_ID)).rejects.toThrow('pubsub down');
    expect(entry.abortSignal).toBeDefined();
    expect(entry.remoteAbortListenerInstalled).toBe(false);
    failing.mockImplementation(subscribe);

    try {
      const step = createDurableToolCallStep();
      const running = (step as any).execute({
        inputData: { toolCallId: 'call-wait', toolName: 'wait', args: {} },
        mastra: { getLogger: () => undefined, listTools: () => ({}) },
        suspend: vi.fn(),
        resumeData: undefined,
        requestContext: new Map(),
        getInitData: () => ({
          runId: RUN_ID,
          agentId: 'waiter',
          options: { requireToolApproval: false },
          state: { threadId: 'thread-1', resourceId: 'user-1', memoryConfig: undefined, threadExists: false },
        }),
        [PUBSUB_SYMBOL]: pubsub,
      });
      await started.promise;
      await publishAbortRequest(pubsub, RUN_ID);
      await vi.waitFor(() => expect(toolSignal?.aborted).toBe(true), { timeout: 1000 });
      await running.catch(() => {});
    } finally {
      await pubsub.close();
    }
  });

  it('marks a call whose toModelOutput throws after the deadline stopped it', async () => {
    const controller = new AbortController();
    const entry = {
      tools: {
        wait: {
          id: 'wait',
          execute: async (_args: unknown, { abortSignal }: { abortSignal?: AbortSignal }) => {
            // The deadline lands while the tool is still running; it resolves anyway.
            controller.abort(new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 100 }));
            expect(abortSignal?.aborted).toBe(true);
            return 'done';
          },
          toModelOutput: () => {
            throw new Error('tool output mapping failed');
          },
        },
      },
      model: {},
      saveQueueManager: {},
      outputProcessors: [],
      processorStates: new Map(),
      abortController: controller,
      abortSignal: controller.signal,
    } as unknown as RunRegistryEntry;
    globalRunRegistry.set(RUN_ID, entry);

    const step = createDurableToolCallStep();
    const output = await (step as any).execute({
      inputData: { toolCallId: 'call-wait', toolName: 'wait', args: {} },
      mastra: { getLogger: () => undefined, listTools: () => ({}) },
      suspend: vi.fn(),
      resumeData: undefined,
      requestContext: new Map(),
      getInitData: () => ({
        runId: RUN_ID,
        agentId: 'waiter',
        options: { requireToolApproval: false },
        state: { threadId: 'thread-1', resourceId: 'user-1', memoryConfig: undefined, threadExists: false },
      }),
    });

    expect(output.mappingError?.message).toBe('tool output mapping failed');
    expect(output.deadlineTimeout).toEqual({ timeoutType: 'total', timeoutMs: 100 });
  });

  describe.each(['foreground', 'background'])('%s dispatch after a run stops', mode => {
    it.each(['deadline', 'abort', 'running', 'deadline-during', 'abort-during', 'failure'])(
      'preserves tool outcomes before and during execution (%s)',
      async stop => {
        const pubsub = new EventEmitterPubSub();
        const mastra = new Mastra({ logger: false, storage: new MockStore() });
        const manager = new BackgroundTaskManager({ enabled: true });
        await mastra.startWorkers();
        manager.__registerMastra(mastra);
        await manager.init(pubsub);
        const controller = new AbortController();
        if (stop === 'abort') controller.abort(new Error('Aborted'));
        const execute = vi.fn(async () => {
          if (stop === 'failure') throw new Error('background execution failed');
          if (stop === 'deadline-during') {
            controller.abort(new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 100 }));
          } else if (stop === 'abort-during') {
            controller.abort(new Error('Aborted'));
          }
          return 'done';
        });
        const entry = {
          tools: {
            wait: {
              id: 'wait',
              execute,
              backgroundConfig: { enabled: mode === 'background', defaultDisposition: 'awaited' },
            },
          },
          model: {},
          outputProcessors: [],
          processorStates: new Map(),
          messageList: new MessageList({ threadId: 'thread-1', resourceId: 'user-1' }),
          abortController: controller,
          abortSignal: controller.signal,
          backgroundTaskManager: manager,
        } as unknown as RunRegistryEntry;
        globalRunRegistry.set(RUN_ID, entry);
        // Exercise the carried-deadline boundary, not a manually pre-aborted timeout signal.
        const requestContext = new Map([
          [RUN_DEADLINE_KEY, { at: Date.now() + (stop === 'deadline' ? -5000 : 60000), timeoutMs: 100 }],
        ]);
        try {
          const output = await (createDurableToolCallStep() as any)
            .execute({
              inputData: { toolCallId: 'call-wait', toolName: 'wait', args: {} },
              mastra,
              suspend: vi.fn(),
              requestContext,
              getInitData: () => ({
                runId: RUN_ID,
                agentId: 'waiter',
                options: { requireToolApproval: false },
                state: { threadId: 'thread-1', resourceId: 'user-1', threadExists: false },
              }),
              [PUBSUB_SYMBOL]: pubsub,
            })
            .catch((error: unknown) => error);
          const { tasks } = await manager.listTasks({});
          if (stop === 'running') {
            expect(output).not.toBeInstanceOf(Error);
            expect(output.result).toBe('done');
            expect(output.aborted).not.toBe(true);
            expect(output.deadlineTimeout).toBeUndefined();
            expect(execute).toHaveBeenCalledTimes(1);
            if (mode === 'background') {
              expect(tasks).toHaveLength(1);
              expect(tasks[0]?.status).toBe('completed');
            } else {
              expect(tasks).toHaveLength(0);
            }
          } else if (stop === 'failure') {
            expect(execute).toHaveBeenCalledTimes(1);
            if (mode === 'background') {
              expect(output).toBeInstanceOf(Error);
              expect(output.message).toBe('background execution failed');
            } else {
              expect(output.error?.message).toContain('background execution failed');
            }
          } else {
            const started = stop.endsWith('-during');
            expect(execute).toHaveBeenCalledTimes(started ? 1 : 0);
            expect(tasks).toHaveLength(started && mode === 'background' ? 1 : 0);
            expect(output).not.toBeInstanceOf(Error);
            if (!started || mode === 'background') expect(output.aborted).toBe(true);
            if (stop.startsWith('deadline')) {
              expect(output.deadlineTimeout).toEqual({ timeoutType: 'total', timeoutMs: 100 });
            } else {
              expect(output.runAborted).toBe(true);
            }
          }
        } finally {
          globalRunRegistry.delete(RUN_ID);
          await manager.shutdown();
          await pubsub.close();
          await mastra.stopWorkers();
        }
      },
    );
  });
});
