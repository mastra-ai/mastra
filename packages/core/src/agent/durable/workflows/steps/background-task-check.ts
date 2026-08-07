import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { ChunkFrom } from '../../../../stream/types';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { DurableStepIds } from '../../constants';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';

const BG_CHECK_STEP_ID = `${DurableStepIds.AGENTIC_EXECUTION}-bg-task-check`;

/**
 * The background task check step accepts the output of llmMappingStep
 * and passes it through, adding backgroundTaskPending if tasks are running.
 */
const bgCheckInputSchema = z.any();
const bgCheckOutputSchema = z.any();

/**
 * Create a durable background task check step.
 *
 * Mirrors the regular agent's backgroundTaskCheckStep pattern:
 * - After tool calls complete, checks if any background tasks are still running
 * - If no running tasks: passes through unchanged
 * - If an explicit waitTimeoutMs is configured and retryCount === 0: returns
 *   immediately with backgroundTaskPending=true (caller drives continuation)
 * - Otherwise: waits for the next task to complete using the configured
 *   waitTimeoutMs or a 1 s default — this keeps the workflow (and its pubsub
 *   subscription) alive so background-task tool-result chunks are delivered
 * - When a task completes: sets isContinued=true so the LLM processes the result
 */
export function createDurableBackgroundTaskCheckStep() {
  return createStep({
    id: BG_CHECK_STEP_ID,
    inputSchema: bgCheckInputSchema,
    outputSchema: bgCheckOutputSchema,
    execute: async params => {
      const { inputData, getInitData, retryCount } = params;
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
      const typedInput = inputData as Record<string, any>;

      const initData = getInitData<{
        runId: string;
        agentId: string;
        options?: { skipBgTaskWait?: boolean };
        state?: { threadId?: string; resourceId?: string };
      }>();
      const { runId, agentId } = initData;

      const registryEntry = globalRunRegistry.get(runId);
      const bgManager = registryEntry?.backgroundTaskManager;

      if (!bgManager) {
        return typedInput;
      }

      const runningResult = await bgManager.listTasks({
        agentId,
        status: 'running',
        threadId: initData.state?.threadId,
        resourceId: initData.state?.resourceId,
      });
      const runningTasks = runningResult?.tasks;

      if (!runningTasks || runningTasks.length === 0) {
        return typedInput;
      }

      // When the outer caller drives continuation externally (e.g. streamUntilIdle),
      // skip the in-loop wait. We still mark pending so ownstream knows.
      if (initData.options?.skipBgTaskWait) {
        return { ...typedInput, backgroundTaskPending: true };
      }

      const taskIds = runningTasks.map(task => task.id);

      const bgConfig = registryEntry?.backgroundTasksConfig;
      const managerConfig = bgManager.config;
      const waitTimeoutMs = bgConfig?.waitTimeoutMs ?? managerConfig?.waitTimeoutMs;

      // The regular agent gates on `retryCount === 0 || !waitTimeoutMs`
      // and can afford to skip waiting because tool-result chunks from
      // background tasks are pushed directly into the ReadableStream
      // controller via safeEnqueue — that works even after this step
      // returns.
      //
      // The durable agent emits tool-result chunks via pubsub.  The
      // pubsub subscription is torn down when the stream closes and the
      // consumer calls cleanup().  If this step returns without waiting,
      // the workflow finishes, FINISH fires, the stream closes, cleanup
      // runs, and the pubsub subscriber is gone before the background
      // task can deliver its result.
      //
      // Therefore the durable agent must always wait when background
      // tasks are running — using the configured waitTimeoutMs, or a
      // sensible 1 s default to keep the workflow (and pubsub) alive.

      // First invocation without explicit waitTimeoutMs — match the
      // regular agent's "signal pending, don't block" on retryCount 0,
      // but only when the caller provided an explicit timeout (meaning
      // they'll drive continuation externally).
      if (retryCount === 0 && waitTimeoutMs) {
        return { ...typedInput, backgroundTaskPending: true };
      }

      // Use configured timeout, or default to 1 s so the workflow stays
      // alive long enough for pubsub to deliver background-task results.
      const effectiveWaitMs = waitTimeoutMs ?? 1000;

      // Emit initial progress chunk
      if (pubsub) {
        try {
          await emitChunkEvent(pubsub, runId, {
            type: 'background-task-progress' as any,
            runId,
            from: ChunkFrom.AGENT,
            payload: { taskIds, runningCount: runningTasks.length, elapsedMs: 0 },
          });
        } catch {
          // PubSub may be closed
        }
      }

      // Wait for the next task to complete (or until timeout)
      try {
        await bgManager.waitForNextTask(taskIds, {
          timeoutMs: effectiveWaitMs,
          onProgress: (elapsedMs: number) => {
            if (!pubsub) return;
            void emitChunkEvent(pubsub, runId, {
              type: 'background-task-progress' as any,
              runId,
              from: ChunkFrom.AGENT,
              payload: { taskIds, runningCount: runningTasks.length, elapsedMs },
            }).catch(() => {});
          },
          progressIntervalMs: 3000,
        });
      } catch {
        // Timeout elapsed — no task completed. Return unchanged so the loop can end.
        // The tasks keep running in the background — results are picked up on
        // the next user message or stream.
        return typedInput;
      }

      // A task completed — force the loop to continue so the LLM processes the result
      if (typedInput.stepResult) {
        return {
          ...typedInput,
          backgroundTaskPending: true,
          stepResult: { ...typedInput.stepResult, isContinued: true },
        };
      }

      return { ...typedInput, backgroundTaskPending: true };
    },
  });
}
