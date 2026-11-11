/**
 * Durable tool-call: the step subscribes to cross-process abort requests, and retries the
 * subscription when an earlier step in the run failed to subscribe.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { MastraTimeoutError } from '../../../../loop/timeout';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { ensureRemoteAbortListener, publishAbortRequest } from '../../abort-transport';
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
});
