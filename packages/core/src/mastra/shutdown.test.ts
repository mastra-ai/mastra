import EventEmitter from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { __hookHandlerCount, AvailableHooks } from '../hooks';
import { MockStore } from '../storage';
import { Mastra } from './index';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
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
