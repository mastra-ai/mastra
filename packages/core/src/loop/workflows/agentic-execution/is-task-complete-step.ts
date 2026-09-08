import type { ToolSet } from '@internal/ai-sdk-v5';
import { safeEnqueue } from '../../../stream/base/input';
import type { ChunkType } from '../../../stream/types';
import { createStep } from '../../../workflows/workflow';
import { readScoped } from '../../run-scope-access';
import { RESOURCE_ID_KEY, THREAD_ID_KEY } from '../../run-scope-keys';
import { evaluateTaskCompletion } from '../../shared/steps/is-task-complete-core';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';

/**
 * Grades a settled iteration against the configured isTaskComplete scorers.
 * Behavior lives in the shared `evaluateTaskCompletion` core; this glue owns
 * the per-run iteration counter, RunScope access, and projection back onto
 * `LLMIterationData` (flipping `isContinued` + the `isTaskCompleteCheckFailed`
 * flag consumed by the next llm-execution).
 */
export function createIsTaskCompleteStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  params: OuterLLMRun<Tools, OUTPUT>,
) {
  const {
    isTaskComplete,
    maxSteps,
    messageList,
    requestContext,
    mastra,
    controller,
    runId,
    _internal,
    agentId,
    agentName,
  } = params;

  const scopeCtx = { mastra, runId, _internal };

  // Track iteration count across executions of this step
  let currentIteration = 0;

  return createStep({
    id: 'isTaskCompleteStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      // Increment iteration count
      currentIteration++;

      const outcome = await evaluateTaskCompletion({
        policy: isTaskComplete,
        iteration: currentIteration,
        maxIterations: maxSteps,
        llmSignaledDone: !inputData.stepResult?.isContinued,
        stepReason: inputData.stepResult?.reason,
        backgroundTaskPending: inputData.backgroundTaskPending,
        toolCalls: (inputData.output.toolCalls || []) as Array<{ toolName: string; args?: unknown }>,
        toolResults: (inputData.output.toolResults || []) as Array<{ toolName: string; result?: unknown }>,
        currentText: inputData.output.text || '',
        messageList: () => messageList,
        runId,
        agentId,
        agentName,
        threadId: readScoped(scopeCtx, THREAD_ID_KEY, 'threadId'),
        resourceId: readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId'),
        customContext: requestContext ? Object.fromEntries(requestContext.entries()) : undefined,
        generateId: () => mastra?.generateId(),
        emitChunk: chunk => {
          safeEnqueue(controller, chunk as ChunkType<OUTPUT>);
        },
        logger: mastra?.getLogger?.(),
      });

      if (!outcome.evaluated) {
        return inputData;
      }

      // Update isContinued based on the verdict: complete → stop, not
      // complete → run one more LLM iteration to course-correct.
      if (inputData.stepResult) {
        inputData.stepResult.isContinued = !outcome.complete;
      }

      return { ...inputData, isTaskCompleteCheckFailed: !outcome.complete };
    },
  });
}
