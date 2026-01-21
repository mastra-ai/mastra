import { z } from 'zod';
import type { ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { createStep } from '../../../../workflows';
import type { PubSub } from '../../../../events/pubsub';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { MastraDBMessage } from '../../../message-list';
import type { Mastra } from '../../../../mastra';
import { isSupportedLanguageModel } from '../../../utils';
import { execute } from '../../../../stream/aisdk/v5/execute';
import { MastraModelOutput } from '../../../../stream/base/output';
import type { ChunkType, TextDeltaPayload, ToolCallPayload } from '../../../../stream/types';
import { DurableStepIds } from '../../constants';
import { emitChunkEvent, emitStepStartEvent } from '../../stream-adapter';
import { resolveRuntimeDependencies } from '../../utils/resolve-runtime';
import type { RunRegistry } from '../../run-registry';
import type { DurableAgenticWorkflowInput, DurableLLMStepOutput, DurableToolCallInput } from '../../types';

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
    settings: z.record(z.any()).optional(),
  }),
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
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
});

/**
 * Options for creating the durable LLM execution step
 */
export interface DurableLLMExecutionStepOptions {
  /** Run registry for accessing non-serializable state */
  runRegistry: RunRegistry;
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
export function createDurableLLMExecutionStep(options: DurableLLMExecutionStepOptions) {
  const { runRegistry } = options;

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

      // 1. Resolve runtime dependencies
      const resolved = resolveRuntimeDependencies({
        mastra: mastra as Mastra,
        runRegistry,
        runId,
        agentId,
        input: typedInput,
        logger,
      });

      const { messageList, tools, model } = resolved;

      // 2. Get messages for LLM (using async llmPrompt for proper format conversion)
      const inputMessages = (await messageList.get.all.aiV5.llmPrompt()) as LanguageModelV2Prompt;

      // 3. Check if model is supported
      if (!isSupportedLanguageModel(model)) {
        throw new Error(
          `Unsupported model version: ${(model as any).specificationVersion}. Model must implement doStream.`,
        );
      }

      // 4. Prepare tools - cast through unknown as CoreTool and ToolSet are structurally compatible at runtime
      const toolSet = tools as unknown as ToolSet;

      // 5. Track state during streaming
      let warnings: any[] = [];
      let request: any = {};
      let rawResponse: any = {};
      const textDeltas: string[] = [];
      const toolCalls: DurableToolCallInput[] = [];
      let finishReason: string = 'stop';
      let usage: any = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      let responseMetadata: any = {};

      // 6. Execute LLM call
      const modelResult = execute({
        runId,
        model,
        inputMessages,
        tools: toolSet,
        toolChoice: execOptions.toolChoice as ToolChoice<ToolSet> | undefined,
        options: {},
        modelSettings: {
          temperature: execOptions.temperature,
        },
        includeRawChunks: execOptions.includeRawChunks,
        methodType: 'stream',
        onResult: ({ warnings: w, request: r, rawResponse: rr }) => {
          warnings = w || [];
          request = r || {};
          rawResponse = rr || {};

          // Emit step-start via pubsub
          if (pubsub) {
            emitStepStartEvent(pubsub, runId, {
              stepId: DurableStepIds.LLM_EXECUTION,
              request,
              warnings,
            });
          }
        },
      });

      // 7. Create output stream to process chunks
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
          tracingContext,
          requestContext,
        },
      });

      // 8. Process the stream and emit chunks via pubsub
      try {
        for await (const chunk of outputStream._getBaseStream()) {
          if (!chunk) continue;

          // Emit chunk via pubsub for streaming to client
          if (pubsub) {
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
              finishReason = payload.finishReason || 'stop';
              usage = payload.usage || usage;
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
              throw new Error(errorMessage);
            }
          }
        }
      } catch (error) {
        logger?.error?.('Error processing LLM stream', { error, runId });
        throw error;
      }

      // 9. Add assistant response to message list
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

      // 10. Determine if we should continue (has tool calls)
      const isContinued = toolCalls.length > 0 && finishReason !== 'stop';

      // 11. Build output
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
      };

      return output;
    },
  });
}
