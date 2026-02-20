import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../../agent';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { StreamCompletionContext, CompletionRunResult } from '../../network/validation';
import { runStreamCompletionScorers, formatStreamCompletionFeedback } from '../../network/validation';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';

export function createCompletionCheckStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  params: OuterLLMRun<Tools, OUTPUT>,
) {
  const {
    completion,
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
    id: 'completionCheckStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      // Increment iteration count
      currentIteration++;

      // Only run completion check if scorers are configured
      const hasCompletionScorers = completion?.scorers && completion.scorers.length > 0;

      //Also check if the step result is not continued to avoid running scorers before the LLM is done
      if (!hasCompletionScorers || inputData.stepResult?.isContinued) {
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

      // Build completion context
      const toolCalls = (inputData.output.toolCalls || []) as Array<{ toolName: string; args?: unknown }>;
      const toolResults = (inputData.output.toolResults || []) as Array<{
        toolName: string;
        result?: unknown;
      }>;

      const completionContext: StreamCompletionContext = {
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

      // Run completion scorers - they're guaranteed to exist at this point
      const completionResult: CompletionRunResult = await runStreamCompletionScorers(
        completion.scorers!,
        completionContext,
        {
          strategy: completion.strategy,
          parallel: completion.parallel,
          timeout: completion.timeout,
        },
      );

      // Call onComplete callback if configured
      if (completion.onComplete) {
        await completion.onComplete(completionResult);
      }

      // Update isContinued based on completion result
      if (completionResult.complete) {
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
      const feedback = formatStreamCompletionFeedback(completionResult, maxIterationReached);
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
                passed: completionResult.complete,
                suppressFeedback: !!completion.suppressFeedback,
              },
            },
            format: 2,
          },
        } as MastraDBMessage,
        'response',
      );

      // Emit completion-check event
      controller.enqueue({
        type: 'completion-check',
        runId: runId,
        from: ChunkFrom.AGENT,
        payload: {
          iteration: currentIteration,
          passed: completionResult.complete,
          results: completionResult.scorers,
          duration: completionResult.totalDuration,
          timedOut: completionResult.timedOut,
          reason: completionResult.completionReason,
          maxIterationReached: !!maxIterationReached,
          suppressFeedback: !!completion.suppressFeedback,
        },
      } as ChunkType<OUTPUT>);

      return { ...inputData, completionCheckFailed: !completionResult.complete };
    },
  });
}
