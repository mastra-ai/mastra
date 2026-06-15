import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { ChunkFrom } from '../../../../stream/types';
import { createStep } from '../../../../workflows';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
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
 * - First invocation (retryCount === 0): returns immediately with backgroundTaskPending=true
 *   so the loop can re-enter without blocking
 * - Subsequent invocations: waits with timeout for the next task to complete,
 *   then sets isContinued=true so the LLM processes the result
 * - If no running tasks: passes through unchanged
 */
export function createDurableBackgroundTaskCheckStep() {
  return createStep({
    id: BG_CHECK_STEP_ID,
    inputSchema: bgCheckInputSchema,
    outputSchema: bgCheckOutputSchema,
    execute: async params => {
      const { inputData, retryCount, getInitData } = params;
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
      // skip the in-loop wait. We still mark pending so downstream knows.
      if (initData.options?.skipBgTaskWait) {
        return { ...typedInput, backgroundTaskPending: true };
      }

      const taskIds = runningTasks.map(task => task.id);

      const bgConfig = registryEntry?.backgroundTasksConfig;
      const managerConfig = bgManager.config;
      const waitTimeoutMs = bgConfig?.waitTimeoutMs ?? managerConfig?.waitTimeoutMs;

      // First invocation: signal pending but don't block
      if (retryCount === 0 || !waitTimeoutMs) {
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
