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
 * - Always waits for the next running background task to complete (up to
 *   waitTimeoutMs, or a 1s default), then sets isContinued=true so the LLM
 *   processes the result. This applies even on the first iteration, unlike
 *   the regular agent, because the durable agent's stream closes on FINISH
 *   and cannot pick up late tool-result chunks.
 * - skipBgTaskWait option: returns immediately with backgroundTaskPending=true
 *   when the outer caller drives continuation externally (e.g. streamUntilIdle)
 * - If no running tasks: passes through unchanged
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

      // Unlike the regular agent (which keeps its ReadableStream controller
      // alive so background task onChunk callbacks can enqueue tool-result
      // chunks even after backgroundTaskCheckStep returns), the durable
      // agent closes its stream on the FINISH pubsub event. Any tool-result
      // emitted after that is silently dropped. So the durable agent must
      // always wait for background tasks on every invocation.
      //
      // Use the configured waitTimeoutMs if available; otherwise use a
      // short default (1s) that's long enough for typical fast background
      // tasks. If the task doesn't complete in time, the timeout catch
      // below returns without setting isContinued, ending the loop.
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
