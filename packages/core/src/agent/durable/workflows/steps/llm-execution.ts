import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import type { Mastra } from '../../../../mastra';
import type { SpanType, AIModelGenerationSpan, ExportedSpan, IModelSpanTracker } from '../../../../observability';
import { execute } from '../../../../stream/aisdk/v5/execute';
import { MastraModelOutput } from '../../../../stream/base/output';
import type { TextDeltaPayload, ToolCallPayload } from '../../../../stream/types';
import { createStep } from '../../../../workflows';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { MastraDBMessage } from '../../../message-list';
import { isSupportedLanguageModel } from '../../../utils';
import { DurableStepIds } from '../../constants';
import { emitChunkEvent, emitStepStartEvent } from '../../stream-adapter';
import type { DurableAgenticWorkflowInput, DurableLLMStepOutput, DurableToolCallInput } from '../../types';
import { resolveRuntimeDependencies, resolveModelFromListEntry } from '../../utils/resolve-runtime';

/**
 * Input schema for the durable LLM execution step
 */
const durableLLMInputSchema = z.object({
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(), // SerializedMessageListState
  toolsMetadata: z.array(z.any()),
  modelConfig: z.object({
    provider: z.string(),
    modelId: z.string(),
    specificationVersion: z.string().optional(),
    originalConfig: z.union([z.string(), z.record(z.any())]).optional(),
    settings: z.record(z.any()).optional(),
  }),
  // Model list for fallback support (when agent configured with array of models)
  modelList: z
    .array(
      z.object({
        id: z.string(),
        config: z.object({
          provider: z.string(),
          modelId: z.string(),
          specificationVersion: z.string().optional(),
          originalConfig: z.union([z.string(), z.record(z.any())]).optional(),
        }),
        maxRetries: z.number(),
        enabled: z.boolean(),
      }),
    )
    .optional(),
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
  // Agent span data for model span parenting
  agentSpanData: z.any().optional(),
  // Model span data (ONE span for entire agent run, created before workflow)
  modelSpanData: z.any().optional(),
  // Step index for continuation (step: 0, 1, 2, ...)
  stepIndex: z.number().optional(),
});

/**
 * Output schema for the durable LLM execution step
 */
const durableLLMOutputSchema = z.object({
  messageListState: z.any(),
  toolCalls: z.array(
    z.object({
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.record(z.any()),
      providerMetadata: z.record(z.any()).optional(),
    }),
  ),
  stepResult: z.object({
    reason: z.string(),
    warnings: z.array(z.any()),
    isContinued: z.boolean(),
    totalUsage: z.any().optional(),
  }),
  metadata: z.any(),
  processorRetryCount: z.number().optional(),
  processorRetryFeedback: z.string().optional(),
  state: z.any(),
  // Step index used in this execution (for tracking)
  stepIndex: z.number().optional(),
});

/**
 * Options for creating the durable LLM execution step
 */
export interface DurableLLMExecutionStepOptions {
  // No options needed - tools and model are resolved from Mastra at runtime
}

/**
 * Create a durable LLM execution step.
 *
 * This step:
 * 1. Deserializes the MessageList from workflow input
 * 2. Resolves tools and model from the runtime context
 * 3. Executes the LLM call
 * 4. Emits streaming chunks via pubsub
 * 5. Returns serialized state for the next step
 *
 * The key difference from the non-durable version is that all state
 * flows through the workflow input/output, and non-serializable
 * dependencies are resolved at execution time.
 */
