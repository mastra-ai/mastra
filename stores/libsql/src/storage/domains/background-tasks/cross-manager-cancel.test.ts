/**
 * Two background-task managers sharing one LibSQL file, each with its own
 * Mastra, storage client and pubsub — the in-process stand-in for two worker
 * processes. Cancelling on one manager must stop the executor running on the
 * other, even though the `task.cancel` event cannot reach it.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BackgroundTaskManager } from '@mastra/core/background-tasks';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../index';

const RESULT_TOPIC = 'background-tasks-result';

async function makeWorker(dbUrl: string, name: string) {
  const storage = new LibSQLStore({ id: `bg-cancel-${name}`, url: dbUrl });
  const mastra = new Mastra({ logger: false, storage });
  await mastra.startWorkers();
  const pubsub = new EventEmitterPubSub();
  const onTaskComplete = vi.fn();
  const onTaskFailed = vi.fn();
  const manager = new BackgroundTaskManager({
    enabled: true,
    globalConcurrency: 1,
    perAgentConcurrency: 1,
    leaseDurationMs: 3_000,
    recoverStaleTasksOnStart: false,
    onTaskComplete,
    onTaskFailed,
  });
  manager.__registerMastra(mastra);
  await manager.init(pubsub);
  return {
    manager,
    pubsub,
    onTaskComplete,
    onTaskFailed,
    async close() {
      await manager.shutdown();
      await pubsub.close();
      await mastra.stopWorkers();
    },
  };
}

describe('BackgroundTaskManager cancel across managers sharing LibSQL', () => {
  let tempDir: string | undefined;
  const workers: Array<Awaited<ReturnType<typeof makeWorker>>> = [];

  afterEach(async () => {
    await Promise.allSettled(workers.splice(0).map(worker => worker.close()));
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('aborts the running executor on the owning manager and keeps the row cancelled', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-bg-cancel-'));
    const dbUrl = `file:${join(tempDir, 'tasks.db')}`;
    const workerA = await makeWorker(dbUrl, 'a');
    workers.push(workerA);
    const workerB = await makeWorker(dbUrl, 'b');
    workers.push(workerB);

    const published: string[] = [];
    await workerA.pubsub.subscribe(RESULT_TOPIC, (event: { type: string }) => {
      published.push(event.type);
    });

    let executorSignal: AbortSignal | undefined;
    const journal: string[] = [];
    const onResult = vi.fn();
    const onComplete = vi.fn();
    const onFailed = vi.fn();

    const { task } = await workerA.manager.enqueue(
      { toolName: 'slow-tool', toolCallId: 'call-1', args: {}, agentId: 'agent-1', runId: 'run-1' },
      {
        executor: {
          execute: async (_args, opts) => {
            executorSignal = opts?.abortSignal;
            journal.push('start');
            await new Promise<void>((resolve, reject) => {
              const done = setTimeout(resolve, 8_000);
              opts?.abortSignal?.addEventListener('abort', () => {
                clearTimeout(done);
                reject(opts.abortSignal!.reason);
              });
            });
            journal.push('done');
            return 'finished';
          },
        },
        onResult,
        onComplete,
        onFailed,
      },
    );

    await vi.waitFor(async () => expect((await workerA.manager.getTask(task.id))?.status).toBe('running'));
    await vi.waitFor(() => expect(executorSignal).toBeDefined());

    await workerB.manager.cancel(task.id);
    const cancelled = await workerB.manager.getTask(task.id);
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.ownerId).toBeUndefined();

    // A's next lease renewal (1s with a 3s lease) finds the row cancelled.
    await vi.waitFor(() => expect(executorSignal!.aborted).toBe(true), { timeout: 5_000, interval: 50 });
    expect((executorSignal!.reason as Error).message).toBe('Task cancelled');

    // Let A's workflow settle the aborted attempt.
    await new Promise(resolve => setTimeout(resolve, 300));

    const after = await workerA.manager.getTask(task.id);
    expect(after?.status).toBe('cancelled');
    expect(after?.result).toBeUndefined();
    expect(after?.completedAt?.getTime()).toBe(cancelled!.completedAt!.getTime());
    expect(journal).toEqual(['start']);
    expect(published).toContain('task.running');
    expect(published).not.toContain('task.completed');
    expect(published).not.toContain('task.failed');
    expect(onResult).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
    expect(workerA.onTaskComplete).not.toHaveBeenCalled();
    expect(workerA.onTaskFailed).not.toHaveBeenCalled();
  }, 20_000);
});
