import type { ToolSet } from '@internal/ai-sdk-v5';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';

/**
 * Step that checks for pending background tasks after the LLM has responded.
 *
 * If there are pending background tasks:
 * 1. Emits a `background-task-waiting` chunk so the UI can show a loading state
 * 2. Waits for the NEXT task to complete (Strategy B — process as they arrive)
 * 3. Emits periodic `background-task-waiting` chunks while waiting
 * 4. Sets `backgroundTaskPending = true` and `isContinued = true`
 *    so the loop iterates again for the LLM to process the result
 *
 * Result injection and stream chunk emission are handled by the
 * setResultInjector and setStreamChunkEmitter hooks set in tool-call-step.
 *
 * If no pending tasks: passes through unchanged with `backgroundTaskPending = false`.
 */
export function createBackgroundTaskCheckStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  _internal,
  controller,
  runId,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'backgroundTaskCheckStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      const typedInput = inputData as LLMIterationData<Tools, OUTPUT>;
      const pendingTasks = _internal?.pendingBackgroundTasks;
      const bgManager = _internal?.backgroundTaskManager;

      // No pending tasks or no manager — pass through
      if (!pendingTasks || pendingTasks.size === 0 || !bgManager) {
        return { ...typedInput, backgroundTaskPending: false };
      }

      const taskIds = [...pendingTasks];

      // Emit initial waiting chunk so the UI can show a loading state
      try {
        controller.enqueue({
          type: 'background-task-waiting' as any,
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            taskIds,
            pendingCount: pendingTasks.size,
            elapsedMs: 0,
          },
        });
      } catch {
        // Controller may be closed — ignore
      }

      // Wait for the NEXT task to complete, emitting progress chunks periodically
      const completedTask = await bgManager.waitForNextTask(pendingTasks, {
        onProgress: elapsedMs => {
          try {
            controller.enqueue({
              type: 'background-task-waiting' as any,
              runId,
              from: ChunkFrom.AGENT,
              payload: {
                taskIds: [...pendingTasks],
                pendingCount: pendingTasks.size,
                elapsedMs,
              },
            });
          } catch {
            // Controller may be closed — ignore
          }
        },
        progressIntervalMs: 3000,
      });

      // Remove from pending set
      pendingTasks.delete(completedTask.id);

      // Force the loop to continue so the LLM processes the result
      if (typedInput.stepResult) {
        typedInput.stepResult.isContinued = true;
      }

      return { ...typedInput, backgroundTaskPending: true };
    },
  });
}
