import type { StepResult, ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod/v4';
import { TripWire } from '../../../agent/trip-wire';
import { createObservabilityContext } from '../../../observability';
import type { ProcessorState } from '../../../processors';
import { ProcessorRunner } from '../../../processors/runner';
import type { ChunkType, ProviderMetadata } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { withToolPayloadTransformProviderMetadata } from '../../../tools/payload-transform';
import { createStep } from '../../../workflows/workflow';
import { readScoped, writeScoped } from '../../run-scope-access';
import type { RunScopeContext } from '../../run-scope-access';
import { DELEGATION_BAILED_KEY, STEP_TOOLS_KEY, TOOL_PAYLOAD_TRANSFORM_KEY } from '../../run-scope-keys';
import { readToolResultFromMessageList } from '../../shared/read-tool-result';
import { processAndEmitChunk } from '../../shared/steps/process-chunk-core';
import { commitToolResult, computeModelOutputProviderMetadata } from '../../shared/steps/tool-result-commit-core';
import { applyToolPayloadTransformToChunk } from '../../shared/tool-payload-transform';
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
  // No onProcessorError policy: processor failures propagate and fail the request —
  // in this engine the run and stream share a lifecycle, so the client sees the error.
  async function processAndEnqueueChunk(chunk: ChunkType<OUTPUT>): Promise<ChunkType<OUTPUT> | null> {
    return processAndEmitChunk<OUTPUT>(chunk, {
      runner: processorRunner,
      processorStates: rest.processorStates as Map<string, ProcessorState<OUTPUT>> | undefined,
      observabilityContext,
      requestContext: rest.requestContext,
      messageList: rest.messageList,
      streamWriter,
      emitChunk: c => rest.controller.enqueue(c),
    });
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
    chunk: ChunkType<OUTPUT> & {
      payload: { toolCallId: string; toolName: string; args?: unknown; result?: unknown; providerExecuted?: boolean };
    };
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
       *
       * When toModelOutput is defined, the transform runs under a MAPPING child span so
       * traces can distinguish "never invoked" from "ran no-op" from "ran transforming."
       */
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
        return computeModelOutputProviderMetadata({
          tool,
          toolName: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          result: toolCall.result,
          existingProviderMetadata: toolCall.providerMetadata,
          parentSpan: observabilityContext?.tracingContext?.currentSpan,
          onMappingError: (error: unknown) => {
            // toModelOutput errors are non-fatal: the raw result is still recorded
            // and the model reads that instead. Matches the durable loop and the
            // background-task result path — this sync path was the only one that
            // failed the whole run over a presentation-layer mapping.
            rest.logger?.warn?.(
              `toModelOutput failed for tool "${toolCall.toolName}" — falling back to the raw result`,
              {
                toolCallId: toolCall.toolCallId,
                error,
              },
            );
          },
        });
      }

      async function transformToolChunk(
        chunk: ChunkType<OUTPUT>,
        toolCall: {
          args?: unknown;
          providerMetadata?: Record<string, unknown>;
        },
      ): Promise<ChunkType<OUTPUT>> {
        const stepTools = readScoped(scopeCtx, STEP_TOOLS_KEY, 'stepTools') as ToolSet | undefined;
        return applyToolPayloadTransformToChunk(chunk as ChunkType<OUTPUT> & { payload?: any }, {
          policy: readScoped(scopeCtx, TOOL_PAYLOAD_TRANSFORM_KEY, 'toolPayloadTransform'),
          tools: [stepTools, rest.tools],
          logger: rest.logger,
          // Transform against the original tool-call args/providerMetadata, not the
          // emitted payload's (which may carry the merged `mastra.modelOutput`).
          transformInput: {
            args: toolCall.args,
            providerMetadata: toolCall.providerMetadata,
          },
        }) as Promise<ChunkType<OUTPUT>>;
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
              toolCall,
            );
            const processed = await processAndEnqueueChunk(chunk);
            if (processed) await rest.options?.onChunk?.(processed);

            // Use the already-reified Error rather than `toolCall.error` (which is the
            // plain {name,message,stack} shape after the pubsub JSON round-trip).
            // Without reification the `instanceof Error` check below falls through to
            // `safeStringify`, dumping the whole stringified payload into the history.
            commitToolResult({
              messageList: rest.messageList,
              outcome: { kind: 'error', errorText: reifiedError.message },
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              toolArgs: toolCall.args,
              providerMetadata: withToolPayloadTransformProviderMetadata(
                toolCall.providerMetadata as ProviderMetadata,
                chunk.metadata,
              ) as ProviderMetadata | undefined,
            });
          }
        }

        // When tool errors occur, continue the agentic loop so the model can see the
        // error and self-correct (e.g., retry with different args, or respond to the user).
        // The error messages are already added to the messageList above, so the model
        // will see them on the next turn. This handles both tool-not-found errors
        // (hallucinated tool names) and tool execution errors (tool throws).
        //
        // Check for pending HITL tool calls (no result and no error); in mixed turns these
        // take priority over continuing the loop. Exclude aborted calls: they also lack a
        // result/error but were cancelled, not awaiting input, so they must not count as a
        // suspension or be recorded as a result (see tool-call-step.ts). Denied approvals are
        // resolved, not pending, so they are excluded too.
        const hasPendingHITL = inputData.some(
          tc => tc.result === undefined && !tc.error && !tc.aborted && !tc.providerExecuted && !isDeniedApproval(tc),
        );

        // Flush every tool call that already resolved in this step, whatever happens next.
        // Two paths depend on this: a mixed turn (one valid tool + one hallucinated) where
        // the loop continues, and a mixed turn where a client-side/HITL tool is still pending
        // and the turn ends below. In the latter case the resolved results must still be
        // streamed and committed before bailing — otherwise a completed server-side tool is
        // silently dropped: no tool-result chunk reaches the client (which then waits forever
        // for the call to leave `input-available`) and history persists it in `call` state as
        // if it never ran (issue #21637). Aborted and denied-approval calls have no `result`,
        // so they are excluded by construction and stay unrecorded (issue #17995 / PR #18034).
        const successfulResults = inputData.filter(tc => tc.result !== undefined);
        if (successfulResults.length) {
          const stepNumber = (initialResult?.output?.steps?.length ?? 0) as number;
          const steps = (initialResult?.output?.steps ?? []) as Array<StepResult<ToolSet>>;
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
            );

            // Run processToolResult BEFORE the raw result is committed to messageList.
            // This honors the documented "before the result is added to the message
            // list" guarantee — on tripwire the raw value never reaches history.
            // A processor that redacts via messageList.updateToolInvocation has its
            // value synced back into chunk.payload.result, which the commit below uses.
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

            if (!toolCall.providerExecuted) {
              // Update tool invocations from state:'call' to state:'result' for successful client tools.
              // Provider-executed tools are handled by llm-execution-step. The approval decision for
              // an approved approval-gated tool in a mixed turn (one tool errored, another approved)
              // is preserved so it round-trips on recall too.
              commitToolResult({
                messageList: rest.messageList,
                outcome: { kind: 'result', result: (chunk as { payload: { result: unknown } }).payload.result },
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                toolArgs: toolCall.args,
                approval: toolCall.approval,
                providerMetadata: withToolPayloadTransformProviderMetadata(providerMetadata, chunk.metadata) as
                  | ProviderMetadata
                  | undefined,
              });
            }

            const processed = await processAndEnqueueChunk(chunk);
            if (processed) await rest.options?.onChunk?.(processed);
          }
        }

        if (errorResults?.length > 0 && !hasPendingHITL) {
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
          // A declined approval has no `result`: persist it as `output-denied` with the approval
          // decision (rather than skipping it as a deferred call) and enqueue a terminal
          // `tool-output-denied` chunk so live stream clients resolve the pending tool call
          // (issue #20880). Persistence alone is not enough — without this enqueue the UI hangs.
          if (isDeniedApproval(toolCall)) {
            const approval = {
              id: toolCall.approval!.id,
              approved: false as const,
              reason: toolCall.approval!.reason,
            };
            commitToolResult({
              messageList: rest.messageList,
              outcome: { kind: 'denied', approval },
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              toolArgs: toolCall.args,
            });

            const chunk = await transformToolChunk(
              {
                type: 'tool-output-denied',
                runId: rest.runId,
                from: ChunkFrom.AGENT,
                payload: {
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                  approval,
                },
              },
              toolCall,
            );
            const processed = await processAndEnqueueChunk(chunk);
            if (processed) await rest.options?.onChunk?.(processed);
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
          );

          // Run processToolResult BEFORE the raw result is committed to messageList.
          // This honors the documented "before the result is added to the message list"
          // guarantee — on tripwire the raw value never reaches history. A processor
          // that redacts via messageList.updateToolInvocation has its value synced
          // back into chunk.payload.result, which the commit below uses.
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

          // Provider-executed tools are handled by llm-execution-step; for client-executed
          // tools we patch state:'call' -> state:'result' here after processors have run.
          // The approval decision for an approved approval-gated tool is preserved so it
          // round-trips on recall as `approval: { approved: true }`.
          if (!toolCall.providerExecuted) {
            commitToolResult({
              messageList: rest.messageList,
              outcome: { kind: 'result', result: (chunk as { payload: { result: unknown } }).payload.result },
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              toolArgs: toolCall.args,
              approval: toolCall.approval,
              providerMetadata: withToolPayloadTransformProviderMetadata(providerMetadata, chunk.metadata) as
                | ProviderMetadata
                | undefined,
            });
          }

          const processed = await processAndEnqueueChunk(chunk);
          if (processed) await rest.options?.onChunk?.(processed);
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
