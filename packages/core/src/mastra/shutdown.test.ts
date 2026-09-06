import EventEmitter from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { globalRunRegistry } from '../agent/durable/run-registry';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSubDeliveryMode } from '../events/pubsub';
import { __hookHandlerCount, AvailableHooks } from '../hooks';
import { MockStore } from '../storage';
import { createStep, createWorkflow } from '../workflows/evented';
import { Mastra } from './index';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Push-only pubsub so startWorkers() wires handleWorkflowEvent directly. */
class PushOnlyPubSub extends EventEmitterPubSub {
  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['push'];
  }
}

/**
 * Two-step evented workflow whose first step blocks until `gate` resolves, so a
 * test can call shutdown() while a step is mid-execution.
 */
function makeGatedWorkflow(gate: Promise<void>, onStepStarted: () => void) {
  const wf = createWorkflow({
    id: 'gated-workflow',
    inputSchema: z.object({}),
    outputSchema: z.object({ done: z.boolean() }),
  });
  wf.then(
    createStep({
      id: 'slow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        onStepStarted();
        await gate;
        return {};
      },
    }) as any,
  )
    .then(
      createStep({
        id: 'finish',
        inputSchema: z.object({}),
        outputSchema: z.object({ done: z.boolean() }),
        execute: async () => ({ done: true }),
      }) as any,
    )
    .commit();
  return wf;
}

