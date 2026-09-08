import type { BackgroundTaskManager } from '../../../background-tasks';
import { ChunkFrom } from '../../../stream/types';

const PROGRESS_INTERVAL_MS = 3000;

export type BackgroundTaskCheckOutcome =
  /** No manager, or no running tasks — pass through unchanged. */
  | { status: 'pass-through' }
  /** Tasks are running but this site doesn't wait — flag pending only. */
  | { status: 'pending' }
  /** Waited, but no task completed in time — pass through so the loop can end. */
  | { status: 'timeout' }
  /** A task completed — flag pending and force continuation so the LLM sees it. */
  | { status: 'completed' };

/**
 * Shared background-task-check behavior (PHASE3 Step 3): after the LLM has
 * responded, look for still-running background tasks and decide whether to
 * wait for the next completion, signal pending without blocking, or pass
 * through. Progress chunks are emitted while waiting; result injection is
 * handled by per-task hooks registered at dispatch time.
 *
 * The wait gate is engine-owned via `resolveWaitMs` (deliberate divergence,
 * not drift): the main loop never waits without an explicit timeout because
 * background results reach its live stream controller even after the run
 * ends; the durable loop must always wait (1s default) because its pubsub
 * subscription is torn down when the workflow finishes, so returning early
 * would drop the task's result chunks. Returning `undefined` means "signal
 * pending, don't block"; a number is the wait timeout in ms.
 *
 * Emission is best-effort: transport failures (closed controller/pubsub) are
 * swallowed and never affect the wait outcome.
 */
export async function checkBackgroundTasks(deps: {
  bgManager: Pick<BackgroundTaskManager, 'listTasks' | 'waitForNextTask'> | undefined;
  runId: string;
  agentId?: string;
  threadId?: string;
  resourceId?: string;
  /** Outer caller (e.g. `streamUntilIdle`) drives continuation — never wait in-loop. */
  skipWait?: boolean;
  retryCount: number;
  resolveWaitMs: (retryCount: number) => number | undefined;
  emitChunk: (chunk: unknown) => void | Promise<void>;
}): Promise<BackgroundTaskCheckOutcome> {
  const { bgManager } = deps;
  if (!bgManager) {
    return { status: 'pass-through' };
  }

  const runningResult = await bgManager.listTasks({
    agentId: deps.agentId,
    status: 'running',
    threadId: deps.threadId,
    resourceId: deps.resourceId,
  });
  const runningTasks = runningResult?.tasks;
  if (!runningTasks || runningTasks.length === 0) {
    return { status: 'pass-through' };
  }

  if (deps.skipWait) {
    return { status: 'pending' };
  }

  const waitTimeoutMs = deps.resolveWaitMs(deps.retryCount);
  if (waitTimeoutMs === undefined) {
    return { status: 'pending' };
  }

  const taskIds = runningTasks.map(task => task.id);
  const emitProgress = (elapsedMs: number) => {
    try {
      void Promise.resolve(
        deps.emitChunk({
          type: 'background-task-progress',
          runId: deps.runId,
          from: ChunkFrom.AGENT,
          payload: { taskIds, runningCount: runningTasks.length, elapsedMs },
        }),
      ).catch(() => {});
    } catch {
      // Transport may be closed — ignore
    }
  };

  emitProgress(0);

  try {
    await bgManager.waitForNextTask(taskIds, {
      timeoutMs: waitTimeoutMs,
      onProgress: emitProgress,
      progressIntervalMs: PROGRESS_INTERVAL_MS,
    });
  } catch {
    // Timeout elapsed — no task completed within waitTimeoutMs. The tasks
    // keep running; results are picked up on the next user message or stream.
    return { status: 'timeout' };
  }

  return { status: 'completed' };
}
