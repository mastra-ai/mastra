import type { ToolSet } from '@internal/ai-sdk-v5';
import type { IsTaskCompleteRunResult, MastraDBMessage } from '../../../agent';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import { runStreamCompletionScorers, formatStreamCompletionFeedback } from '../../network/validation';
import type { StreamCompletionContext } from '../../network/validation';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';

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

  // Track iteration count across executions of this step
  let currentIteration = 0;

  return createStep({
    id: 'isTaskCompleteStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      // Increment iteration count
      currentIteration++;

      // Only run isTaskComplete check if scorers are configured
      const hasIsTaskCompleteScorers = isTaskComplete?.scorers && isTaskComplete.scorers.length > 0;

      //Also check if the step result is not continued to avoid running scorers before the LLM is done
      if (!hasIsTaskCompleteScorers || inputData.stepResult?.isContinued) {
        return inputData;
      }
      // Get the original user message for context
      const userMessages = messageList.get.input.db();
      const firstUserMessage = userMessages[0];
      let originalTask = 'Unknown task';
      if (firstUserMessage) {
        if (typeof firstUserMessage.content === 'string') {
          originalTask = firstUserMessage.content;
        } else if (firstUserMessage.content?.parts?.[0]?.type === 'text') {
          originalTask = (firstUserMessage.content.parts[0] as { type: 'text'; text: string }).text;
        }
      }

      // Build isTaskComplete context
      const toolCalls = (inputData.output.toolCalls || []) as Array<{ toolName: string; args?: unknown }>;
      const toolResults = (inputData.output.toolResults || []) as Array<{
        toolName: string;
        result?: unknown;
      }>;

      const isTaskCompleteContext: StreamCompletionContext = {
        iteration: currentIteration,
        maxIterations: maxSteps,
        originalTask,
        currentText: inputData.output.text || '',
        toolCalls: toolCalls.map(tc => ({
          name: tc.toolName,
          args: (tc.args || {}) as Record<string, unknown>,
        })),
        messages: messageList.get.all.db(),
        toolResults: toolResults.map(tr => ({
          name: tr.toolName,
          result: tr.result as Record<string, unknown>,
        })),
        agentId: agentId || '',
        agentName: agentName || '',
        runId: runId,
        threadId: _internal?.threadId,
        resourceId: _internal?.resourceId,
        customContext: requestContext ? Object.fromEntries(requestContext.entries()) : undefined,
      };

      // Run isTaskComplete scorers - they're guaranteed to exist at this point
      const isTaskCompleteResult: IsTaskCompleteRunResult = await runStreamCompletionScorers(
        isTaskComplete.scorers!,
        isTaskCompleteContext,
        {
          strategy: isTaskComplete.strategy,
          parallel: isTaskComplete.parallel,
          timeout: isTaskComplete.timeout,
        },
      );

      // Call onComplete callback if configured
      if (isTaskComplete.onComplete) {
        await isTaskComplete.onComplete(isTaskCompleteResult);
      }

      // Update isContinued based on isTaskComplete result
      if (isTaskCompleteResult.complete) {
        // Task is complete - stop continuing
        if (inputData.stepResult) {
          inputData.stepResult.isContinued = false;
        }
      } else {
        // Task not complete - continue
        if (inputData.stepResult) {
          inputData.stepResult.isContinued = true;
        }
      }

      // Add feedback as assistant message for the LLM to see in next iteration
      const maxIterationReached = maxSteps ? currentIteration >= maxSteps : false;
      const feedback = formatStreamCompletionFeedback(isTaskCompleteResult, maxIterationReached);
      messageList.add(
        {
          id: mastra?.generateId(),
          createdAt: new Date(),
          type: 'text',
          role: 'assistant',
          content: {
            parts: [
              {
                type: 'text',
                text: feedback,
              },
            ],
            metadata: {
              mode: 'stream',
              completionResult: {
                passed: isTaskCompleteResult.complete,
                suppressFeedback: !!isTaskComplete.suppressFeedback,
              },
            },
            format: 2,
          },
        } as MastraDBMessage,
        'response',
      );

      // Emit is-task-complete event
      controller.enqueue({
        type: 'is-task-complete',
        runId: runId,
        from: ChunkFrom.AGENT,
        payload: {
          iteration: currentIteration,
          passed: isTaskCompleteResult.complete,
          results: isTaskCompleteResult.scorers,
          duration: isTaskCompleteResult.totalDuration,
          timedOut: isTaskCompleteResult.timedOut,
          reason: isTaskCompleteResult.completionReason,
          maxIterationReached: !!maxIterationReached,
          suppressFeedback: !!isTaskComplete.suppressFeedback,
        },
      } as ChunkType<OUTPUT>);

      return { ...inputData, isTaskCompleteCheckFailed: !isTaskCompleteResult.complete };
    },
  });
}