export function createDurableLLMExecutionStep(_options?: DurableLLMExecutionStepOptions) {
  return createStep({
    id: DurableStepIds.LLM_EXECUTION,
    inputSchema: durableLLMInputSchema,
    outputSchema: durableLLMOutputSchema,
    execute: async params => {
      const { inputData, mastra, tracingContext, requestContext } = params;

      // Access pubsub via symbol
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

      const typedInput = inputData as DurableAgenticWorkflowInput;
      const { agentId, messageId, options: execOptions } = typedInput;
      const runId = typedInput.runId;
      const logger = mastra?.getLogger?.();

      // 1. Resolve runtime dependencies (tools from Mastra)
      const resolved = await resolveRuntimeDependencies({
        mastra: mastra as Mastra,
        runId,
        agentId,
        input: typedInput,
        logger,
      });

      const { messageList, tools, model: resolvedModel, modelList: resolvedModelList } = resolved;

      // 2. Determine if we have a model list for fallback support
      const hasModelList = typedInput.modelList && typedInput.modelList.length > 0;

      // 3. Build the model list - either from explicit list or single model
      // For single model case (no modelList), we use the resolved model directly
      // which supports mock models and directly-provided models
      const modelList = hasModelList
        ? typedInput.modelList!.filter(m => m.enabled)
        : [
            {
              id: `${typedInput.modelConfig.provider}/${typedInput.modelConfig.modelId}`,
              config: typedInput.modelConfig,
              maxRetries: 0,
              enabled: true,
            },
          ];

      if (modelList.length === 0) {
        throw new Error('No enabled models available for execution');
      }

      // 4. Execute with model fallback - try each model in the list with retries
      let lastError: Error | undefined;

      for (let modelIndex = 0; modelIndex < modelList.length; modelIndex++) {
        const modelEntry = modelList[modelIndex]!;
        const maxRetries = modelEntry.maxRetries || 0;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // Resolve the model - for single model case (no modelList), use resolved model
            // For model list case, try registry first (works with mock models), then config resolution (for Inngest)
            const model = !hasModelList
              ? resolvedModel
              : (resolvedModelList?.find(m => m.id === modelEntry.id)?.model ??
                (await resolveModelFromListEntry(modelEntry, mastra as Mastra)));

            // Check if model is supported
            if (!isSupportedLanguageModel(model)) {
              throw new Error(
                `Unsupported model version: ${(model as any).specificationVersion}. Model must implement doStream.`,
              );
            }

            // Get messages for LLM (using async llmPrompt for proper format conversion)
            const inputMessages = (await messageList.get.all.aiV5.llmPrompt()) as LanguageModelV2Prompt;

            // 5. Prepare tools - cast through unknown as CoreTool and ToolSet are structurally compatible at runtime
            const toolSet = tools as unknown as ToolSet;

            // 6. Rebuild MODEL_GENERATION span from passed data
            // For durable execution, ONE model_generation span is created BEFORE the workflow starts
            // and passed through each iteration. This ensures all steps are children of the same span.
            const observability = mastra?.observability?.getSelectedInstance({ requestContext });

            // modelSpanData is passed through from the workflow input (created in create-inngest-agent.ts)
            const inputModelSpanData = (inputData as any).modelSpanData as
              | ExportedSpan<SpanType.MODEL_GENERATION>
              | undefined;
            const modelSpan = inputModelSpanData
              ? (observability?.rebuildSpan(inputModelSpanData) as AIModelGenerationSpan | undefined)
              : undefined;

            // Create model span tracker for MODEL_STEP and MODEL_CHUNK spans
            const modelSpanTracker: IModelSpanTracker | undefined = modelSpan?.createTracker();

            // Set the step index for continuation (step: 0, 1, 2, ...)
            // This ensures step numbering continues across agentic loop iterations
            const stepIndex = (inputData as any).stepIndex ?? 0;
            modelSpanTracker?.setStepIndex(stepIndex);

            // Enable defer mode - step-finish won't auto-close the step span
            // This allows us to export the step span and close it later after tool execution
            modelSpanTracker?.setDeferStepClose(true);

            // 7. Track state during streaming
            let warnings: any[] = [];
            let request: any = {};
            let rawResponse: any = {};
            const textDeltas: string[] = [];
            const toolCalls: DurableToolCallInput[] = [];
            let finishReason: string = 'stop';
            let usage: any = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
            let responseMetadata: any = {};

            // 8. Start MODEL_STEP span at the beginning of LLM execution
            modelSpanTracker?.startStep();

            // 9. Execute LLM call
            const modelResult = execute({
              runId,
              model,
              inputMessages,
              tools: toolSet,
              toolChoice: execOptions.toolChoice as ToolChoice<ToolSet> | undefined,
              options: {},
              modelSettings: {
                temperature: execOptions.temperature,
                maxRetries: 0, // Disable built-in p-retry since we handle retries at the durable level
              },
              includeRawChunks: execOptions.includeRawChunks,
              methodType: 'stream',
              onResult: ({ warnings: w, request: r, rawResponse: rr }) => {
                warnings = w || [];
                request = r || {};
                rawResponse = rr || {};

                // Emit step-start via pubsub
                if (pubsub) {
                  void emitStepStartEvent(pubsub, runId, {
                    stepId: DurableStepIds.LLM_EXECUTION,
                    request,
                    warnings,
                  });
                }
              },
            });

            // 10. Create output stream to process chunks
            // Note: We cast through any to handle the web/node ReadableStream type mismatch
            const outputStream = new MastraModelOutput({
              model: {
                modelId: model.modelId,
                provider: model.provider,
                version: model.specificationVersion,
              },
              stream: modelResult as any,
              messageList,
              messageId,
              options: {
                runId,
                tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext,
                requestContext,
              },
            });

            // 11. Process the stream and emit chunks via pubsub
            // Wrap the base stream with ModelSpanTracker to create MODEL_STEP and MODEL_CHUNK spans
            const baseStream = outputStream._getBaseStream();
            const trackedStream = modelSpanTracker?.wrapStream(baseStream) ?? baseStream;

            try {
              for await (const chunk of trackedStream) {
                if (!chunk) continue;

                // Emit chunk via pubsub for streaming to client
                // NOTE: Do NOT emit 'finish' chunks - they will be sent as a proper FINISH event
                // at the end of the agentic loop. Emitting finish chunks here would cause
                // the client's MastraModelOutput to close prematurely in multi-step workflows.
                if (pubsub && chunk.type !== 'finish') {
                  await emitChunkEvent(pubsub, runId, chunk);
                }

                // Process different chunk types
                switch (chunk.type) {
                  case 'text-delta': {
                    const payload = chunk.payload as TextDeltaPayload;
                    textDeltas.push(payload.text);
                    break;
                  }

                  case 'tool-call': {
                    const payload = chunk.payload as ToolCallPayload;
                    toolCalls.push({
                      toolCallId: payload.toolCallId,
                      toolName: payload.toolName,
                      args: payload.args || {},
                      providerMetadata: payload.providerMetadata as Record<string, unknown> | undefined,
                      providerExecuted: payload.providerExecuted,
                      output: payload.output,
                    });
                    break;
                  }

                  case 'finish': {
                    const payload = chunk.payload as any;
                    // The finish chunk from MastraModelOutput has finishReason in stepResult.reason
                    finishReason = payload.stepResult?.reason || payload.finishReason || 'stop';
                    // Usage can be in output.usage or directly in payload.usage
                    usage = payload.output?.usage || payload.usage || usage;
                    break;
                  }

                  case 'response-metadata': {
                    const payload = chunk.payload as any;
                    responseMetadata = {
                      id: payload.id,
                      timestamp: payload.timestamp,
                      modelId: payload.modelId,
                      headers: payload.headers,
                    };
                    break;
                  }

                  case 'error': {
                    const payload = chunk.payload as any;
                    const errorMessage = payload?.error?.message || payload?.message || 'LLM execution error';
                    const errorObj = new Error(errorMessage);
                    // DON'T emit error event here - we might have fallback models to try
                    // Error event will be emitted after all models are exhausted
                    throw errorObj;
                  }
                }
              }
            } catch (error) {
              logger?.error?.('Error processing LLM stream', { error, runId });

              // Record error in MODEL_GENERATION span via tracker (but don't emit error event yet)
              const errorObj = error instanceof Error ? error : new Error(String(error));
              if (modelSpanTracker) {
                modelSpanTracker.reportGenerationError({ error: errorObj });
              } else if (modelSpan) {
                modelSpan.error({ error: errorObj });
              }

              // DON'T emit error event here - we might have fallback models to try
              // Error event will be emitted after all models are exhausted

              throw error;
            }

            // Check if the stream captured an error (MastraModelOutput swallows errors internally)
            const streamError = outputStream.error;
            if (streamError) {
              logger?.error?.('Stream captured error', { error: streamError, runId });

              // Record error in MODEL_GENERATION span via tracker (but don't emit error event yet)
              if (modelSpanTracker) {
                modelSpanTracker.reportGenerationError({ error: streamError });
              } else if (modelSpan) {
                modelSpan.error({ error: streamError });
              }

              // DON'T emit error event here - we might have fallback models to try
              // Error event will be emitted after all models are exhausted

              throw streamError;
            }

            // 12. Add assistant response to message list
            if (textDeltas.length > 0 || toolCalls.length > 0) {
              const parts: any[] = [];

              if (textDeltas.length > 0) {
                parts.push({
                  type: 'text' as const,
                  text: textDeltas.join(''),
                });
              }

              for (const tc of toolCalls) {
                parts.push({
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    state: 'call' as const,
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    args: tc.args,
                  },
                });
              }

              const assistantMessage: MastraDBMessage = {
                id: messageId,
                role: 'assistant' as const,
                content: {
                  format: 2,
                  parts,
                },
                createdAt: new Date(),
              };

              messageList.add(assistantMessage, 'response');
            }

            // 13. Determine if we should continue (has tool calls)
            const isContinued = toolCalls.length > 0 && finishReason !== 'stop';
            const hasToolCalls = toolCalls.length > 0;

            // 14. Export spans if there are tool calls (so tools can be children of model_step)
            // Don't end the spans yet - they will be ended after tool execution
            const stepSpanData = hasToolCalls ? modelSpanTracker?.exportCurrentStep() : undefined;
            const stepFinishPayload = hasToolCalls ? modelSpanTracker?.getPendingStepFinishPayload() : undefined;

            // 15. Build output
            const output: DurableLLMStepOutput = {
              messageListState: messageList.serialize(),
              toolCalls,
              stepResult: {
                reason: finishReason as any,
                warnings,
                isContinued,
                totalUsage: usage,
                headers: rawResponse?.headers,
                request,
              },
              metadata: {
                id: responseMetadata.id,
                modelId: responseMetadata.modelId || model.modelId,
                timestamp: responseMetadata.timestamp || new Date().toISOString(),
                providerMetadata: responseMetadata,
                headers: rawResponse?.headers,
                request,
              },
              state: typedInput.state,
              // Pass span data so tool calls can be children of model_step
              modelSpanData: hasToolCalls ? modelSpan?.exportSpan?.() : undefined,
              stepSpanData,
              stepFinishPayload,
            };

            // 16. End step span only if there are NO tool calls
            // If there are tool calls, step span will be ended after tool execution
            // NOTE: We NEVER close the model span here - it stays open for the entire agent run
            // and is closed in map-final-output after the agentic loop completes
            if (!hasToolCalls) {
              // Close the step span with usage/finish info
              const pendingPayload = modelSpanTracker?.getPendingStepFinishPayload() as any;
              if (pendingPayload) {
                // End step span using the pending payload
                const stepSpan = modelSpanTracker?.exportCurrentStep();
                if (stepSpan && observability) {
                  const rebuiltStepSpan = observability.rebuildSpan(stepSpan);
                  rebuiltStepSpan?.end({
                    output: {
                      text: textDeltas.join(''),
                      toolCalls: [],
                    },
                    attributes: {
                      usage: pendingPayload.output?.usage,
                      finishReason: pendingPayload.stepResult?.reason,
                      isContinued: pendingPayload.stepResult?.isContinued,
                    },
                  });
                }
              }
            }

            // Success - return the output
            return output;
          } catch (error) {
            // Capture error for potential re-throw
            lastError = error instanceof Error ? error : new Error(String(error));

            const modelId = modelEntry.config.modelId;
            logger?.error?.(`Error executing model ${modelId}, attempt ${attempt + 1}/${maxRetries + 1}`, {
              error: lastError,
              runId,
              modelIndex,
              attempt,
            });

            // If we've exhausted retries for this model, break to try next model
            if (attempt >= maxRetries) {
              logger?.debug?.(`Exhausted retries for model ${modelId}, trying next model`, { runId });
              break;
            }

            // Exponential backoff before retrying: 1s, 2s, 4s, 8s, max 10s
            const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
            logger?.debug?.(`Retrying model ${modelId} after ${delayMs}ms`, { runId, attempt });
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } // end retry loop
      } // end model loop

      // All models exhausted - throw the last error
      throw lastError ?? new Error('Exhausted all fallback models and reached the maximum number of retries.');
    },
  });
}
