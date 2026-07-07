import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { mergeProviderOptions } from '../../../../llm/model/provider-options';
import type { SharedProviderOptions } from '../../../../llm/model/shared.types';
import { applyAutoResumeSystemMessage } from '../../../../loop/shared/auto-resume-system-message';
import { buildLlmPromptArgs } from '../../../../loop/shared/build-llm-prompt-args';
import { composeStepInput } from '../../../../loop/shared/compose-step-input';
import { injectBackgroundTaskPrompt } from '../../../../loop/shared/inject-background-task-prompt';
import { buildMemoryHeaders, mergeLlmCallHeaders } from '../../../../loop/shared/merge-llm-call-headers';
import type { Mastra } from '../../../../mastra';
import type {
  SpanType,
  AIModelGenerationSpan,
  ExportedSpan,
  IModelSpanTracker,
  AnySpan,
} from '../../../../observability';
import { EntityType } from '../../../../observability';
import { getStepAvailableToolNames } from '../../../../observability/utils';
import type { CachedLLMStepResponse } from '../../../../processors';
import { PrepareStepProcessor } from '../../../../processors/processors/prepare-step';
import { ProcessorRunner } from '../../../../processors/runner';
import { execute } from '../../../../stream/aisdk/v5/execute';
import { MastraModelOutput } from '../../../../stream/base/output';
import type { TextDeltaPayload, ToolCallPayload } from '../../../../stream/types';
import { ChunkFrom } from '../../../../stream/types';
import { inferProviderExecuted } from '../../../../tools/provider-tool-utils';
import type { CoreTool } from '../../../../tools/types';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { MessageList } from '../../../message-list';
import type { MastraDBMessage } from '../../../message-list';
import { TripWire } from '../../../trip-wire';
import { isSupportedLanguageModel } from '../../../utils';
import { DurableStepIds } from '../../constants';
import { endRunSpansWithError, globalRunRegistry } from '../../run-registry';
import { emitAbortEvent, emitChunkEvent, emitStepStartEvent } from '../../stream-adapter';
import type { DurableAgenticWorkflowInput, DurableLLMStepOutput, DurableToolCallInput } from '../../types';
import { applyToolPayloadTransformToChunk } from '../../utils/apply-tool-payload-transform';
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
    originalConfig: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
    settings: z.record(z.string(), z.any()).optional(),
    providerOptions: z.record(z.string(), z.any()).optional(),
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
          originalConfig: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
          providerOptions: z.record(z.string(), z.any()).optional(),
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
  text: z.string().optional(),
  toolCalls: z.array(
    z.object({
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.record(z.string(), z.any()),
      providerMetadata: z.record(z.string(), z.any()).optional(),
      activeTools: z.array(z.string()).nullable().optional(),
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
  // Exported span data forwarded to downstream steps for trace nesting/closing
  modelSpanData: z.any().optional(),
  stepSpanData: z.any().optional(),
  stepFinishPayload: z.any().optional(),
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
      const { inputData, mastra, tracingContext, requestContext, abortSignal } = params;

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

      // 1b. Check for tripwire from processInput (initial input processing).
      // If an input processor called abort() during preparation, the tripwire
      // data is stored on the registry entry. Emit a tripwire chunk and bail
      // immediately — the model must never be called.
      const registryTripwire = globalRunRegistry.get(runId)?.tripwire;
      if (registryTripwire) {
        // Clear it so it doesn't fire again on a subsequent iteration (shouldn't
        // happen since the loop will stop, but belt-and-suspenders).
        const entry = globalRunRegistry.get(runId);
        if (entry) entry.tripwire = undefined;

        logger?.warn?.('Input processor tripwire triggered (from preparation)', {
          agent: agentId,
          reason: registryTripwire.reason,
          processorId: registryTripwire.processorId,
          retry: registryTripwire.retry,
        });

        if (pubsub) {
          await emitChunkEvent(pubsub, runId, {
            type: 'tripwire',
            runId,
            from: ChunkFrom.AGENT,
            payload: {
              reason: registryTripwire.reason || '',
              retry: registryTripwire.retry,
              metadata: registryTripwire.metadata,
              processorId: registryTripwire.processorId,
            },
          });
        }

        return {
          messageListState: messageList.serialize(),
          text: '',
          toolCalls: [],
          stepResult: {
            reason: 'tripwire' as const,
            warnings: [],
            isContinued: false,
          },
          metadata: {},
          state: typedInput.state,
        } satisfies DurableLLMStepOutput;
      }

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
      let processorRetryCount = 0;
      const maxProcessorRetries =
        typedInput.options?.maxProcessorRetries ??
        (globalRunRegistry.get(runId)?.errorProcessors?.length ? 10 : undefined);

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
              const hint = (model as any).__metadataOnly
                ? ' The model could not be resolved from the run registry or Mastra instance.'
                : '';
              throw new Error(
                `Unsupported model version: ${(model as any).specificationVersion}. Model must implement doStream.${hint}`,
              );
            }

            let currentMessageId = messageId;

            // 5. Prepare tools - cast through unknown as CoreTool and ToolSet are structurally compatible at runtime
            let currentModel = model;
            let currentTools = tools as unknown as ToolSet;
            let currentToolChoice = execOptions.toolChoice as ToolChoice<ToolSet> | undefined;
            let currentActiveTools = execOptions.activeTools;
            let currentModelSettings: Record<string, unknown> = { ...(execOptions.modelSettings ?? {}) };
            let currentProviderOptions: SharedProviderOptions | undefined = mergeProviderOptions(
              execOptions.providerOptions,
              modelEntry.config.providerOptions,
            ) as SharedProviderOptions | undefined;

            // 6. Rebuild MODEL_GENERATION span from passed data
            // For durable execution, ONE model_generation span is created BEFORE the workflow starts
            // and passed through each iteration. This ensures all steps are children of the same span.
            const observability = mastra?.observability?.getSelectedInstance({ requestContext });

            // modelSpanData is threaded through the iteration state (seeded in preparation.ts);
            // after a resume the registry override points steps at the resumed generation.
            const inputModelSpanData = (globalRunRegistry.get(runId)?.resumeModelSpanData ??
              (inputData as any).modelSpanData) as ExportedSpan<SpanType.MODEL_GENERATION> | undefined;
            const modelSpan = inputModelSpanData
              ? (observability?.rebuildSpan(inputModelSpanData) as AIModelGenerationSpan | undefined)
              : undefined;

            // Create model span tracker for MODEL_STEP and MODEL_CHUNK spans
            const modelSpanTracker: IModelSpanTracker | undefined = modelSpan?.createTracker();

            // Set the step index for continuation (step: 0, 1, 2, ...)
            // This ensures step numbering continues across agentic loop iterations
            const stepIndex = (inputData as any).stepIndex ?? 0;
            modelSpanTracker?.setStepIndex(stepIndex);

            // Build structured output for AI SDK if configured. Held in a `let`
            // because `composeStepInput` (driven by input processors / prepareStep)
            // is allowed to replace `structuredOutput` for this iteration.
            const structuredOutputConfig = execOptions.structuredOutput;
            let structuredOutput =
              structuredOutputConfig?.schema && !structuredOutputConfig?.structuringModelConfig
                ? {
                    schema: structuredOutputConfig.schema,
                    jsonPromptInjection: structuredOutputConfig.jsonPromptInjection,
                  }
                : undefined;

            const registryEntry = globalRunRegistry.get(runId);
            const executionAbortSignal = registryEntry?.abortSignal ?? abortSignal;
            const baseInputProcessors = registryEntry?.inputProcessors ?? [];
            const stepInputProcessors = registryEntry?.prepareStep
              ? [...baseInputProcessors, new PrepareStepProcessor({ prepareStep: registryEntry.prepareStep })]
              : baseInputProcessors;
            if (stepInputProcessors.length) {
              const inputStepWriter = pubsub
                ? {
                    custom: async (data: { type: string }) => {
                      await emitChunkEvent(pubsub, runId, data as any);
                    },
                  }
                : undefined;
              const runner = new ProcessorRunner({
                inputProcessors: stepInputProcessors,
                outputProcessors: registryEntry?.outputProcessors ?? [],
                errorProcessors: registryEntry?.errorProcessors ?? [],
                logger: logger as any,
                agentName: typedInput.agentName ?? typedInput.agentId,
                processorStates: registryEntry?.processorStates,
              });
              try {
                const processInputStepResult = await runner.runProcessInputStep({
                  messageList,
                  stepNumber: stepIndex,
                  steps: (inputData as any).accumulatedSteps ?? [],
                  tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext,
                  requestContext,
                  memory: registryEntry?.memory,
                  resourceId: typedInput.state?.resourceId,
                  threadId: typedInput.state?.threadId,
                  model: currentModel,
                  messageId: currentMessageId,
                  rotateResponseMessageId: () => {
                    currentMessageId = crypto.randomUUID();
                    return currentMessageId;
                  },
                  tools: currentTools,
                  toolChoice: currentToolChoice,
                  providerOptions: currentProviderOptions,
                  activeTools: currentActiveTools,
                  modelSettings: currentModelSettings,
                  structuredOutput: structuredOutput as any,
                  retryCount: (inputData as any).processorRetryCount ?? 0,
                  abortSignal: executionAbortSignal,
                  writer: inputStepWriter,
                });
                const merged = composeStepInput(
                  {
                    messageId: currentMessageId,
                    model: currentModel,
                    tools: currentTools,
                    toolChoice: currentToolChoice,
                    activeTools: currentActiveTools,
                    providerOptions: currentProviderOptions,
                    modelSettings: currentModelSettings,
                    structuredOutput,
                  },
                  processInputStepResult,
                );
                currentMessageId = merged.messageId;
                currentModel = merged.model as typeof currentModel;
                currentTools = merged.tools as ToolSet;
                currentToolChoice = merged.toolChoice as ToolChoice<ToolSet> | undefined;
                currentActiveTools = merged.activeTools;
                currentProviderOptions = merged.providerOptions;
                currentModelSettings = merged.modelSettings;
                structuredOutput = merged.structuredOutput;
              } catch (error) {
                // Handle TripWire from processInputStep — emit tripwire chunk and
                // bail the step, mirroring the regular agent's buildTripWireBailResponse.
                // Return a bail output with reason: 'tripwire' so the dowhile loop
                // stops gracefully and emits a proper finish event.
                if (error instanceof TripWire) {
                  logger?.warn?.('Streaming input processor tripwire triggered', {
                    reason: error.message,
                    processorId: error.processorId,
                    retry: error.options?.retry,
                  });
                  if (pubsub) {
                    await emitChunkEvent(pubsub, runId, {
                      type: 'tripwire',
                      runId,
                      from: ChunkFrom.AGENT,
                      payload: {
                        processorId: error.processorId,
                        reason: error.message,
                        retry: error.options?.retry,
                        metadata: error.options?.metadata,
                      },
                    });
                  }
                  // Return a bail response instead of throwing — the dowhile
                  // predicate will see isContinued: false and stop the loop,
                  // then emitFinishEvent will emit reason: 'tripwire'.
                  return {
                    messageListState: messageList.serialize(),
                    text: '',
                    toolCalls: [],
                    stepResult: {
                      reason: 'tripwire' as const,
                      warnings: [],
                      isContinued: false,
                    },
                    metadata: {
                      modelId: currentModel.modelId,
                    },
                    state: typedInput.state,
                  } satisfies DurableLLMStepOutput;
                }
                logger?.error?.('Error in processInputStep processors:', error);
                throw error;
              }
            }

            // ── Signal echo & pre-run drain ───────────────────────────────
            // Mirror the non-durable llm-execution-step:
            //  1. Echo initialSignalEchoes (signals that were part of the input
            //     messages, e.g. from persisted memory) so the client sees them.
            //  2. Pre-run signals: if this is the first model request of the run
            //     (stepIndex === 0), drain signals that were queued before the
            //     run made its first request. These must be added to messageList
            //     BEFORE inputMessages is materialized so the model sees them.
            if (pubsub) {
              const initialSignalEchoes = registryEntry?.initialSignalEchoes?.splice(0) ?? [];
              for (const initialSignal of initialSignalEchoes) {
                await emitChunkEvent(pubsub, runId, initialSignal.toDataPart() as any);
              }

              const isFirstModelRequest = stepIndex === 0;
              if (isFirstModelRequest && registryEntry?.drainPendingSignals) {
                const preRunSignals = registryEntry.drainPendingSignals('pre-run');
                if (preRunSignals.length > 0) {
                  currentMessageId = mastra?.generateId?.() ?? crypto.randomUUID();
                }
                for (const preRunSignal of preRunSignals) {
                  const signalForTranscript = messageList.addSignal(preRunSignal);
                  await emitChunkEvent(pubsub, runId, signalForTranscript.toDataPart() as any);
                }
              }
            }

            // `downloadRetries` / `downloadConcurrency` are internal-only on the
            // non-durable path today (not exposed through AgentExecutionOptions),
            // so durable also relies on the MessageList defaults here. If those
            // ever become user-facing they should be plumbed in identically.
            const messageListPromptArgs = await buildLlmPromptArgs({
              model: currentModel,
            });
            const llmPromptForModel =
              currentModel.specificationVersion === 'v3' || currentModel.specificationVersion === 'v4'
                ? messageList.get.all.aiV6.llmPrompt
                : messageList.get.all.aiV5.llmPrompt;
            let inputMessages = (await llmPromptForModel(messageListPromptArgs)) as LanguageModelV2Prompt;

            // Inject the auto-resume directive into the leading system message when
            // there are suspended tools waiting for resumption (parity with the
            // non-durable agentic-execution step).
            inputMessages = applyAutoResumeSystemMessage({
              autoResume: execOptions.autoResumeSuspendedTools,
              inputMessages,
              messages: messageList.get.all.db(),
            });

            // Tell the model about background-task capabilities when a
            // background-task manager is wired in. Mirrors the non-durable
            // agentic-execution step so background-enabled tools surface the
            // same `_background` guidance to the LLM.
            inputMessages = injectBackgroundTaskPrompt({
              inputMessages,
              backgroundTaskManager: registryEntry?.backgroundTaskManager,
              tools: currentTools as Record<string, { background?: any; description?: string }> | undefined,
              agentBackgroundConfig: registryEntry?.backgroundTasksConfig,
            });

            // Run `processLLMRequest` for any input processors that implement it.
            // This hook lets processors rewrite the outbound prompt transiently
            // without persisting changes back to the message list, or short-circuit
            // the call entirely by returning a cached response.
            // Mirrors loop/workflows/agentic-execution/llm-execution-step.ts.
            //
            // Use `llmRequestInputProcessors` (uncombined) because combined
            // (workflow-wrapped) processors are skipped by
            // `ProcessorRunner.runProcessLLMRequest`. Fall back to
            // `inputProcessors` for backward compatibility.
            let cachedResponse: CachedLLMStepResponse | undefined;
            const allInputProcessors = registryEntry?.llmRequestInputProcessors ?? registryEntry?.inputProcessors ?? [];
            // Create a single ProcessorRunner shared between processLLMRequest
            // and processLLMResponse so processor state (e.g. cache keys stashed
            // in the request hook) is available in the response hook.
            const requestStepRunner =
              allInputProcessors.length > 0
                ? new ProcessorRunner({
                    inputProcessors: allInputProcessors,
                    outputProcessors: [],
                    logger: logger as any,
                    agentName: typedInput.agentName ?? typedInput.agentId,
                    processorStates: registryEntry?.processorStates,
                  })
                : undefined;
            const requestStepWriter = pubsub
              ? {
                  custom: async (data: { type: string }) => {
                    await emitChunkEvent(pubsub, runId, data as any);
                  },
                }
              : undefined;
            if (requestStepRunner) {
              try {
                const requestStepResult = await requestStepRunner.runProcessLLMRequest({
                  prompt: inputMessages,
                  model: currentModel,
                  stepNumber: (inputData as any).accumulatedSteps?.length ?? 0,
                  steps: (inputData as any).accumulatedSteps ?? [],
                  retryCount: (inputData as any).processorRetryCount ?? 0,
                  requestContext,
                  tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext,
                  writer: requestStepWriter,
                  abortSignal: executionAbortSignal,
                });
                inputMessages = requestStepResult.prompt;
                cachedResponse = requestStepResult.response;
              } catch (error) {
                if (error instanceof TripWire) {
                  logger?.warn?.('Streaming request processor tripwire triggered', {
                    reason: error.message,
                    processorId: error.processorId,
                    retry: error.options?.retry,
                  });
                  // Emit a tripwire chunk and return a bail response so the
                  // dowhile loop stops gracefully with reason: 'tripwire'.
                  if (pubsub) {
                    await emitChunkEvent(pubsub, runId, {
                      type: 'tripwire',
                      runId,
                      from: ChunkFrom.AGENT,
                      payload: {
                        processorId: error.processorId,
                        reason: error.message,
                        retry: error.options?.retry,
                        metadata: error.options?.metadata,
                      },
                    });
                  }
                  return {
                    messageListState: messageList.serialize(),
                    text: '',
                    toolCalls: [],
                    stepResult: {
                      reason: 'tripwire' as const,
                      warnings: [],
                      isContinued: false,
                    },
                    metadata: {
                      modelId: currentModel.modelId,
                    },
                    state: typedInput.state,
                  } satisfies DurableLLMStepOutput;
                }
                logger?.error?.('Error in processLLMRequest processors:', error);
                throw error;
              }
            }

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

            // ── Client-tool observability + onInputStart / onInputDelta ──
            // Mirrors the regular agent's injectClientToolObservability / endClientToolObservabilitySpan
            // helpers. Creates CLIENT_TOOL_CALL spans for tools executed on the client side and
            // invokes the tool-level onInputStart / onInputDelta callbacks as chunks arrive.
            const clientToolArgsTextByToolCallId = new Map<string, string[]>();
            const clientToolObservabilityByToolCallId = new Map<
              string,
              { carrier: unknown; span: AnySpan; ended: boolean }
            >();
            // Cache resolved tool defs by toolCallId so `tool-call-delta` chunks
            // (which may carry only a toolCallId, no toolName) can still find the
            // tool resolved during the preceding `tool-call-input-streaming-start`.
            const resolvedToolByCallId = new Map<string, CoreTool>();

            const resolveToolDef = (toolName: string): CoreTool | undefined => {
              const directTool = (currentTools as unknown as Record<string, CoreTool> | undefined)?.[toolName];
              if (directTool) return directTool;
              return registryEntry?.tools?.[toolName];
            };

            const endClientToolObservabilitySpan = (toolCallId: string, args?: unknown): void => {
              const entry = clientToolObservabilityByToolCallId.get(toolCallId);
              if (!entry || entry.ended) {
                clientToolArgsTextByToolCallId.delete(toolCallId);
                return;
              }
              entry.span.end(args !== undefined ? { metadata: { args } } : undefined);
              entry.ended = true;
              clientToolArgsTextByToolCallId.delete(toolCallId);
            };

            const parseClientToolArgsFromDeltas = (toolCallId: string): unknown | undefined => {
              const deltas = clientToolArgsTextByToolCallId.get(toolCallId);
              if (!deltas?.length) return undefined;
              const input = deltas.join('');
              if (!input) return undefined;
              try {
                return JSON.parse(input);
              } catch {
                return undefined;
              }
            };

            const injectClientToolObservability = ({
              toolCallId,
              toolName,
              args,
              providerExecuted,
              payload,
            }: {
              toolCallId: string;
              toolName: string;
              args?: unknown;
              providerExecuted?: boolean;
              payload: Record<string, unknown> & { observability?: unknown };
            }): { toolDef: CoreTool | undefined } => {
              const toolDef = resolveToolDef(toolName);
              const inferredProviderExecuted = inferProviderExecuted(providerExecuted, toolDef);
              const isClientTool =
                !inferredProviderExecuted && !(toolDef as { execute?: unknown } | undefined)?.execute;

              if (!isClientTool || !mastra || !tracingContext?.currentSpan) {
                return { toolDef };
              }

              const existingCarrier = clientToolObservabilityByToolCallId.get(toolCallId);
              if (existingCarrier) {
                payload.observability = existingCarrier.carrier;
                if (args !== undefined) {
                  endClientToolObservabilitySpan(toolCallId, args);
                }
                return { toolDef };
              }

              const proxy = (mastra as Mastra).observability?.getClientObservabilityProxy?.();
              if (!proxy) return { toolDef };

              try {
                const parentSpan =
                  tracingContext.currentSpan.type === ('agent_run' as string)
                    ? tracingContext.currentSpan
                    : ((tracingContext.currentSpan as any).findParent?.('agent_run') ?? tracingContext.currentSpan);
                const clientToolSpan = (parentSpan as any).createChildSpan?.({
                  type: 'client_tool_call',
                  name: `client_tool: '${toolName}'`,
                  entityType: EntityType.TOOL,
                  entityId: toolName,
                  entityName: toolName,
                  attributes: {
                    toolDescription: (toolDef as { description?: string } | undefined)?.description,
                    toolType: 'client-tool',
                  },
                  ...(args !== undefined ? { input: args } : {}),
                });
                if (clientToolSpan) {
                  const carrier = proxy.inject(clientToolSpan);
                  const entry = { carrier, span: clientToolSpan as AnySpan, ended: false };
                  clientToolObservabilityByToolCallId.set(toolCallId, entry);
                  payload.observability = carrier;
                  if (args !== undefined) {
                    endClientToolObservabilitySpan(toolCallId, args);
                  }
                }
              } catch (err) {
                logger?.warn?.('[ClientObservabilityProxy] failed to create CLIENT_TOOL_CALL span', {
                  error: err instanceof Error ? err.message : String(err),
                  toolName,
                });
              }

              return { toolDef };
            };

            // 8. Start MODEL_STEP span at the beginning of LLM execution
            modelSpanTracker?.startStep();

            // Apply post-processor request-side context to MODEL_INFERENCE then
            // open the inference span immediately before the model call so its
            // startTime excludes any input processor work and availableTools /
            // toolChoice reflect per-step mutations. responseFormat tracks the
            // actual structuredOutput payload sent to execute() — which is
            // undefined when structuringModelConfig routes through a separate
            // structuring step instead of asking the model for json_schema.
            modelSpanTracker?.setInferenceContext?.({
              parameters: currentModelSettings as Record<string, unknown> | undefined,
              providerOptions: currentProviderOptions as Record<string, unknown> | undefined,
              availableTools: getStepAvailableToolNames(
                currentTools as Record<string, unknown> | undefined,
                currentActiveTools,
              ),
              toolChoice: currentToolChoice,
              responseFormat: structuredOutput ? 'json_schema' : undefined,
            });
            modelSpanTracker?.startInference?.();

            // Collect chunks for the processLLMResponse hook (pairs with
            // processLLMRequest — lets processors like ResponseCache persist
            // the model's response). Only populated when there's no cache hit.
            const collectedChunks: Array<{ type: string; payload: unknown }> = [];

            // 10. Execute LLM call (or replay cached response)
            let modelResult: ReturnType<typeof execute>;
            if (cachedResponse) {
              // Short-circuit: replay cached chunks instead of calling the model.
              // Output processors are skipped on cache hit because the cached
              // chunks already reflect their effects from the original call.
              warnings = cachedResponse.warnings ?? [];
              request = cachedResponse.request ?? {};
              rawResponse = cachedResponse.rawResponse;
              modelSpanTracker?.updateStep?.({
                request: request || {},
                inputMessages,
                warnings: warnings || [],
                messageId: currentMessageId,
              });
              const replayChunks = cachedResponse.chunks;
              modelResult = new ReadableStream({
                start(ctrl) {
                  for (const chunk of replayChunks) {
                    ctrl.enqueue({
                      ...chunk,
                      runId,
                      from: ChunkFrom.AGENT,
                    });
                  }
                  ctrl.close();
                },
              }) as unknown as ReturnType<typeof execute>;
            } else {
              modelResult = execute({
                runId,
                model: currentModel,
                providerOptions: currentProviderOptions,
                inputMessages,
                tools: currentTools,
                toolChoice: currentToolChoice,
                activeTools: currentActiveTools,
                options: { abortSignal: executionAbortSignal },
                headers: mergeLlmCallHeaders({
                  memoryHeaders: buildMemoryHeaders({
                    threadId: typedInput.state?.threadId,
                    resourceId: typedInput.state?.resourceId,
                  }),
                  modelConfigHeaders: resolvedModelList?.find(m => m.id === modelEntry.id)?.headers,
                  callTimeHeaders:
                    registryEntry?.callTimeHeaders || currentModelSettings.headers
                      ? {
                          ...(registryEntry?.callTimeHeaders as Record<string, string> | undefined),
                          ...(currentModelSettings.headers as Record<string, string> | undefined),
                        }
                      : undefined,
                }),
                modelSettings: {
                  ...currentModelSettings,
                  maxRetries: 0,
                },
                includeRawChunks: execOptions.includeRawChunks,
                methodType: 'stream',
                structuredOutput: structuredOutput as any,
                onResult: ({ warnings: w, request: r, rawResponse: rr }) => {
                  warnings = w || [];
                  request = r || {};
                  rawResponse = rr || {};
                  modelSpanTracker?.updateStep?.({ request, inputMessages, warnings, messageId: currentMessageId });
                },
              });
            }

            // 10. Create output stream to process chunks
            // Note: We cast through any to handle the web/node ReadableStream type mismatch
            const outputStream = new MastraModelOutput({
              model: {
                modelId: currentModel.modelId,
                provider: currentModel.provider,
                version: currentModel.specificationVersion,
              },
              stream: modelResult as any,
              messageList,
              messageId: currentMessageId,
              options: {
                runId,
                tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext,
                requestContext,
              },
            });

            // 11. Process the stream and emit chunks via pubsub.
            // The inner LLM stream emits 'finish' but never 'step-finish' (durable calls
            // `execute` directly). Rewrite 'finish' -> 'step-finish' before the tracker so
            // MODEL_STEP / MODEL_INFERENCE close and the client buffers the step.
            const baseStream = outputStream._getBaseStream();
            const stepBoundaryStream = (baseStream as ReadableStream<any>).pipeThrough(
              new TransformStream<any, any>({
                transform(chunk, controller) {
                  if (chunk?.type === 'finish') {
                    controller.enqueue({ ...chunk, type: 'step-finish' });
                  } else {
                    controller.enqueue(chunk);
                  }
                },
              }),
            );
            // Wrap with ModelSpanTracker to create/close MODEL_STEP and MODEL_CHUNK spans
            const trackedStream = modelSpanTracker?.wrapStream(stepBoundaryStream) ?? stepBoundaryStream;

            try {
              let stepStartEmitted = false;
              for await (const rawChunk of trackedStream) {
                if (!rawChunk) continue;

                // Emit step-start before the first stream chunk so the
                // ordering matches the regular agent: start → step-start → response-metadata → …
                // onResult has already fired by the time the first chunk arrives,
                // so `request` and `warnings` are populated.
                if (!stepStartEmitted && pubsub) {
                  stepStartEmitted = true;
                  await emitStepStartEvent(pubsub, runId, {
                    stepId: DurableStepIds.LLM_EXECUTION,
                    request,
                    warnings,
                  });
                }

                // Enrich tool-related chunks with the in-process payload transform
                // policy (mirrors the non-durable agentic-execution layer). The
                // policy lives on the run registry; serializable `targets` shadow
                // travels with the workflow input. No-op for non-tool chunks or
                // when no policy is configured for this run.
                //
                // IMPORTANT: the transformed chunk is only used for client-facing
                // emission. Internal tool-call state (args persisted into
                // `toolCalls`, downstream tool execution) MUST be built from the
                // untransformed `rawChunk` so display-layer redactions/rewrites
                // do not leak into actual tool inputs.
                //
                // Use the per-step `currentTools` (post-`prepareStep` and input
                // processors) rather than the registry-level tool list — that way
                // any tool-level `transformToolPayload` added or replaced for the
                // current step is honoured, instead of being silently skipped.
                const transformTools = currentTools as unknown as Record<string, CoreTool> | undefined;
                const clientChunk =
                  registryEntry?.toolPayloadTransform || transformTools
                    ? await applyToolPayloadTransformToChunk(rawChunk, {
                        policy: registryEntry?.toolPayloadTransform,
                        tools: transformTools,
                        logger: logger as any,
                      })
                    : rawChunk;

                // ── Client-tool observability injection ──
                // For tool-call streaming chunks, inject CLIENT_TOOL_CALL spans
                // and collect deltas so the span can be ended with parsed args.
                //
                // IMPORTANT: inject into `clientChunk.payload` (the published
                // chunk), not `rawChunk.payload`. When a payload transform is
                // active, `clientChunk` is a new object — mutating `rawChunk`
                // would lose the observability carrier on the wire.
                let toolInputStartToolDef: CoreTool | undefined;
                if (rawChunk.type === 'tool-call-input-streaming-start') {
                  ({ toolDef: toolInputStartToolDef } = injectClientToolObservability({
                    toolCallId: rawChunk.payload.toolCallId,
                    toolName: rawChunk.payload.toolName,
                    providerExecuted: rawChunk.payload.providerExecuted,
                    payload: (clientChunk as any).payload as Record<string, unknown> & { observability?: unknown },
                  }));
                  // Cache the resolved tool so subsequent delta chunks (which may
                  // carry only toolCallId, no toolName) can still find it.
                  if (toolInputStartToolDef) {
                    resolvedToolByCallId.set(rawChunk.payload.toolCallId, toolInputStartToolDef);
                  }
                } else if (rawChunk.type === 'tool-call-delta') {
                  const toolCallId = rawChunk.payload.toolCallId;
                  if (toolCallId && rawChunk.payload.argsTextDelta) {
                    const deltas = clientToolArgsTextByToolCallId.get(toolCallId) ?? [];
                    deltas.push(rawChunk.payload.argsTextDelta);
                    clientToolArgsTextByToolCallId.set(toolCallId, deltas);
                  }
                } else if (rawChunk.type === 'tool-call-input-streaming-end') {
                  const parsedArgs = parseClientToolArgsFromDeltas(rawChunk.payload.toolCallId);
                  if (parsedArgs !== undefined) {
                    endClientToolObservabilitySpan(rawChunk.payload.toolCallId, parsedArgs);
                  }
                } else if (rawChunk.type === 'tool-call') {
                  injectClientToolObservability({
                    toolCallId: rawChunk.payload.toolCallId,
                    toolName: rawChunk.payload.toolName,
                    args: rawChunk.payload.args,
                    providerExecuted: rawChunk.payload.providerExecuted,
                    payload: (clientChunk as any).payload as Record<string, unknown> & { observability?: unknown },
                  });
                }

                // Forward every chunk to the client ('finish' was rewritten to 'step-finish' above).
                // Skip 'error' chunks — they are handled internally by the retry/fallback
                // logic and must not be emitted to the client stream. When all models are
                // exhausted the fatal error is propagated via emitError (mirrors the regular
                // agent's deferredErrorChunk pattern).
                if (pubsub && rawChunk.type !== 'error') {
                  await emitChunkEvent(pubsub, runId, clientChunk);
                }

                // Collect every chunk for post-stream processLLMResponse hook.
                // Skipped on cache hit because the processor already handled
                // the original response, and skipped when no request/response
                // processors exist to avoid buffering the entire stream in memory.
                if (!cachedResponse && requestStepRunner) {
                  collectedChunks.push({
                    type: rawChunk.type,
                    payload: 'payload' in rawChunk ? rawChunk.payload : undefined,
                  });
                }

                // Process different chunk types — always from the raw chunk so
                // internal state (tool args, finish reason, usage, metadata) is
                // never affected by display-layer transforms.
                switch (rawChunk.type) {
                  case 'text-delta': {
                    const payload = rawChunk.payload as TextDeltaPayload;
                    textDeltas.push(payload.text);
                    break;
                  }

                  case 'tool-call-input-streaming-start': {
                    const tool = toolInputStartToolDef || resolveToolDef(rawChunk.payload.toolName);
                    if (tool && 'onInputStart' in tool) {
                      try {
                        // Pass the actual prompt sent to the model (post-processLLMRequest
                        // rewrites) instead of rebuilding from messageList, which would
                        // drop any transient prompt modifications made by input processors.
                        await (tool as any).onInputStart?.({
                          toolCallId: rawChunk.payload.toolCallId,
                          messages: inputMessages,
                          abortSignal: executionAbortSignal,
                        });
                      } catch (error) {
                        logger?.error?.('Error calling onInputStart', error);
                      }
                    }
                    break;
                  }

                  case 'tool-call-delta': {
                    // Prefer the cached tool resolved during the preceding start chunk.
                    // Fall back to toolName-based resolution for completeness.
                    const tool =
                      resolvedToolByCallId.get(rawChunk.payload.toolCallId) ??
                      (rawChunk.payload.toolName ? resolveToolDef(rawChunk.payload.toolName) : undefined);
                    if (tool && 'onInputDelta' in tool) {
                      try {
                        await (tool as any).onInputDelta?.({
                          inputTextDelta: rawChunk.payload.argsTextDelta,
                          toolCallId: rawChunk.payload.toolCallId,
                          messages: inputMessages,
                          abortSignal: executionAbortSignal,
                        });
                      } catch (error) {
                        logger?.error?.('Error calling onInputDelta', error);
                      }
                    }
                    break;
                  }

                  case 'tool-call': {
                    const payload = rawChunk.payload as ToolCallPayload;
                    toolCalls.push({
                      toolCallId: payload.toolCallId,
                      toolName: payload.toolName,
                      args: payload.args || {},
                      providerMetadata: payload.providerMetadata as Record<string, unknown> | undefined,
                      providerExecuted: payload.providerExecuted,
                      output: payload.output,
                      activeTools: currentActiveTools ?? null,
                    });
                    break;
                  }

                  case 'step-finish': {
                    const payload = rawChunk.payload as any;
                    // The terminal chunk (rewritten from 'finish' above) carries finishReason
                    // in stepResult.reason and usage in output.usage.
                    finishReason = payload.stepResult?.reason || payload.finishReason || 'stop';
                    usage = payload.output?.usage || payload.usage || usage;
                    break;
                  }

                  case 'response-metadata': {
                    const payload = rawChunk.payload as any;
                    responseMetadata = {
                      id: payload.id,
                      timestamp: payload.timestamp,
                      modelId: payload.modelId,
                      headers: payload.headers,
                    };
                    break;
                  }

                  case 'error': {
                    const payload = rawChunk.payload as any;
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

              const errorObj = error instanceof Error ? error : new Error(String(error));
              if (modelSpanTracker) {
                modelSpanTracker.reportGenerationError({ error: errorObj });
              } else if (modelSpan) {
                modelSpan.error({ error: errorObj });
              }

              // If this error was triggered by abortSignal cancellation, surface an
              // abort event to the client so onAbort callbacks fire and bail out
              // of the entire fallback/retry flow — a confirmed abort should not
              // trigger retries on the same model nor fall through to other
              // models. We deliberately avoid matching on arbitrary error message
              // text (e.g. /abort/i) because that can fire for retryable provider
              // errors whose message happens to mention "abort"; we only trust
              // the canonical AbortError name or an actual aborted signal.
              const isAbort = executionAbortSignal?.aborted === true || errorObj.name === 'AbortError';
              if (isAbort) {
                if (pubsub) {
                  await emitAbortEvent(pubsub, runId, { steps: [] });
                }
                // Re-throw so the outer fallback catch also bypasses retry /
                // processAPIError and terminates the step cleanly.
                throw errorObj;
              }

              lastError = errorObj;

              // Try processAPIError before deciding retry/break
              const registryEntryInner = globalRunRegistry.get(runId);
              const canRetryErrorInner = maxProcessorRetries !== undefined && processorRetryCount < maxProcessorRetries;
              if (registryEntryInner?.errorProcessors?.length && canRetryErrorInner) {
                try {
                  const runner = new ProcessorRunner({
                    inputProcessors: registryEntryInner.inputProcessors ?? [],
                    outputProcessors: registryEntryInner.outputProcessors ?? [],
                    errorProcessors: registryEntryInner.errorProcessors,
                    logger: logger as any,
                    agentName: typedInput.agentName ?? typedInput.agentId,
                    processorStates: registryEntryInner.processorStates,
                  });
                  const currentMessageList = new MessageList();
                  currentMessageList.deserialize(typedInput.messageListState);
                  const { retry } = await runner.runProcessAPIError({
                    error: lastError,
                    messages: currentMessageList.get.all.db(),
                    messageList: currentMessageList,
                    stepNumber: (inputData as any).stepIndex ?? 0,
                    steps: (inputData as any).accumulatedSteps ?? [],
                    retryCount: processorRetryCount,
                    requestContext,
                  });
                  if (retry) {
                    processorRetryCount++;
                    // Error processor retry should NOT consume a model retry attempt.
                    // Decrement attempt so the `for` loop increment restores it.
                    attempt--;
                    continue;
                  }
                } catch (processorError) {
                  logger?.debug?.(`processAPIError handler failed: ${processorError}`, { runId });
                }
              }

              if (attempt < maxRetries) continue; // retry same model
              break; // exhausted retries, try next model
            }

            // Check if the stream captured an error (MastraModelOutput swallows errors internally)
            const streamError = outputStream.error;
            if (streamError) {
              const streamErrorObj = streamError instanceof Error ? streamError : new Error(String(streamError));
              logger?.error?.('Stream captured error', { error: streamErrorObj, runId });

              if (modelSpanTracker) {
                modelSpanTracker.reportGenerationError({ error: streamErrorObj });
              } else if (modelSpan) {
                modelSpan.error({ error: streamErrorObj });
              }

              // Mirror the iterator catch: a captured stream error that turns out
              // to be a confirmed abort must short-circuit retry/fallback and
              // publish the abort event so the client bridge closes cleanly.
              const isStreamErrorAbort = executionAbortSignal?.aborted === true || streamErrorObj.name === 'AbortError';
              if (isStreamErrorAbort) {
                if (pubsub) {
                  await emitAbortEvent(pubsub, runId, { steps: [] });
                }
                throw streamErrorObj;
              }

              lastError = streamErrorObj;
              if (attempt < maxRetries) continue; // retry same model
              break; // exhausted retries, try next model
            }

            // Run `processLLMResponse` for any input processors that implement
            // it. Pairs with `processLLMRequest`: lets a processor write the
            // response to a cache (or sink) using state stashed in the request
            // hook. Skipped on cache hit — that response did not come from the
            // model, so writing it back would just rewrite the same value.
            // Mirrors loop/workflows/agentic-execution/llm-execution-step.ts.
            if (!cachedResponse && requestStepRunner) {
              try {
                await requestStepRunner.runProcessLLMResponse({
                  chunks: collectedChunks,
                  model: currentModel,
                  stepNumber: (inputData as any).accumulatedSteps?.length ?? 0,
                  steps: (inputData as any).accumulatedSteps ?? [],
                  warnings,
                  request,
                  rawResponse,
                  fromCache: false,
                  retryCount: (inputData as any).processorRetryCount ?? 0,
                  requestContext,
                  tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext,
                  writer: requestStepWriter,
                  abortSignal: executionAbortSignal,
                });
              } catch (error) {
                if (error instanceof TripWire) {
                  logger?.warn?.('Streaming response processor tripwire triggered', {
                    reason: error.message,
                    processorId: error.processorId,
                    retry: error.options?.retry,
                  });
                  if (pubsub) {
                    await emitChunkEvent(pubsub, runId, {
                      type: 'tripwire',
                      runId,
                      from: ChunkFrom.AGENT,
                      payload: {
                        processorId: error.processorId,
                        reason: error.message,
                        retry: error.options?.retry,
                        metadata: error.options?.metadata,
                      },
                    });
                  }
                  return {
                    messageListState: messageList.serialize(),
                    text: textDeltas.join(''),
                    toolCalls: [],
                    stepResult: {
                      reason: 'tripwire' as const,
                      warnings,
                      isContinued: false,
                    },
                    metadata: {
                      modelId: currentModel.modelId,
                    },
                    state: typedInput.state,
                  } satisfies DurableLLMStepOutput;
                }
                logger?.error?.('Error in processLLMResponse processors:', error);
                throw error;
              }
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
                id: currentMessageId,
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

            // 13.5. Run processOutputStep for output processors (runs AFTER LLM response, BEFORE tool execution)
            // Mirrors the regular agent's llm-execution-step.ts processOutputStep call
            if (registryEntry?.outputProcessors && registryEntry.outputProcessors.length > 0) {
              const outputStepRunner = new ProcessorRunner({
                inputProcessors: [],
                outputProcessors: registryEntry.outputProcessors,
                logger: logger as any,
                agentName: typedInput.agentName ?? typedInput.agentId,
                processorStates: registryEntry?.processorStates,
              });

              const toolCallInfos = toolCalls.map(tc => ({
                toolName: tc.toolName,
                toolCallId: tc.toolCallId,
                args: tc.args,
              }));

              const outputStepWriter = pubsub
                ? {
                    custom: async (data: { type: string }) => {
                      await emitChunkEvent(pubsub, runId, data as any);
                    },
                  }
                : undefined;

              try {
                await outputStepRunner.runProcessOutputStep({
                  steps: (inputData as any).accumulatedSteps ?? [],
                  messages: messageList.get.all.db(),
                  messageList,
                  stepNumber: (inputData as any).accumulatedSteps?.length ?? 0,
                  finishReason,
                  providerMetadata: responseMetadata,
                  toolCalls: toolCallInfos.length > 0 ? toolCallInfos : undefined,
                  text: textDeltas.join(''),
                  usage,
                  requestContext,
                  writer: outputStepWriter,
                });
              } catch (error) {
                if (error instanceof TripWire) {
                  // Emit tripwire chunk and return bail response
                  if (pubsub) {
                    await emitChunkEvent(pubsub, runId, {
                      type: 'tripwire',
                      runId,
                      from: ChunkFrom.AGENT,
                      payload: {
                        reason: error.message,
                        processorId: error.processorId,
                        metadata: error.options?.metadata,
                      },
                    });
                  }
                  return {
                    messageListState: messageList.serialize(),
                    text: '',
                    toolCalls: [],
                    stepResult: {
                      reason: 'tripwire' as any,
                      warnings: [],
                      isContinued: false,
                    },
                    metadata: { modelId: currentModel.modelId },
                    state: typedInput.state,
                  };
                }
                throw error;
              }
            }

            // 14. Export spans if there are tool calls (so tools can be children of model_step)
            // Don't end the spans yet - they will be ended after tool execution
            const stepSpanData = hasToolCalls ? modelSpanTracker?.exportCurrentStep() : undefined;
            const stepFinishPayload = hasToolCalls ? modelSpanTracker?.getPendingStepFinishPayload() : undefined;

            // 15. Build output
            const output: DurableLLMStepOutput = {
              messageListState: messageList.serialize(),
              text: textDeltas.join(''),
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
                modelId: responseMetadata.modelId || currentModel.modelId,
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
            // TripWire errors from processLLMRequest / processLLMResponse are
            // guardrail/cache processor decisions, not model failures. They
            // must not be retried or fall back to the next model.
            if (error instanceof TripWire) {
              throw error;
            }

            lastError = error instanceof Error ? error : new Error(String(error));

            // Confirmed aborts bypass all retry / fallback / processAPIError
            // handling — the user (or upstream caller) explicitly cancelled the
            // run and we must terminate immediately rather than burning more
            // attempts or paying for fallback model calls. Re-derive the signal
            // from the registry (the inner try-scoped `executionAbortSignal` is
            // out of scope here).
            const outerRegistryEntry = globalRunRegistry.get(runId);
            const outerAbortSignal = outerRegistryEntry?.abortSignal ?? abortSignal;
            const isAbort = outerAbortSignal?.aborted === true || lastError.name === 'AbortError';
            if (isAbort) {
              throw lastError;
            }

            const modelId = modelEntry.config.modelId;
            logger?.error?.(`Error executing model ${modelId}, attempt ${attempt + 1}/${maxRetries + 1}`, {
              error: lastError,
              runId,
              modelIndex,
              attempt,
            });

            // Error processor retry for non-stream errors (e.g. provider
            // rejections that throw before the stream opens). Stream-level
            // errors are already handled in the inner catch above.
            const registryEntry = globalRunRegistry.get(runId);
            const canRetryError = maxProcessorRetries !== undefined && processorRetryCount < maxProcessorRetries;
            if (registryEntry?.errorProcessors?.length && canRetryError) {
              try {
                const runner = new ProcessorRunner({
                  inputProcessors: registryEntry.inputProcessors ?? [],
                  outputProcessors: registryEntry.outputProcessors ?? [],
                  errorProcessors: registryEntry.errorProcessors,
                  logger: logger as any,
                  agentName: typedInput.agentName ?? typedInput.agentId,
                  processorStates: registryEntry.processorStates,
                });
                const currentMessageList = new MessageList();
                currentMessageList.deserialize(typedInput.messageListState);
                const { retry } = await runner.runProcessAPIError({
                  error: lastError,
                  messages: currentMessageList.get.all.db(),
                  messageList: currentMessageList,
                  stepNumber: (inputData as any).stepIndex ?? 0,
                  steps: (inputData as any).accumulatedSteps ?? [],
                  retryCount: processorRetryCount,
                  requestContext,
                });
                if (retry) {
                  processorRetryCount++;
                  // Error processor retry should NOT consume a model retry attempt.
                  attempt--;
                  continue;
                }
              } catch (processorError) {
                logger?.debug?.(`processAPIError handler failed: ${processorError}`, { runId });
              }
            }

            if (attempt >= maxRetries) {
              logger?.debug?.(`Exhausted retries for model ${modelId}, trying next model`, { runId });
              break;
            }

            const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
            logger?.debug?.(`Retrying model ${modelId} after ${delayMs}ms`, { runId, attempt });
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } // end retry loop
      } // end model loop

      // All models exhausted - emit error + step-finish chunks and return a bail response.
      // This mirrors the regular agent which sets stepResult.reason = 'error' and emits
      // a deferred error chunk rather than crashing the loop.
      const fatalError =
        lastError ?? new Error('Exhausted all fallback models and reached the maximum number of retries.');

      // End the root spans here too — this is the only error path that covers EventedAgent,
      // whose fire-and-forget launch never sees the failure (so emitError never runs).
      endRunSpansWithError(runId, fatalError);

      // Emit the deferred error chunk so consumers see it
      if (pubsub) {
        await emitChunkEvent(pubsub, runId, {
          type: 'error',
          runId,
          from: ChunkFrom.AGENT,
          payload: { error: fatalError },
        });

        // Emit step-finish so MastraModelOutput resolves finishReason to 'error'
        await emitChunkEvent(pubsub, runId, {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: {
              reason: 'error',
              isContinued: false,
            },
            output: {
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            },
            metadata: {},
          },
        });
      }

      const modelId = modelList[0]?.id ?? 'unknown';
      return {
        messageListState: messageList.serialize(),
        text: '',
        toolCalls: [],
        stepResult: {
          reason: 'error' as any,
          warnings: [],
          isContinued: false,
        },
        metadata: { modelId },
        state: typedInput.state,
      };
    },
  });
}
