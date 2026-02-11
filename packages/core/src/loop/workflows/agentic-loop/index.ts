import type { StepResult, ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../../memory';
import { InternalSpans } from '../../../observability';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createWorkflow } from '../../../workflows';
import type { OutputWriter } from '../../../workflows';
import type { StreamCompletionContext, CompletionRunResult } from '../../network/validation';
import { runStreamCompletionScorers, formatStreamCompletionFeedback } from '../../network/validation';
import type { LoopRun } from '../../types';
import { createAgenticExecutionWorkflow } from '../agentic-execution';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { isControllerOpen } from '../stream';

interface AgenticLoopParams<Tools extends ToolSet = ToolSet, OUTPUT = undefined> extends LoopRun<Tools, OUTPUT> {
  controller: ReadableStreamDefaultController<ChunkType<OUTPUT>>;
  outputWriter: OutputWriter;
}

export function createAgenticLoopWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  params: AgenticLoopParams<Tools, OUTPUT>,
) {
  const {
    models,
    _internal,
    messageId,
    runId,
    toolChoice,
    messageList,
    modelSettings,
    controller,
    outputWriter,
    ...rest
  } = params;

  // Track accumulated steps across iterations to pass to stopWhen
  const accumulatedSteps: StepResult<Tools>[] = [];
  // Track previous content to determine what's new in each step
  let previousContentLength = 0;

  const agenticExecutionWorkflow = createAgenticExecutionWorkflow<Tools, OUTPUT>({
    messageId: messageId!,
    models,
    _internal,
    modelSettings,
    toolChoice,
    controller,
    outputWriter,
    messageList,
    runId,
    ...rest,
  });

  return createWorkflow({
    id: 'agentic-loop',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    options: {
      tracingPolicy: {
        // mark all workflow spans related to the
        // VNext execution as internal
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: params => {
        return params.workflowStatus === 'suspended';
      },
      validateInputs: false,
    },
  })
    .dowhile(agenticExecutionWorkflow, async ({ inputData }) => {
      const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
      let hasFinishedSteps = false;

      const allContent: StepResult<Tools>['content'] = typedInputData.messages.nonUser.flatMap(
        message => message.content as unknown as StepResult<Tools>['content'],
      );

      // Only include new content in this step (content added since the previous iteration)
      const currentContent = allContent.slice(previousContentLength);
      previousContentLength = allContent.length;

      const currentStep: StepResult<Tools> = {
        content: currentContent,
        usage: typedInputData.output.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        // we need to cast this because we add 'tripwire' and 'retry' for processor scenarios
        finishReason: (typedInputData.stepResult?.reason || 'unknown') as StepResult<Tools>['finishReason'],
        warnings: typedInputData.stepResult?.warnings || [],
        request: typedInputData.metadata?.request || {},
        response: {
          ...typedInputData.metadata,
          modelId: typedInputData.metadata?.modelId || typedInputData.metadata?.model || '',
          messages: [],
        } as StepResult<Tools>['response'],
        text: typedInputData.output.text || '',
        reasoning: typedInputData.output.reasoning || [],
        reasoningText: typedInputData.output.reasoningText || '',
        files: typedInputData.output.files || [],
        toolCalls: typedInputData.output.toolCalls || [],
        toolResults: typedInputData.output.toolResults || [],
        sources: typedInputData.output.sources || [],
        staticToolCalls: typedInputData.output.staticToolCalls || [],
        dynamicToolCalls: typedInputData.output.dynamicToolCalls || [],
        staticToolResults: typedInputData.output.staticToolResults || [],
        dynamicToolResults: typedInputData.output.dynamicToolResults || [],
        providerMetadata: typedInputData.metadata?.providerMetadata,
      };

      accumulatedSteps.push(currentStep);

      // Only call stopWhen if we're continuing (not on the final step)
      if (rest.stopWhen && typedInputData.stepResult?.isContinued && accumulatedSteps.length > 0) {
        // Cast steps to any for v5/v6 StopCondition compatibility
        // v5 and v6 StepResult types have minor differences (e.g., rawFinishReason, finishReason format)
        // but are compatible at runtime for stop condition evaluation
        const steps = accumulatedSteps as any;
        const conditions = await Promise.all(
          (Array.isArray(rest.stopWhen) ? rest.stopWhen : [rest.stopWhen]).map(condition => {
            return condition({ steps });
          }),
        );

        const hasStopped = conditions.some(condition => condition);
        hasFinishedSteps = hasStopped;
      }

      // Call onIterationComplete hook if provided (call for every iteration, not just continued ones)
      if (rest.onIterationComplete) {
        const isFinal = !typedInputData.stepResult?.isContinued || hasFinishedSteps;
        const iterationContext = {
          iteration: accumulatedSteps.length,
          maxIterations: rest.maxSteps,
          text: typedInputData.output.text || '',
          toolCalls: (typedInputData.output.toolCalls || []).map((tc: any) => ({
            id: tc.toolCallId || tc.id || '',
            name: tc.toolName || tc.name || '',
            args: (tc.args || {}) as Record<string, unknown>,
          })),
          toolResults: (typedInputData.output.toolResults || []).map((tr: any) => ({
            id: tr.toolCallId || tr.id || '',
            name: tr.toolName || tr.name || '',
            result: tr.result,
            error: tr.error,
          })),
          isFinal,
          finishReason: typedInputData.stepResult?.reason || 'unknown',
          runId: runId,
          threadId: _internal?.threadId,
          resourceId: _internal?.resourceId,
          agentId: rest.agentId,
          agentName: rest.agentName || rest.agentId,
          messages: messageList.get.all.db(),
        };

        try {
          const iterationResult = await rest.onIterationComplete(iterationContext);

          if (iterationResult) {
            // Check if iteration should stop (only apply if we're still continuing)
            if (iterationResult.continue === false && !hasFinishedSteps) {
              hasFinishedSteps = true;
            }

            // Add feedback if provided (only if we're continuing to next iteration)
            if (iterationResult.feedback && typedInputData.stepResult?.isContinued && !hasFinishedSteps) {
              messageList.add({ role: 'assistant', content: iterationResult.feedback }, 'response');
            }
          }
        } catch (error) {
          // Log error but don't fail the iteration
          rest.logger?.error('Error in onIterationComplete hook:', error);
        }
      }

      // Run completion scoring if configured and still continuing
      let completionResult: CompletionRunResult | undefined;
      const hasCompletionScorers = rest.completion?.scorers && rest.completion.scorers.length > 0;

      if (hasCompletionScorers && (!typedInputData.stepResult?.isContinued || hasFinishedSteps)) {
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
        // Use any for toolCalls/toolResults to handle TypedToolCall/TypedToolResult complex generics
        const toolCalls = (typedInputData.output.toolCalls || []) as Array<{ toolName: string; args?: unknown }>;
        const toolResults = (typedInputData.output.toolResults || []) as Array<{
          toolName: string;
          result?: unknown;
        }>;

        const completionContext: StreamCompletionContext = {
          iteration: accumulatedSteps.length,
          maxIterations: rest.maxSteps,
          originalTask,
          currentText: typedInputData.output.text || '',
          toolCalls: toolCalls.map(tc => ({
            name: tc.toolName,
            args: (tc.args || {}) as Record<string, unknown>,
          })),
          messages: messageList.get.all.db(),
          toolResults: toolResults.map(tr => ({
            name: tr.toolName,
            result: tr.result,
          })),
          runId: runId,
          threadId: _internal?.threadId,
          resourceId: _internal?.resourceId,
          agentId: rest.agentId,
          agentName: rest.agentName,
          customContext: rest.requestContext ? Object.fromEntries(rest.requestContext.entries()) : undefined,
        };

        // Run completion scorers
        completionResult = await runStreamCompletionScorers(rest.completion!.scorers!, completionContext, {
          strategy: rest.completion!.strategy,
          parallel: rest.completion!.parallel,
          timeout: rest.completion!.timeout,
        });

        // Call onComplete callback if configured
        if (rest.completion!.onComplete) {
          await rest.completion!.onComplete(completionResult);
        }

        if (completionResult.complete) {
          // Task is complete - stop the loop
          hasFinishedSteps = true;
        }

        // add feedback as assistant message for the LLM to see
        const maxIterationReached = rest.maxSteps ? accumulatedSteps.length >= rest.maxSteps : false;
        const feedback = formatStreamCompletionFeedback(completionResult, maxIterationReached);

        // Add feedback as an assistant message so the LLM sees it in the next iteration
        messageList.add(
          {
            id: rest.mastra?.generateId(),
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
                },
              },
              format: 2,
            },
          } as MastraDBMessage,
          'response',
        );

        // Emit completion-check event
        if (isControllerOpen(controller)) {
          controller.enqueue({
            type: 'completion-check',
            runId,
            from: ChunkFrom.AGENT,
            payload: {
              iteration: accumulatedSteps.length,
              passed: completionResult.complete,
              results: completionResult.scorers,
              duration: completionResult.totalDuration,
              timedOut: completionResult.timedOut,
              reason: completionResult.completionReason,
              maxIterationReached: !!maxIterationReached,
            },
          } as ChunkType<OUTPUT>);
        }
      }

      if (typedInputData.stepResult) {
        typedInputData.stepResult.isContinued = hasFinishedSteps ? false : typedInputData.stepResult.isContinued;
      }

      // Emit step-finish for all cases except tripwire without any steps
      // When tripwire happens but we have steps (e.g., max retries exceeded), we still
      // need to emit step-finish so the stream properly finishes with all step data
      const hasSteps = (typedInputData.output?.steps?.length ?? 0) > 0;
      const shouldEmitStepFinish = typedInputData.stepResult?.reason !== 'tripwire' || hasSteps;

      if (shouldEmitStepFinish) {
        // Only enqueue if controller is still open
        if (isControllerOpen(controller)) {
          controller.enqueue({
            type: 'step-finish',
            runId,
            from: ChunkFrom.AGENT,
            // @ts-expect-error TODO: Look into the proper types for this
            payload: typedInputData,
          });
        }
      }

      const reason = typedInputData.stepResult?.reason;

      if (reason === undefined) {
        return false;
      }

      return typedInputData.stepResult?.isContinued ?? false;
    })
    .commit();
}
