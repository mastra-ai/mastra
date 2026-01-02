import type { ToolSet } from '@internal/ai-sdk-v5';
import z from 'zod';
import { supportedLanguageModelSpecifications } from '../../../agent/utils';
import type { MastraDBMessage } from '../../../memory';
import type { ProcessorState } from '../../../processors';
import { ProcessorRunner } from '../../../processors/runner';
import { convertMastraChunkToAISDKv5 } from '../../../stream/aisdk/v5/transform';
import type { OutputSchema } from '../../../stream/base/schema';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema, toolCallOutputSchema } from '../schema';

export function createLLMMappingStep<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>(
  { models, _internal, ...rest }: OuterLLMRun<Tools, OUTPUT>,
  llmExecutionStep: any,
) {
  /**
   * Output processor handling for tool-result and tool-error chunks.
   *
   * LLM-generated chunks (text-delta, tool-call, etc.) are processed through output processors
   * in the Inner MastraModelOutput (llm-execution-step.ts). However, tool-result and tool-error
   * chunks are created HERE after tool execution completes, so they would bypass the output
   * processor pipeline if we just enqueued them directly.
   *
   * To ensure output processors receive ALL chunk types (including tool-result), we create
   * a ProcessorRunner here that uses the SAME processorStates map as the Inner MastraModelOutput.
   * This ensures:
   * 1. Processors see tool-result chunks in processOutputStream
   * 2. Processor state (streamParts, customState) is shared across all chunks
   * 3. Blocking/tripwire works correctly for tool results
   */
  const processorRunner =
    rest.outputProcessors?.length && rest.logger
      ? new ProcessorRunner({
          inputProcessors: [],
          outputProcessors: rest.outputProcessors,
          logger: rest.logger,
          agentName: 'LLMMappingStep',
        })
      : undefined;

  // Get tracing context from modelSpanTracker if available
  const tracingContext = rest.modelSpanTracker?.getTracingContext();

  // Helper function to process a chunk through output processors and enqueue it
  async function processAndEnqueueChunk(chunk: ChunkType<OUTPUT>): Promise<void> {
    if (processorRunner && rest.processorStates) {
      const {
        part: processed,
        blocked,
        reason,
        tripwireOptions,
        processorId,
      } = await processorRunner.processPart(
        chunk,
        rest.processorStates as Map<string, ProcessorState<OUTPUT>>,
        tracingContext,
        rest.requestContext,
        rest.messageList,
      );

      if (blocked) {
        // Emit a tripwire chunk so downstream knows about the abort
        rest.controller.enqueue({
          type: 'tripwire',
          payload: {
            reason: reason || 'Output processor blocked content',
            retry: tripwireOptions?.retry,
            metadata: tripwireOptions?.metadata,
            processorId,
          },
        } as ChunkType<OUTPUT>);
        return;
      }

      if (processed) {
        rest.controller.enqueue(processed as ChunkType<OUTPUT>);
      }
    } else {
      // No processor runner, just enqueue the chunk directly
      rest.controller.enqueue(chunk);
    }
  }

  return createStep({
    id: 'llmExecutionMappingStep',
    inputSchema: z.array(toolCallOutputSchema),
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, getStepResult, bail }) => {
      const initialResult = getStepResult(llmExecutionStep);

      // Separate tool calls into those with errors and those with results
      const errorResults = inputData?.filter(toolCall => toolCall?.error) ?? [];
      const successResults = inputData?.filter(toolCall => toolCall?.result !== undefined && !toolCall?.error) ?? [];

      // Handle tool errors - emit tool-error chunks and add error messages
      if (errorResults.length) {
        const toolResultMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();

        for (const toolCall of errorResults) {
          const chunk: ChunkType<OUTPUT> = {
            type: 'tool-error',
            runId: rest.runId,
            from: ChunkFrom.AGENT,
            payload: {
              error: toolCall.error,
              args: toolCall.args,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              providerMetadata: toolCall.providerMetadata,
            },
          };
          await processAndEnqueueChunk(chunk);
        }

        const msg: MastraDBMessage = {
          id: toolResultMessageId || '',
          role: 'assistant',
          content: {
            format: 2,
            parts: errorResults.map(toolCallErrorResult => {
              return {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: toolCallErrorResult.toolCallId,
                  toolName: toolCallErrorResult.toolName,
                  args: toolCallErrorResult.args,
                  result: toolCallErrorResult.error?.message ?? toolCallErrorResult.error,
                },
                ...(toolCallErrorResult.providerMetadata
                  ? { providerMetadata: toolCallErrorResult.providerMetadata }
                  : {}),
              };
            }),
          },
          createdAt: new Date(),
        };
        rest.messageList.add(msg, 'response');
      }

      // Handle undefined results (no error, no result) - bail in this case as it's unexpected
      const undefinedResults = inputData?.filter(toolCall => toolCall?.result === undefined && !toolCall?.error) ?? [];
      if (undefinedResults.length && initialResult.stepResult.reason !== 'retry') {
        initialResult.stepResult.isContinued = false;
        return bail({
          ...initialResult,
          messages: {
            all: rest.messageList.get.all.aiV5.model(),
            user: rest.messageList.get.input.aiV5.model(),
            nonUser: rest.messageList.get.response.aiV5.model(),
          },
        });
      }

      // Handle successful tool results
      if (successResults.length) {
        for (const toolCall of successResults) {
          const chunk: ChunkType<OUTPUT> = {
            type: 'tool-result',
            runId: rest.runId,
            from: ChunkFrom.AGENT,
            payload: {
              args: toolCall.args,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              result: toolCall.result,
              providerMetadata: toolCall.providerMetadata,
              providerExecuted: toolCall.providerExecuted,
            },
          };

          await processAndEnqueueChunk(chunk);

          if (supportedLanguageModelSpecifications.includes(initialResult?.metadata?.modelVersion)) {
            await rest.options?.onChunk?.({
              chunk: convertMastraChunkToAISDKv5({
                chunk,
              }),
            } as any);
          }
        }

        const toolResultMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();

        const toolResultMessage: MastraDBMessage = {
          id: toolResultMessageId || '',
          role: 'assistant' as const,
          content: {
            format: 2,
            parts: successResults.map(toolCall => {
              return {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                  result: toolCall.result,
                },
                ...(toolCall.providerMetadata ? { providerMetadata: toolCall.providerMetadata } : {}),
              };
            }),
          },
          createdAt: new Date(),
        };

        rest.messageList.add(toolResultMessage, 'response');

        return {
          ...initialResult,
          messages: {
            all: rest.messageList.get.all.aiV5.model(),
            user: rest.messageList.get.input.aiV5.model(),
            nonUser: rest.messageList.get.response.aiV5.model(),
          },
        };
      }

      // If we have error results but no success results, we still need to return with messages
      // so the LLM can see the error and retry
      if (errorResults.length) {
        return {
          ...initialResult,
          messages: {
            all: rest.messageList.get.all.aiV5.model(),
            user: rest.messageList.get.input.aiV5.model(),
            nonUser: rest.messageList.get.response.aiV5.model(),
          },
        };
      }

      // Fallback: if inputData is empty or undefined, return initialResult as-is
      return initialResult;
    },
  });
}
