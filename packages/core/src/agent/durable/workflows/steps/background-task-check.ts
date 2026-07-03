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
 * - First iteration (iterationCount === 0) or no waitTimeoutMs configured:
 *   returns immediately with backgroundTaskPending=true so the loop can
 *   re-enter without blocking
 * - Later iterations with waitTimeoutMs: waits for the next task to complete,
 *   then sets isContinued=true so the LLM processes the result
 * - If no running tasks: passes through unchanged
 *
 * Note: uses iterationCount instead of retryCount because the durable
 * dowhile loop gives every step a fresh execution context (retryCount
 * always 0), unlike the regular agent's DefaultExecutionEngine which
 * maintains a persistent retryCounts map.
 */
export function createDurableBackgroundTaskCheckStep() {
  return createStep({
    id: BG_CHECK_STEP_ID,
    inputSchema: bgCheckInputSchema,
    outputSchema: bgCheckOutputSchema,
    execute: async params => {
      const { inputData, getInitData } = params;
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
      const typedInput = inputData as Record<string, any>;

      const initData = getInitData<{
        runId: string;
        agentId: string;
        iterationCount: number;
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

      // The regular agent's DefaultExecutionEngine maintains a persistent
      // retryCounts map across loop iterations, so the same step ID gets
      // retryCount=0 on the first invocation and retryCount=1+ on later
      // ones.  The durable agent's dowhile loop gives every step a fresh
      // context (retryCount always 0), so we use iterationCount from the
      // loop state instead — it tracks the same concept: "how many times
      // has the agentic loop iterated."
      //
      // Matches the regular agent's gating: iterationCount === 0 (first
      // pass) or no waitTimeoutMs configured → return immediately with
      // backgroundTaskPending=true so the loop can re-enter without
      // blocking.  On subsequent iterations, wait for the next task to
      // complete so the LLM can process the result.

      // First invocation or no timeout configured — signal pending but don't block
      if (initData.iterationCount === 0 || !waitTimeoutMs) {
        return { ...typedInput, backgroundTaskPending: true };
      }

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
          timeoutMs: waitTimeoutMs,
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
