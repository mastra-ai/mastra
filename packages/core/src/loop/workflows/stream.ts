import { ReadableStream } from 'node:stream/web';
import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../agent/message-list';
import { getErrorFromUnknown } from '../../error';
import {
  emitGoalState,
  analyzeGoalState,
  recordAgentRunCompletion,
  AgenticRunStateTracker,
  type AgenticInstrumentationContext,
} from '../../observability/instrumentation';
import { RequestContext } from '../../request-context';
import type { OutputSchema } from '../../stream/base/schema';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import type { LoopRun } from '../types';
import { createAgenticLoopWorkflow } from './agentic-loop';

/**
 * Check if a ReadableStreamDefaultController is open and can accept data.
 *
 * Note: While the ReadableStream spec indicates desiredSize can be:
 * - positive (ready), 0 (full but open), or null (closed/errored),
 * our empirical testing shows that after controller.close(), desiredSize becomes 0.
 * Therefore, we treat both 0 and null as closed states to prevent
 * "Invalid state: Controller is already closed" errors.
 *
 * @param controller - The ReadableStreamDefaultController to check
 * @returns true if the controller is open and can accept data
 */
export function isControllerOpen(controller: ReadableStreamDefaultController<any>): boolean {
  return controller.desiredSize !== 0 && controller.desiredSize !== null;
}

