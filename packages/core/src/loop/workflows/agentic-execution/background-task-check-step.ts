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
 * 1. First invocation (retryCount === 0): returns immediately with backgroundTaskPending=true
 *    so the loop can re-enter without blocking.
 * 2. Subsequent invocations: waits up to `waitTimeoutMs` for the NEXT task to complete
 *    (Strategy B — process as they arrive). Emits progress chunks while waiting.
 *    - If a task completes within the timeout: sets isContinued=true so the LLM processes it.
 *    - If the timeout elapses: returns WITHOUT setting isContinued, allowing the loop to end
 *      naturally. The background task continues running — its result will be picked up on
 *      the next user message or stream.
 *
 * Result injection and stream chunk emission are handled by per-task hooks
 * registered via createBackgroundTask in tool-call-step.
 *
 * If no pending tasks: passes through unchanged with `backgroundTaskPending = false`.
 */
export function createBackgroundTaskCheckStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  _internal,
  controller,
  runId,
  agentId,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'backgroundTaskCheckStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, retryCount }) => {
      const typedInput = inputData as LLMIterationData<Tools, OUTPUT>;
      const { threadId, resourceId } = _internal || {};
      const bgManager = _internal?.backgroundTaskManager;

      if (!bgManager) {
        return typedInput;
      }

      const runningResult = await bgManager?.listTasks({
        agentId,
        status: 'running',
        threadId,
        resourceId,
      });
      const runningTasks = runningResult?.tasks;

      // No running tasks or no manager — pass through
      if (!runningTasks || runningTasks.length === 0) {
        return typedInput;
      }

      // When the outer caller (e.g. `agent.streamUntilIdle`) is driving
      // continuation from outside, skip the in-loop wait entirely. The outer
      // will re-enter via `stream([])` once tasks complete. We still mark the
      // pending flag so `isTaskCompleteStep` knows to skip scoring.
      if (_internal?.skipBgTaskWait) {
        return { ...typedInput, backgroundTaskPending: true };
      }

      const taskIds = runningTasks.map(task => task.id);

      // Resolve wait timeout: agent config → manager config → undefined (wait forever)
      const agentBgConfig = _internal?.agentBackgroundConfig;
      const managerConfig = _internal?.backgroundTaskManagerConfig;
      const waitTimeoutMs = agentBgConfig?.waitTimeoutMs ?? managerConfig?.waitTimeoutMs;

      // First invocation — signal pending but don't block
      if (retryCount === 0 || !waitTimeoutMs) {
        return { ...typedInput, backgroundTaskPending: true };
      }

      // Emit initial progress chunk
      try {
        controller.enqueue({
          type: 'background-task-progress',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            taskIds,
            runningCount: runningTasks.length,
            elapsedMs: 0,
          },
        });
      } catch {
        // Controller may be closed — ignore
      }

      // Wait for the NEXT task to complete (or until waitTimeoutMs elapses)
      try {
        await bgManager.waitForNextTask(taskIds, {
          timeoutMs: waitTimeoutMs,
          onProgress: elapsedMs => {
            try {
              controller.enqueue({
                type: 'background-task-progress',
                runId,
                from: ChunkFrom.AGENT,
                payload: {
                  taskIds,
                  runningCount: runningTasks.length,
                  elapsedMs,
                },
              });
            } catch {
              // Controller may be closed — ignore
            }
          },
          progressIntervalMs: 3000,
        });
      } catch {
        // Timeout elapsed — no task completed within waitTimeoutMs.
        // Return WITHOUT setting isContinued so the loop can end.
        // The tasks keep running in the background — results will be
        // picked up on the next user message or stream.
        return typedInput;
      }

      // A task completed within the timeout — force the loop to continue
      // so the LLM processes the injected result
      if (typedInput.stepResult) {
        typedInput.stepResult.isContinued = true;
      }

      return { ...typedInput, backgroundTaskPending: true };
    },
  });
}
