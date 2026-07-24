import type { ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod/v4';
import { sanitizeToolName } from '../../../agent/message-list/utils/tool-name';
import { createObservabilityContext, EntityType, SpanType } from '../../../observability';
import type { ProcessorState } from '../../../processors';
import { ProcessorRunner } from '../../../processors/runner';
import type { ChunkType, ProviderMetadata } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import {
  transformToolPayloadForTargets,
  withToolPayloadTransformMetadata,
  withToolPayloadTransformProviderMetadata,
} from '../../../tools/payload-transform';
import { findProviderToolByName } from '../../../tools/provider-tool-utils';
import { createStep } from '../../../workflows/workflow';
import { readScoped, writeScoped } from '../../run-scope-access';
import type { RunScopeContext } from '../../run-scope-access';
import { AGENT_KEY, DELEGATION_BAILED_KEY, STEP_TOOLS_KEY, TOOL_PAYLOAD_TRANSFORM_KEY } from '../../run-scope-keys';
import type { OuterLLMRun } from '../../types';
import { deserializeToolError } from '../errors';
import { llmIterationOutputSchema, toolCallOutputSchema } from '../schema';

export function createLLMMappingStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  { models, _internal, ...rest }: OuterLLMRun<Tools, OUTPUT>,
  llmExecutionStep: any,
) {
  const scopeCtx: RunScopeContext = { mastra: rest.mastra, runId: rest.runId, _internal };
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
          agent: readScoped(scopeCtx, AGENT_KEY, 'agent'),
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

      const enqueueTripwire = (r?: string, opts?: { retry?: boolean; metadata?: unknown }, pid?: string) => {
        rest.controller.enqueue({
          type: 'tripwire',
          payload: {
            reason: r || 'Output processor blocked content',
            retry: opts?.retry,
            metadata: opts?.metadata,
            processorId: pid,
          },
        } as ChunkType<OUTPUT>);
      };

      if (blocked) {
        // Emit a tripwire chunk so downstream knows about the abort
        enqueueTripwire(reason, tripwireOptions, processorId);
        return null;
      }

      if (processed) {
        rest.controller.enqueue(processed as ChunkType<OUTPUT>);
      }

      // Emit any parts a processor stashed for reprocessing (e.g. the non-text
      // part that triggered a BatchPartsProcessor flush), pushing each back
      // through the whole chain so it gets downstream processing.
      const reprocessed = await processorRunner.drainReprocessParts(
        rest.processorStates as Map<string, ProcessorState<OUTPUT>>,
        observabilityContext,
        rest.requestContext,
        rest.messageList,
        0,
        streamWriter,
      );
      for (const r of reprocessed) {
        if (r.blocked) {
          enqueueTripwire(r.reason, r.tripwireOptions, r.processorId);
          return processed ? (processed as ChunkType<OUTPUT>) : null;
        }
        if (r.part != null) {
          rest.controller.enqueue(r.part as ChunkType<OUTPUT>);
        }
      }

      return processed ? (processed as ChunkType<OUTPUT>) : null;
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

      /**
       * Compute toModelOutput for a successful tool call and return providerMetadata
       * with the result stored at mastra.modelOutput.
       *
       * Looks up the tool from dynamically loaded tools (`_internal.stepTools`, e.g. via
       * ToolSearchProcessor) first, then falls back to the agent's static tool definitions.
       *
       * When toModelOutput is defined, the transform runs under a MAPPING child span so
       * traces can distinguish "never invoked" from "ran no-op" from "ran transforming."
       */
      /**
       * Normalize modelOutput from toModelOutput() into the AI SDK's
       * LanguageModelV2ToolResultOutput shape.
       *
       * The AI SDK's content array only accepts type 'text' or 'media'.
       * Mastra's createTool docs show type 'image-url' as a convenience shorthand,
       * so we normalize that here into type 'media' with the correct structure.
       *
       * Previously this converted 'media' -> 'image-data'/'file-data' which was wrong
       * (those types are not valid in LanguageModelV2ToolResultOutput).
       * See: https://github.com/mastra-ai/mastra/issues/17876
       */
      function normalizeModelOutput(output: unknown): unknown {
        if (output == null || typeof output !== 'object') return output;

        const obj = output as Record<string, unknown>;
        if (obj.type !== 'content' || !Array.isArray(obj.value)) return output;

        return {
          ...obj,
          value: (obj.value as unknown[]).map(item => {
            if (item == null || typeof item !== 'object') return item;
            const part = item as Record<string, unknown>;
            // Normalize 'image-url' convenience type -> 'media' as AI SDK expects
            if (part.type === 'image-url' && typeof part.url === 'string') {
              // Prefer caller-supplied mediaType; fall back to parsing data: URI or defaulting to image/jpeg
              const mediaType =
                typeof part.mediaType === 'string' && part.mediaType
                  ? part.mediaType
                  : part.url.startsWith('data:')
                    ? part.url.slice(5, part.url.indexOf(';')) || 'image/jpeg'
                    : 'image/jpeg';
              return { type: 'media', data: part.url, mediaType };
            }
            // 'image-data'/'file-data' from old normalizeModelOutput — convert back to 'media'
            if (part.type === 'image-data' && typeof part.data === 'string') {
              return { type: 'media', data: part.data, mediaType: part.mediaType ?? 'image/jpeg' };
            }
            if (part.type === 'file-data' && typeof part.data === 'string') {
              return { type: 'media', data: part.data, mediaType: part.mediaType ?? 'application/octet-stream' };
            }
            return part;
          }),
        };
      }

      async function getProviderMetadataWithModelOutput(toolCall: {
        toolName: string;
        toolCallId?: string;
        result?: unknown;
        providerMetadata?: Record<string, unknown>;
      }) {
        const tool = ((
          readScoped(scopeCtx, STEP_TOOLS_KEY, 'stepTools') as
            | Record<string, { toModelOutput?: (output: unknown) => unknown }>
            | undefined
        )?.[toolCall.toolName] ?? rest.tools?.[toolCall.toolName]) as
          | { toModelOutput?: (output: unknown) => unknown }
          | undefined;
        let modelOutput: unknown;
        if (tool?.toModelOutput && toolCall.result != null) {
          const parentSpan = observabilityContext?.tracingContext?.currentSpan;
          const mappingSpan = parentSpan?.createChildSpan({
            type: SpanType.MAPPING,
            name: `tool output mapping: '${toolCall.toolName}'`,
            entityType: EntityType.TOOL,
            entityId: toolCall.toolName,
            entityName: toolCall.toolName,
            input: toolCall.result,
            attributes: {
              mappingType: 'toModelOutput',
              toolCallId: toolCall.toolCallId,
            },
          });
          try {
            modelOutput = await tool.toModelOutput(toolCall.result);
            // Normalize media parts to image-data/file-data as AI SDK expects
            modelOutput = normalizeModelOutput(modelOutput);
            mappingSpan?.end({ output: modelOutput });
          } catch (err) {
            mappingSpan?.error({ error: err as Error, endSpan: true });
            throw err;
          }
        }

        const existingMastra = (toolCall.providerMetadata as any)?.mastra;
        const providerMetadata = {
          ...toolCall.providerMetadata,
          ...(modelOutput != null ? { mastra: { ...existingMastra, modelOutput } } : {}),
        };
        const hasMetadata = Object.keys(providerMetadata).length > 0;
        return hasMetadata ? providerMetadata : undefined;
      }

      async function transformToolChunk(
        chunk: ChunkType<OUTPUT>,
        toolCall: {
          toolName: string;
          toolCallId: string;
          args?: unknown;
          result?: unknown;
          error?: unknown;
          providerMetadata?: Record<string, unknown>;
        },
        phase: 'output-available' | 'error',
      ): Promise<ChunkType<OUTPUT>> {
        const stepTools = readScoped(scopeCtx, STEP_TOOLS_KEY, 'stepTools') as ToolSet | undefined;
        const tool =
          stepTools?.[toolCall.toolName] ||
          findProviderToolByName(stepTools, toolCall.toolName) ||
          Object.values(stepTools || {}).find((t: any) => `id` in t && t.id === toolCall.toolName) ||
          rest.tools?.[toolCall.toolName] ||
          findProviderToolByName(rest.tools, toolCall.toolName) ||
          Object.values(rest.tools || {}).find((t: any) => `id` in t && t.id === toolCall.toolName);
        const source = {
          policy: readScoped(scopeCtx, TOOL_PAYLOAD_TRANSFORM_KEY, 'toolPayloadTransform'),
          toolTransform: (tool as { transform?: unknown } | undefined)?.transform as any,
        };
        const inputTransform = await transformToolPayloadForTargets(
          {
            phase: 'input-available',
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            input: toolCall.args,
            providerMetadata: toolCall.providerMetadata,
          },
          source,
          rest.logger,
        );
        const transform = await transformToolPayloadForTargets(
          {
            phase,
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            input: toolCall.args,
            output: toolCall.result,
            error: toolCall.error,
            providerMetadata: toolCall.providerMetadata,
          },
          source,
          rest.logger,
        );

        return withToolPayloadTransformMetadata(withToolPayloadTransformMetadata(chunk, inputTransform), transform);
      }

      // A declined approval has no `result` but is fully resolved — it must not be mistaken for a
      // pending HITL/deferred tool call (which would otherwise suspend or stall the loop).
      const isDeniedApproval = (toolCall: { approval?: { approved?: boolean } }) =>
        toolCall?.approval?.approved === false;

      if (
        inputData?.some(
          toolCall => toolCall?.result === undefined && !toolCall.providerExecuted && !isDeniedApproval(toolCall),
        )
      ) {
        const errorResults = inputData.filter(toolCall => toolCall?.error && !toolCall.providerExecuted);

        if (errorResults?.length) {
          for (const toolCall of errorResults) {
            // `toolCall.error` arrives as the plain {name,message,stack} the workflow step
            // serializes (Error instances become `{}` over the pubsub bus). Reify here so
            // chunk consumers see a real Error with name/message/stack intact.
            const reifiedError = deserializeToolError(toolCall.error);
            const chunk = await transformToolChunk(
              {
                type: 'tool-error',
                runId: rest.runId,
                from: ChunkFrom.AGENT,
                payload: {
                  error: reifiedError,
                  args: toolCall.args,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  providerMetadata: toolCall.providerMetadata as ProviderMetadata | undefined,
                },
              },
              { ...toolCall, error: reifiedError },
              'error',
            );
            const processed = await processAndEnqueueChunk(chunk);
            if (processed) await rest.options?.onChunk?.(processed);

            rest.messageList.updateToolInvocation({
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: toolCall.toolCallId,
                toolName: sanitizeToolName(toolCall.toolName),
                args: toolCall.args,
                // Use the already-reified Error rather than `toolCall.error` (which is the
                // plain {name,message,stack} shape after the pubsub JSON round-trip).
                // Without reification the `instanceof Error` check below falls through to
                // `safeStringify`, dumping the whole stringified payload into the history.
                result: reifiedError.message || 'Tool execution failed',
              },
              ...(withToolPayloadTransformProviderMetadata(
                toolCall.providerMetadata as ProviderMetadata,
                chunk.metadata,
              )
                ? {
                    providerMetadata: withToolPayloadTransformProviderMetadata(
                      toolCall.providerMetadata as ProviderMetadata,
                      chunk.metadata,
                    ) as ProviderMetadata,
                  }
                : {}),
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
        const hasPendingHITL = inputData.some(
          tc => tc.result === undefined && !tc.error && !tc.providerExecuted && !isDeniedApproval(tc),
        );

        if (errorResults?.length > 0 && !hasPendingHITL) {
          // Process any successful tool results from this turn before continuing.
          // In a mixed turn (e.g., one valid tool + one hallucinated), the successful
          // results need their chunks emitted and messages added to the messageList.
          const successfulResults = inputData.filter(tc => tc.result !== undefined);
          if (successfulResults.length) {
            for (const toolCall of successfulResults) {
              // Compute modelOutput before emitting the chunk so consumers (e.g. harness)
              // can access it on the chunk's providerMetadata.mastra.modelOutput.
              // getProviderMetadataWithModelOutput already returns the fully-merged providerMetadata.
              const providerMetadata = !toolCall.providerExecuted
                ? await getProviderMetadataWithModelOutput(toolCall)
                : undefined;
              const chunkProviderMetadata = (providerMetadata ?? toolCall.providerMetadata) as
                | ProviderMetadata
                | undefined;

              const chunk = await transformToolChunk(
                {
                  type: 'tool-result',
                  runId: rest.runId,
                  from: ChunkFrom.AGENT,
                  payload: {
                    args: toolCall.args,
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    result: toolCall.result,
                    providerMetadata: chunkProviderMetadata,
                    providerExecuted: toolCall.providerExecuted,
                  },
                },
                toolCall,
                'output-available',
              );
              const processed = await processAndEnqueueChunk(chunk);
              if (processed) await rest.options?.onChunk?.(processed);

              if (!toolCall.providerExecuted) {
                // Update tool invocations from state:'call' to state:'result' for successful client tools.
                // Provider-executed tools are handled by llm-execution-step.
                rest.messageList.updateToolInvocation({
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    state: 'result' as const,
                    toolCallId: toolCall.toolCallId,
                    toolName: sanitizeToolName(toolCall.toolName),
                    args: toolCall.args,
                    result: toolCall.result,
                    // Preserve the approval decision for an approved approval-gated tool in a mixed
                    // turn (one tool errored, another approved) so it round-trips on recall too.
                    ...(toolCall.approval ? { approval: toolCall.approval } : {}),
                  },
                  ...(withToolPayloadTransformProviderMetadata(providerMetadata, chunk.metadata)
                    ? {
                        providerMetadata: withToolPayloadTransformProviderMetadata(
                          providerMetadata,
                          chunk.metadata,
                        ) as ProviderMetadata,
                      }
                    : {}),
                });
              }
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
          // A declined approval has no `result`: persist it as `output-denied` with the approval
          // decision (rather than skipping it as a deferred call) and emit no tool-result chunk.
          if (isDeniedApproval(toolCall)) {
            rest.messageList.updateToolInvocation({
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'output-denied' as const,
                toolCallId: toolCall.toolCallId,
                toolName: sanitizeToolName(toolCall.toolName),
                args: toolCall.args,
                approval: {
                  id: toolCall.approval!.id,
                  approved: false,
                  reason: toolCall.approval!.reason,
                },
              },
            });
            continue;
          }

          // No result yet — skip emitting a chunk. For deferred provider-executed tools
          // (e.g. Anthropic web_search), the result arrives in a later step and is handled
          // by processOutputStream's 'tool-result' case in llm-execution-step.
          if (toolCall.result === undefined) continue;

          // Compute modelOutput before emitting the chunk so consumers (e.g. harness)
          // can access it on the chunk's providerMetadata.mastra.modelOutput.
          // getProviderMetadataWithModelOutput already returns the fully-merged providerMetadata.
          const providerMetadata = !toolCall.providerExecuted
            ? await getProviderMetadataWithModelOutput(toolCall)
            : undefined;
          const chunkProviderMetadata = (providerMetadata ?? toolCall.providerMetadata) as ProviderMetadata | undefined;

          const chunk = await transformToolChunk(
            {
              type: 'tool-result',
              runId: rest.runId,
              from: ChunkFrom.AGENT,
              payload: {
                args: toolCall.args,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                result: toolCall.result,
                providerMetadata: chunkProviderMetadata,
                providerExecuted: toolCall.providerExecuted,
              },
            },
            toolCall,
            'output-available',
          );

          const processed = await processAndEnqueueChunk(chunk);
          if (processed) await rest.options?.onChunk?.(processed);

          // Exclude provider-executed tools — these are handled by llm-execution-step
          // (same-turn results are stored directly, deferred results are resolved via updateToolInvocation).
          if (!toolCall.providerExecuted) {
            rest.messageList.updateToolInvocation({
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: toolCall.toolCallId,
                toolName: sanitizeToolName(toolCall.toolName),
                args: toolCall.args,
                result: toolCall.result,
                // Preserve the approval decision for an approved approval-gated tool so it
                // round-trips on recall as `approval: { approved: true }`.
                ...(toolCall.approval ? { approval: toolCall.approval } : {}),
              },
              ...(withToolPayloadTransformProviderMetadata(providerMetadata, chunk.metadata)
                ? {
                    providerMetadata: withToolPayloadTransformProviderMetadata(
                      providerMetadata,
                      chunk.metadata,
                    ) as ProviderMetadata,
                  }
                : {}),
            });
          }
        }

        // Check if any delegation hook called ctx.bail() — signal the loop to stop.
        // The bail flag is communicated via requestContext because Zod output validation
        // strips unknown fields (like _bailed) from the tool result object.
        if (rest.requestContext?.get('__mastra_delegationBailed')) {
          writeScoped(scopeCtx, DELEGATION_BAILED_KEY, '_delegationBailed', true);
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