export function workflowLoopStream<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>({
  resumeContext,
  requireToolApproval,
  models,
  toolChoice,
  modelSettings,
  _internal,
  messageId,
  runId,
  messageList,
  startTimestamp,
  streamState,
  agentId,
  toolCallId,
  toolCallConcurrency,
  runStateTracker: existingTracker,
  ...rest
}: LoopRun<Tools, OUTPUT>) {
  // Create or use existing run state tracker for aggregating agentic metrics
  const instrumentationContext: AgenticInstrumentationContext = {
    agentId: agentId || 'unknown',
    runId,
    threadId: _internal?.threadId,
    resourceId: _internal?.resourceId,
  };
  const runStateTracker = existingTracker || new AgenticRunStateTracker(instrumentationContext);

  return new ReadableStream<ChunkType<OUTPUT>>({
    start: async controller => {
      const outputWriter = async (chunk: ChunkType<OUTPUT>) => {
        // Handle data-* chunks (custom data chunks from writer.custom())
        // These need to be persisted to storage, not just streamed
        if (chunk.type.startsWith('data-') && messageId) {
          const dataPart = {
            type: chunk.type as `data-${string}`,
            data: 'data' in chunk ? chunk.data : undefined,
          };
          const message: MastraDBMessage = {
            id: messageId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [dataPart],
            },
            createdAt: new Date(),
            threadId: _internal?.threadId,
            resourceId: _internal?.resourceId,
          };
          messageList.add(message, 'response');
        }
        void controller.enqueue(chunk);
      };

      const agenticLoopWorkflow = createAgenticLoopWorkflow<Tools, OUTPUT>({
        resumeContext,
        messageId: messageId!,
        models,
        _internal,
        modelSettings,
        toolChoice,
        controller,
        outputWriter,
        runId,
        messageList,
        startTimestamp,
        streamState,
        agentId,
        requireToolApproval,
        toolCallConcurrency,
        runStateTracker,
        ...rest,
      });

      if (rest.mastra) {
        agenticLoopWorkflow.__registerMastra(rest.mastra);
      }

      const initialData = {
        messageId: messageId!,
        messages: {
          all: messageList.get.all.aiV5.model(),
          user: messageList.get.input.aiV5.model(),
          nonUser: [],
        },
        output: {
          steps: [],
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
        metadata: {},
        stepResult: {
          reason: 'undefined',
          warnings: [],
          isContinued: true,
          totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
      };

      if (!resumeContext) {
        controller.enqueue({
          type: 'start',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: agentId,
            messageId,
          },
        });
      }

      const run = await agenticLoopWorkflow.createRun({
        runId,
      });

      const requestContext = new RequestContext();

      if (requireToolApproval) {
        requestContext.set('__mastra_requireToolApproval', true);
      }

      const executionResult = resumeContext
        ? await run.resume({
            resumeData: resumeContext.resumeData,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
            label: toolCallId,
          })
        : await run.start({
            inputData: initialData,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
            requestContext,
          });

      if (executionResult.status !== 'success') {
        if (executionResult.status === 'failed') {
          const error = getErrorFromUnknown(executionResult.error, {
            fallbackMessage: 'Unknown error in agent workflow stream',
          });

          controller.enqueue({
            type: 'error',
            runId,
            from: ChunkFrom.AGENT,
            payload: { error },
          });

          if (rest.options?.onError) {
            await rest.options?.onError?.({ error });
          }
        }

        if (executionResult.status !== 'suspended') {
          await agenticLoopWorkflow.deleteWorkflowRunById(runId);
        }

        controller.close();
        return;
      }

      await agenticLoopWorkflow.deleteWorkflowRunById(runId);

      // Emit agentic metrics for the completed run
      const result = executionResult.result;
      const finishReason = result.stepResult?.reason;
      const hasError = finishReason === 'error';
      const wasSuspended = false; // Not suspended since we got to this point
      const endTimestamp = Date.now();
      const durationMs = endTimestamp - startTimestamp;

      // Emit goal state event
      const goalState = analyzeGoalState(finishReason, hasError, wasSuspended);
      const stepCount = result.output?.steps?.length || 0;

      emitGoalState({
        context: instrumentationContext,
        analysis: {
          state: goalState,
          finishReason,
          stepsCompleted: stepCount,
          totalDurationMs: durationMs,
          reason: finishReason === 'tripwire' ? 'Guardrail triggered' : undefined,
        },
        logger: rest.logger,
      });

      // Get aggregated metrics from the run state tracker
      const completion = runStateTracker.getCompletion(finishReason, !hasError);

      // Supplement with step-level data from result if tracker didn't capture everything
      if (result.output?.steps) {
        for (const step of result.output.steps) {
          if (step.usage) {
            runStateTracker.recordTokenUsage({
              inputTokens: step.usage.inputTokens,
              outputTokens: step.usage.outputTokens,
            });
          }
          // Count tool results for success/failure
          if (step.toolResults) {
            for (const toolResult of step.toolResults) {
              if (toolResult.result !== undefined && !('error' in toolResult)) {
                runStateTracker.recordToolResult(true);
              } else {
                runStateTracker.recordToolResult(false);
              }
            }
          }
        }
      }

      // Use final usage if available (more accurate)
      if (result.output?.usage) {
        runStateTracker.recordTokenUsage({
          inputTokens: result.output.usage.inputTokens,
          outputTokens: result.output.usage.outputTokens,
        });
      }

      // Get final completion with all accumulated data
      const finalCompletion = runStateTracker.getCompletion(finishReason, !hasError);

      // Record comprehensive run completion using tracker data
      recordAgentRunCompletion({
        completion: {
          ...finalCompletion,
          // Override with more accurate values if available
          stepCount: stepCount || finalCompletion.stepCount,
          goalCompleted: goalState === 'completed',
        },
        logger: rest.logger,
      });

      // Always emit finish chunk, even for abort (tripwire) cases
      // This ensures the stream properly completes and all promises are resolved
      // The tripwire/abort status is communicated through the stepResult.reason
      controller.enqueue({
        type: 'finish',
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          ...executionResult.result,
          stepResult: {
            ...executionResult.result.stepResult,
            // @ts-expect-error - runtime reason can be 'tripwire' | 'retry' from processors, but zod schema infers as string
            reason: executionResult.result.stepResult.reason,
          },
        },
      });

      controller.close();
    },
  });
}
