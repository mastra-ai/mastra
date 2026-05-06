import type { StepResult, ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod/v4';
import type { MastraDBMessage, MessageList } from '../../../agent/message-list';
import { sanitizeToolName } from '../../../agent/message-list/utils/tool-name';
import { TripWire } from '../../../agent/trip-wire';
import { createObservabilityContext } from '../../../observability';
import type { ProcessorState } from '../../../processors';
import { ProcessorRunner } from '../../../processors/runner';
import type { ChunkType, ProviderMetadata } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema, toolCallOutputSchema } from '../schema';

/**
 * Walk messageList backwards looking for a tool-invocation part with the given
 * toolCallId in result state. Used to read the post-processToolResult value back
 * from the message list so we can sync any processor mutations into the
 * downstream tool-result stream chunk.
 */
function readToolResultFromMessageList(messageList: MessageList, toolCallId: string): unknown {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (
        part?.type === 'tool-invocation' &&
        part.toolInvocation?.toolCallId === toolCallId &&
        part.toolInvocation?.state === 'result'
      ) {
        return part.toolInvocation.result;
      }
    }
  }
  return undefined;
}

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

  // Build observability context from modelSpanTracker if tracing context is available
  const observabilityContext = createObservabilityContext(rest.modelSpanTracker?.getTracingContext());

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
        observabilityContext,
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

  /**
   * Run processToolResult on all output processors that implement it.
   *
   * Fires after tool.execute() returns and before the tool-result chunk is enqueued
   * to streaming clients / fed to the next LLM call. Symmetric with processOutputStep
   * (which fires before tool execution).
   *
   * Returns true on success (caller proceeds with chunk emission). Returns false on
   * tripwire (caller should emit a tripwire chunk and stop).
   */
  async function runToolResultProcessors(args: {
    chunk: ChunkType<OUTPUT> & { payload: { toolCallId: string; toolName: string; args?: unknown; result?: unknown; providerExecuted?: boolean } };
    stepNumber: number;
    steps: Array<StepResult<ToolSet>>;
  }): Promise<{ ok: true } | { ok: false; tripwire: TripWire }> {
    if (!processorRunner || !rest.outputProcessors?.length) {
      return { ok: true };
    }
    const { chunk, stepNumber, steps } = args;
    try {
      await processorRunner.runProcessToolResult({
        steps,
        messages: rest.messageList.get.all.db(),
        messageList: rest.messageList,
        stepNumber,
        toolName: chunk.payload.toolName,
        toolCallId: chunk.payload.toolCallId,
        toolArgs: chunk.payload.args,
        result: chunk.payload.result,
        providerExecuted: chunk.payload.providerExecuted,
        ...observabilityContext,
        requestContext: rest.requestContext,
        retryCount: 0,
        writer: streamWriter,
        abortSignal: rest.options?.abortSignal,
      });

      // Sync any processor mutation back into the chunk so streaming clients see
      // the post-processor value, not the raw tool return.
      const postProcessorResult = readToolResultFromMessageList(rest.messageList, chunk.payload.toolCallId);
      if (postProcessorResult !== undefined && postProcessorResult !== chunk.payload.result) {
        (chunk.payload as { result: unknown }).result = postProcessorResult;
      }
      return { ok: true };
    } catch (error) {
      if (error instanceof TripWire) {
        return { ok: false, tripwire: error };
      }
      throw error;
    }
  }

  /**
   * Emit a tripwire chunk to the stream so MastraModelOutput captures it as the
   * step result. Mirrors the tripwire emission in processAndEnqueueChunk.
   */
  function emitTripwireChunk(tripwire: TripWire): void {
    rest.controller.enqueue({
      type: 'tripwire',
      payload: {
        reason: tripwire.message || 'Tool result blocked by processor',
        retry: tripwire.options?.retry,
        metadata: tripwire.options?.metadata,
        processorId: tripwire.processorId,
      },
    } as ChunkType<OUTPUT>);
  }

  return createStep({
    id: 'llmExecutionMappingStep',
    inputSchema: z.array(toolCallOutputSchema),
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, getStepResult, bail }) => {
      const initialResult = getStepResult(llmExecutionStep);

      /**
       * Compute toModelOutput for a successful tool call and return providerMetadata
       * with the result stored at mastra.modelOutput.
       *
       * Looks up the tool from dynamically loaded tools (`_internal.stepTools`, e.g. via
       * ToolSearchProcessor) first, then falls back to the agent's static tool definitions.
       */
      async function getProviderMetadataWithModelOutput(toolCall: {
        toolName: string;
        result?: unknown;
        providerMetadata?: Record<string, unknown>;
      }) {
        const tool = ((
          _internal?.stepTools as Record<string, { toModelOutput?: (output: unknown) => unknown }> | undefined
        )?.[toolCall.toolName] ?? rest.tools?.[toolCall.toolName]) as
          | { toModelOutput?: (output: unknown) => unknown }
          | undefined;
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

      if (inputData?.some(toolCall => toolCall?.result === undefined && !toolCall.providerExecuted)) {
        const errorResults = inputData.filter(toolCall => toolCall?.error && !toolCall.providerExecuted);

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
                providerMetadata: toolCall.providerMetadata as ProviderMetadata | undefined,
              },
            };
            const processed = await processAndEnqueueChunk(chunk);
            if (processed) await rest.options?.onChunk?.(processed);

            rest.messageList.updateToolInvocation({
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: toolCall.toolCallId,
                toolName: sanitizeToolName(toolCall.toolName),
                args: toolCall.args,
                result: toolCall.error?.message ?? toolCall.error,
              },
              ...(toolCall.providerMetadata ? { providerMetadata: toolCall.providerMetadata as ProviderMetadata } : {}),
            });
          }
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
            const stepNumber = (initialResult?.output?.steps?.length ?? 0) as number;
            const steps = (initialResult?.output?.steps ?? []) as Array<StepResult<ToolSet>>;
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

              // Update messageList first so processToolResult sees the result inline
              if (!toolCall.providerExecuted) {
                const providerMetadata = await getProviderMetadataWithModelOutput(toolCall);
                rest.messageList.updateToolInvocation({
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    state: 'result' as const,
                    toolCallId: toolCall.toolCallId,
                    toolName: sanitizeToolName(toolCall.toolName),
                    args: toolCall.args,
                    result: toolCall.result,
                  },
                  ...(providerMetadata ? { providerMetadata } : {}),
                });
              }

              const trResult = await runToolResultProcessors({
                chunk: chunk as ChunkType<OUTPUT> & {
                  payload: {
                    toolCallId: string;
                    toolName: string;
                    args?: unknown;
                    result?: unknown;
                    providerExecuted?: boolean;
                  };
                },
                stepNumber,
                steps,
              });
              if (!trResult.ok) {
                emitTripwireChunk(trResult.tripwire);
                continue;
              }

              const processed = await processAndEnqueueChunk(chunk);
              if (processed) await rest.options?.onChunk?.(processed);
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
        const stepNumberForToolResults = (initialResult?.output?.steps?.length ?? 0) as number;
        const stepsForToolResults = (initialResult?.output?.steps ?? []) as Array<StepResult<ToolSet>>;
        for (const toolCall of inputData) {
          // No result yet — skip emitting a chunk. For deferred provider-executed tools
          // (e.g. Anthropic web_search), the result arrives in a later step and is handled
          // by processOutputStream's 'tool-result' case in llm-execution-step.
          if (toolCall.result === undefined) continue;

          const chunk: ChunkType<OUTPUT> = {
            type: 'tool-result',
            runId: rest.runId,
            from: ChunkFrom.AGENT,
            payload: {
              args: toolCall.args,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              result: toolCall.result,
              providerMetadata: toolCall.providerMetadata as ProviderMetadata | undefined,
              providerExecuted: toolCall.providerExecuted,
            },
          };

          // Update messageList first so processToolResult sees the result inline.
          // Provider-executed tools are handled by llm-execution-step; for client-executed
          // tools we patch state:'call' -> state:'result' here before any processor runs.
          if (!toolCall.providerExecuted) {
            const providerMetadata = await getProviderMetadataWithModelOutput(toolCall);
            rest.messageList.updateToolInvocation({
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: toolCall.toolCallId,
                toolName: sanitizeToolName(toolCall.toolName),
                args: toolCall.args,
                result: toolCall.result,
              },
              ...(providerMetadata ? { providerMetadata } : {}),
            });
          }

          // Run processToolResult before the chunk is enqueued downstream. On tripwire,
          // emit a tripwire chunk and skip the rest of this tool's emission.
          const trResult = await runToolResultProcessors({
            chunk: chunk as ChunkType<OUTPUT> & {
              payload: {
                toolCallId: string;
                toolName: string;
                args?: unknown;
                result?: unknown;
                providerExecuted?: boolean;
              };
            },
            stepNumber: stepNumberForToolResults,
            steps: stepsForToolResults,
          });
          if (!trResult.ok) {
            emitTripwireChunk(trResult.tripwire);
            continue;
          }

          const processed = await processAndEnqueueChunk(chunk);
          if (processed) await rest.options?.onChunk?.(processed);
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
