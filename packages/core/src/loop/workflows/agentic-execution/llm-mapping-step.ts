import type { ToolSet } from '@internal/ai-sdk-v5';
import z from 'zod';
import type { MastraDBMessage } from '../../../memory';
import type { ProcessorState } from '../../../processors';
import { ProcessorRunner } from '../../../processors/runner';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema, toolCallOutputSchema } from '../schema';

export function createLLMMappingStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
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
          processorStates: rest.processorStates,
        })
      : undefined;

  // Get tracing context from modelSpanTracker if available
  const tracingContext = rest.modelSpanTracker?.getTracingContext();

  // Create a ProcessorStreamWriter from outputWriter so processOutputStream can emit custom chunks
  const streamWriter = rest.outputWriter
    ? { custom: async (data: { type: string }) => rest.outputWriter(data as ChunkType<OUTPUT>) }
    : undefined;

  // Helper function to process a chunk through output processors and enqueue it.
  // Returns the processed chunk, or null if the chunk was blocked by a processor.
  async function processAndEnqueueChunk(chunk: ChunkType<OUTPUT>): Promise<ChunkType<OUTPUT> | null> {
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
        0,
        streamWriter,
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
        return null;
      }

      if (processed) {
        rest.controller.enqueue(processed as ChunkType<OUTPUT>);
        return processed as ChunkType<OUTPUT>;
      }

      return null;
    } else {
      // No processor runner, just enqueue the chunk directly
      rest.controller.enqueue(chunk);
      return chunk;
    }
  }

  return createStep({
    id: 'llmExecutionMappingStep',
    inputSchema: z.array(toolCallOutputSchema),
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, getStepResult, bail }) => {
      const initialResult = getStepResult(llmExecutionStep);

      // Compute toModelOutput for a successful tool call and return providerMetadata
      // with the result stored at mastra.modelOutput
      async function getProviderMetadataWithModelOutput(toolCall: {
        toolName: string;
        result?: unknown;
        providerMetadata?: Record<string, unknown>;
      }) {
        const tool = rest.tools?.[toolCall.toolName] as { toModelOutput?: (output: unknown) => unknown } | undefined;
        let modelOutput: unknown;
        if (tool?.toModelOutput && toolCall.result != null) {
          modelOutput = await tool.toModelOutput(toolCall.result);
        }

        const existingMastra = (toolCall.providerMetadata as any)?.mastra;
        const providerMetadata = {
          ...toolCall.providerMetadata,
          ...(modelOutput != null ? { mastra: { ...existingMastra, modelOutput } } : {}),
        };
        const hasMetadata = Object.keys(providerMetadata).length > 0;
        return hasMetadata ? providerMetadata : undefined;
      }

      if (inputData?.some(toolCall => toolCall?.result === undefined)) {
        const errorResults = inputData.filter(toolCall => toolCall?.error);

        const toolResultMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();

        if (errorResults?.length) {
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
            const processed = await processAndEnqueueChunk(chunk);
            if (processed) await rest.options?.onChunk?.(processed);
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

        // When tool errors occur, continue the agentic loop so the model can see the
        // error and self-correct (e.g., retry with different args, or respond to the user).
        // The error messages are already added to the messageList above, so the model
        // will see them on the next turn. This handles both tool-not-found errors
        // (hallucinated tool names) and tool execution errors (tool throws).
        //
        // Check for pending HITL tool calls (tools with no result and no error).
        // In mixed turns with errors and pending HITL tools,
        // the HITL suspension path should take priority over continuing the loop.
        const hasPendingHITL = inputData.some(tc => tc.result === undefined && !tc.error && !tc.providerExecuted);

        if (errorResults?.length > 0 && !hasPendingHITL) {
          // Process any successful tool results from this turn before continuing.
          // In a mixed turn (e.g., one valid tool + one hallucinated), the successful
          // results need their chunks emitted and messages added to the messageList.
          const successfulResults = inputData.filter(tc => tc.result !== undefined);
          if (successfulResults.length) {
            for (const toolCall of successfulResults) {
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
              const processed = await processAndEnqueueChunk(chunk);
              if (processed) await rest.options?.onChunk?.(processed);
            }

            // Split client-executed and provider-executed tools the same way as the main path
            const clientResults = successfulResults.filter(tc => !tc.providerExecuted);
            if (clientResults.length > 0) {
              const successMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();
              const successMessage: MastraDBMessage = {
                id: successMessageId || '',
                role: 'assistant' as const,
                content: {
                  format: 2,
                  parts: await Promise.all(
                    clientResults.map(async toolCall => {
                      const providerMetadata = await getProviderMetadataWithModelOutput(toolCall);
                      return {
                        type: 'tool-invocation' as const,
                        toolInvocation: {
                          state: 'result' as const,
                          toolCallId: toolCall.toolCallId,
                          toolName: toolCall.toolName,
                          args: toolCall.args,
                          result: toolCall.result,
                        },
                        ...(providerMetadata ? { providerMetadata } : {}),
                      };
                    }),
                  ),
                },
                createdAt: new Date(),
              };
              rest.messageList.add(successMessage, 'response');
            }

            if (successfulResults.some(tc => tc.providerExecuted)) {
              const providerResults = successfulResults.filter(tc => tc.providerExecuted);
              const providerMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();
              const providerMessage: MastraDBMessage = {
                id: providerMessageId || '',
                role: 'assistant' as const,
                content: {
                  format: 2,
                  parts: providerResults.map(toolCall => ({
                    type: 'tool-invocation' as const,
                    toolInvocation: {
                      state: 'result' as const,
                      toolCallId: toolCall.toolCallId,
                      toolName: toolCall.toolName,
                      args: toolCall.args,
                      result: toolCall.result,
                    },
                    ...(toolCall.providerMetadata ? { providerMetadata: toolCall.providerMetadata } : {}),
                    providerExecuted: true as const,
                  })),
                },
                createdAt: new Date(),
              };
              rest.messageList.add(providerMessage, 'response');
            }
          }

          // Continue the loop — the error messages are already in the messageList,
          // so the model will see them and can retry with correct tool names
          initialResult.stepResult.isContinued = true;
          initialResult.stepResult.reason = 'tool-calls';
          return {
            ...initialResult,
            messages: {
              all: rest.messageList.get.all.aiV5.model(),
              user: rest.messageList.get.input.aiV5.model(),
              nonUser: rest.messageList.get.response.aiV5.model(),
            },
          };
        }

        // Only set isContinued = false if this is NOT a retry scenario
        // When stepResult.reason is 'retry', the llm-execution-step has already set
        // isContinued = true and we should preserve that to allow the agentic loop to continue
        if (initialResult.stepResult.reason !== 'retry') {
          initialResult.stepResult.isContinued = false;
        }

        // Update messages field to include any error messages we added to messageList
        return bail({
          ...initialResult,
          messages: {
            all: rest.messageList.get.all.aiV5.model(),
            user: rest.messageList.get.input.aiV5.model(),
            nonUser: rest.messageList.get.response.aiV5.model(),
          },
        });
      }

      if (inputData?.length) {
        for (const toolCall of inputData) {
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

          const processed = await processAndEnqueueChunk(chunk);
          if (processed) await rest.options?.onChunk?.(processed);
        }

        // Exclude provider-executed tools from the tool-result message. These tools (e.g.
        // Anthropic web_search) are executed server-side — sending a client-fabricated result
        // would conflict with the provider's deferred execution.
        const clientExecutedToolCalls = inputData.filter(toolCall => !toolCall.providerExecuted);

        if (clientExecutedToolCalls.length > 0) {
          const toolResultMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();
          const toolResultMessage: MastraDBMessage = {
            id: toolResultMessageId || '',
            role: 'assistant' as const,
            content: {
              format: 2,
              parts: await Promise.all(
                clientExecutedToolCalls.map(async toolCall => {
                  const providerMetadata = await getProviderMetadataWithModelOutput(toolCall);
                  return {
                    type: 'tool-invocation' as const,
                    toolInvocation: {
                      state: 'result' as const,
                      toolCallId: toolCall.toolCallId,
                      toolName: toolCall.toolName,
                      args: toolCall.args,
                      result: toolCall.result,
                    },
                    ...(providerMetadata ? { providerMetadata } : {}),
                  };
                }),
              ),
            },
            createdAt: new Date(),
          };
          rest.messageList.add(toolResultMessage, 'response');
        }

        // Persist provider-executed tool results (e.g. Anthropic web_search) so
        // MessageMerger updates their invocations from state:"call" to state:"result".
        // Without this, they stay at "call" in the DB and cause HTTP 400 on resume.
        const providerExecutedToolCalls = inputData.filter(toolCall => toolCall.providerExecuted);
        if (providerExecutedToolCalls.length > 0) {
          const providerResultMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();
          const providerResultMessage: MastraDBMessage = {
            id: providerResultMessageId || '',
            role: 'assistant' as const,
            content: {
              format: 2,
              parts: providerExecutedToolCalls.map(toolCall => ({
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                  result: toolCall.result,
                },
                ...(toolCall.providerMetadata ? { providerMetadata: toolCall.providerMetadata } : {}),
                providerExecuted: true as const,
              })),
            },
            createdAt: new Date(),
          };
          rest.messageList.add(providerResultMessage, 'response');
        }

        // Check if any delegation hook called ctx.bail() — signal the loop to stop.
        // The bail flag is communicated via requestContext because Zod output validation
        // strips unknown fields (like _bailed) from the tool result object.
        if (rest.requestContext?.get('__mastra_delegationBailed') && _internal) {
          _internal._delegationBailed = true;
          rest.requestContext.set('__mastra_delegationBailed', false);
        }

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