describe('Mastra shutdown lifecycle', () => {
  it('releases the process-global scorer hook', async () => {
    const baseline = __hookHandlerCount(AvailableHooks.ON_SCORER_RUN);
    const mastra = new Mastra({ logger: false, workers: false });

    expect(__hookHandlerCount(AvailableHooks.ON_SCORER_RUN)).toBe(baseline + 1);

    try {
      await mastra.shutdown();
      expect(__hookHandlerCount(AvailableHooks.ON_SCORER_RUN)).toBe(baseline);
    } finally {
      mastra.__unregisterHooks();
    }
  });

  it('unsubscribes its background-task manager', async () => {
    const emitter = new EventEmitter();
    const pubsub = new EventEmitterPubSub(emitter);
    const mastra = new Mastra({
      backgroundTasks: { enabled: true },
      logger: false,
      pubsub,
      storage: new MockStore(),
    });

    await vi.waitFor(() => {
      expect(emitter.listenerCount('background-tasks')).toBe(1);
      expect(emitter.listenerCount('background-tasks-result')).toBe(1);
    });

    try {
      await mastra.shutdown();
      expect(emitter.listenerCount('background-tasks')).toBe(0);
      expect(emitter.listenerCount('background-tasks-result')).toBe(0);
    } finally {
      await mastra.backgroundTaskManager?.shutdown();
      await pubsub.close();
      mastra.__unregisterHooks();
    }
  });

  it('aborts active background-task executors before resolving', async () => {
    const started = deferred<AbortSignal>();
    const release = deferred();
    const finished = deferred();
    const mastra = new Mastra({
      backgroundTasks: { enabled: true },
      logger: false,
      storage: new MockStore(),
    });

    await mastra.startWorkers();
    const manager = mastra.backgroundTaskManager!;
    await manager.enqueue(
      { toolName: 'slow-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
      {
        executor: {
          execute: async (_args, options) => {
            started.resolve(options!.abortSignal!);
            try {
              await release.promise;
              return 'done';
            } finally {
              finished.resolve();
            }
          },
        },
      },
    );

    const signal = await started.promise;
    try {
      await mastra.shutdown();
      expect(signal.aborted).toBe(true);
    } finally {
      release.resolve();
      await finished.promise;
      await manager.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('waits for its durable agent executions before stopping workers and closing storage', async () => {
    const execution = deferred();
    const storage = new MockStore();
    const close = vi.spyOn(storage, 'close');
    const mastra = new Mastra({ logger: false, workers: false, storage });
    const stopWorkers = vi.spyOn(mastra, 'stopWorkers');
    const otherMastra = new Mastra({ logger: false, workers: false });
    const otherExecution = deferred();

    globalRunRegistry.set('owned-run', { mastra, workflowExecution: execution.promise } as any);
    globalRunRegistry.set('other-run', { mastra: otherMastra, workflowExecution: otherExecution.promise } as any);

    try {
      const shutdown = mastra.shutdown();
      await vi.waitFor(() => expect(close).not.toHaveBeenCalled());
      // Pubsub must stay alive while durable runs drain (#22863).
      expect(stopWorkers).not.toHaveBeenCalled();

      execution.resolve();
      await shutdown;

      expect(stopWorkers).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      execution.resolve();
      otherExecution.resolve();
      globalRunRegistry.delete('owned-run');
      globalRunRegistry.delete('other-run');
      mastra.__unregisterHooks();
      otherMastra.__unregisterHooks();
    }
  });

  it('lets an in-flight evented workflow run finish before tearing down pubsub', async () => {
    const gate = deferred();
    const stepStarted = deferred();
    const storage = new MockStore();
    const close = vi.spyOn(storage, 'close');
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { gated: makeGatedWorkflow(gate.promise, () => stepStarted.resolve()) } as any,
    });

    try {
      await mastra.startWorkers();
      const run = await mastra.getWorkflow('gated').createRun();
      const result = run.start({ inputData: {} });
      await stepStarted.promise;

      const shutdown = mastra.shutdown();
      // Give shutdown a chance to (incorrectly) return early.
      await new Promise(r => setTimeout(r, 50));
      expect(close).not.toHaveBeenCalled();

      gate.resolve();
      await shutdown;

      // The run's remaining events were still delivered after shutdown began.
      await expect(result).resolves.toMatchObject({ status: 'success', result: { done: true } });
      expect(close).toHaveBeenCalledOnce();
    } finally {
      gate.resolve();
      mastra.__unregisterHooks();
    }
  });

  it('bounds the evented run drain with drainTimeout', async () => {
    const gate = deferred();
    const stepStarted = deferred();
    const storage = new MockStore();
    const close = vi.spyOn(storage, 'close');
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { gated: makeGatedWorkflow(gate.promise, () => stepStarted.resolve()) } as any,
    });

    try {
      await mastra.startWorkers();
      const run = await mastra.getWorkflow('gated').createRun();
      void run.start({ inputData: {} }).catch(() => {});
      await stepStarted.promise;

      const startedAt = Date.now();
      await mastra.shutdown({ drainTimeout: 100 });

      expect(Date.now() - startedAt).toBeLessThan(2_000);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      gate.resolve();
      mastra.__unregisterHooks();
    }
  });

  it('stopWorkers waits for an in-flight push-mode workflow event', async () => {
    const handling = deferred();
    const handled = deferred();
    const pubsub = new PushOnlyPubSub();
    const flush = vi.spyOn(pubsub, 'flush');
    const mastra = new Mastra({ logger: false, pubsub, storage: new MockStore(), workflows: {} as any });

    try {
      await mastra.startWorkers();
      vi.spyOn(mastra, 'handleWorkflowEvent').mockImplementation(async () => {
        handled.resolve();
        await handling.promise;
        return { ok: true };
      });
      await pubsub.publish('workflows', { type: 'workflow.start', runId: 'run-1', data: {} } as any);
      await handled.promise;

      let stopped = false;
      const stop = mastra.stopWorkers().then(() => {
        stopped = true;
      });
      await new Promise(r => setTimeout(r, 20));
      expect(stopped).toBe(false);
      expect(flush).not.toHaveBeenCalled();

      handling.resolve();
      await stop;
      expect(flush).toHaveBeenCalled();
    } finally {
      handling.resolve();
      await mastra.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('rejects an invalid drainTimeout', async () => {
    const mastra = new Mastra({ logger: false, workers: false });
    try {
      await expect(mastra.shutdown({ drainTimeout: -1 })).rejects.toThrow(RangeError);
      await expect(mastra.shutdown({ drainTimeout: Number.NaN })).rejects.toThrow(RangeError);
    } finally {
      await mastra.shutdown();
      mastra.__unregisterHooks();
    }
  });

  it('keeps an aborted retryable task recoverable on the next process', async () => {
    const started = deferred<AbortSignal>();
    const mastra = new Mastra({
      backgroundTasks: { enabled: true },
      logger: false,
      storage: new MockStore(),
    });

    await mastra.startWorkers();
    const manager = mastra.backgroundTaskManager!;
    const { task } = await manager.enqueue(
      {
        toolName: 'retryable-tool',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
        runId: 'run-1',
        maxRetries: 1,
      },
      {
        executor: {
          execute: async (_args, options) => {
            const signal = options!.abortSignal!;
            started.resolve(signal);
            return new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
          },
        },
      },
    );

    const signal = await started.promise;
    try {
      await mastra.shutdown();
      expect(signal.aborted).toBe(true);
      await vi.waitFor(async () => {
        expect(await manager.getTask(task.id)).toMatchObject({ status: 'running' });
      });
    } finally {
      await manager.shutdown();
      mastra.__unregisterHooks();
    }
  });
});
