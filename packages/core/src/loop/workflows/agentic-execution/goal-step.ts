import type { ToolSet } from '@internal/ai-sdk-v5';
import { safeEnqueue } from '../../../stream/base';
import type { ChunkType } from '../../../stream/types';
import { createStep } from '../../../workflows/workflow';
import { evaluateGoal } from '../../shared/steps/goal-core';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';

/**
 * In-loop goal step. Mirrors `is-task-complete-step.ts` but is driven by a
 * durable objective in the `threadState` `'goal'` slot rather than a per-call
 * scorer. Behavior lives in the shared `evaluateGoal` core; this glue owns
 * resolving dependencies off the loop params and projecting the verdict back
 * onto `LLMIterationData` (flipping `isContinued` + the rotated `messageId`).
 */
export function createGoalStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  params: OuterLLMRun<Tools, OUTPUT>,
) {
  const {
    goal,
    messageList,
    requestContext,
    mastra,
    controller,
    runId,
    _internal,
    agentId,
    agentName,
    outputWriter,
    rotateResponseMessageId: rotateLoopResponseMessageId,
  } = params;

  return createStep({
    id: 'goalStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      const outcome = await evaluateGoal({
        goal,
        stepReason: inputData.stepResult?.reason,
        backgroundTaskPending: inputData.backgroundTaskPending,
        isContinued: inputData.stepResult?.isContinued,
        toolCalls: (inputData.output.toolCalls || []) as Array<{ toolName?: string; args?: unknown }>,
        toolResults: (inputData.output.toolResults || []) as Array<{ toolName?: string; result?: unknown }>,
        currentText: inputData.output.text || '',
        runId,
        agentId,
        agentName,
        threadId: _internal?.threadId,
        resourceId: _internal?.resourceId,
        customContext: requestContext ? Object.fromEntries(requestContext.entries()) : undefined,
        mastra,
        requestContext,
        memory: _internal?.memory,
        messageList: () => messageList,
        messageId: inputData.messageId,
        rotateMessageId: current => rotateLoopResponseMessageId(current),
        writeSignal: outputWriter
          ? async (data, options) => {
              await outputWriter(data as ChunkType, options);
            }
          : undefined,
        emitChunk: chunk => {
          safeEnqueue(controller, chunk as ChunkType<OUTPUT>);
        },
      });

      if (!outcome.evaluated) {
        return inputData;
      }

      if (inputData.stepResult) {
        inputData.stepResult.isContinued = outcome.shouldContinue;
      }
      if (outcome.kind === 'judged') {
        inputData.messageId = outcome.messageId;
      }
      return inputData;
    },
  });
}
