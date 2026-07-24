import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import { mergeProviderOptions } from '../../../../llm/model/provider-options';
import type { SharedProviderOptions } from '../../../../llm/model/shared.types';
import { ConsoleLogger } from '../../../../logger';
import { applyAutoResumeSystemMessage } from '../../../../loop/shared/auto-resume-system-message';
import { buildLlmPromptArgs } from '../../../../loop/shared/build-llm-prompt-args';
import { composeStepInput } from '../../../../loop/shared/compose-step-input';
import { injectBackgroundTaskPrompt } from '../../../../loop/shared/inject-background-task-prompt';
import { buildMemoryHeaders, mergeLlmCallHeaders } from '../../../../loop/shared/merge-llm-call-headers';
import { buildMessagesFromChunks } from '../../../../loop/workflows/agentic-execution/build-messages-from-chunks';
import type { CollectedChunk } from '../../../../loop/workflows/agentic-execution/build-messages-from-chunks';
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
import type { ChunkType, TextDeltaPayload, ToolCallPayload } from '../../../../stream/types';
import { ChunkFrom } from '../../../../stream/types';
import { findProviderToolByName, inferProviderExecuted } from '../../../../tools/provider-tool-utils';
import type { ToolToConvert } from '../../../../tools/tool-builder/builder';
import { isMastraTool } from '../../../../tools/toolchecks';
import type { CoreTool } from '../../../../tools/types';
import { createMastraProxy, makeCoreTool } from '../../../../utils';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { MessageList } from '../../../message-list';
import { TripWire } from '../../../trip-wire';
import { isSupportedLanguageModel } from '../../../utils';
import { DurableStepIds } from '../../constants';
import { endRunSpansWithError, globalRunRegistry } from '../../run-registry';
import { emitChunkEvent, emitStepStartEvent } from '../../stream-adapter';
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

      const {
        messageList,
        tools,
        model: resolvedModel,
        modelList: resolvedModelList,
        // Processors rebuilt from the agent when the per-process registry was
        // empty (cross-process worker). resolveRuntimeDependencies also writes
        // these back into globalRunRegistry, so `registryEntry?.inputProcessors`
        // below is populated too — these are the direct fallback if the entry is
        // evicted (TTL) or absent, restoring the SkillsProcessor /
        // WorkspaceInstructionsProcessor in the cross-process system prompt.
        inputProcessors: resolvedInputProcessors,
        llmRequestInputProcessors: resolvedLlmRequestInputProcessors,
        outputProcessors: resolvedOutputProcessors,
      } = resolved;

      // 1b. Check for abort signal before doing any work. If the signal is
      // already aborted (e.g. pre-aborted before the loop starts), return a
      // clean output so the dowhile predicate sees isContinued: false and
      // stops the loop. The FINISH event will be emitted by the finalization
      // block with stepResult.reason: 'abort' (set by the predicate's abort
      // guard). We intentionally do NOT emit an ABORT event here because
      // that would close the stream before the FINISH event arrives.
      const executionAbortSignalEarly = globalRunRegistry.get(runId)?.abortSignal ?? abortSignal;
      if (executionAbortSignalEarly?.aborted) {
        return {
          messageListState: messageList.serialize(),
          text: '',
          toolCalls: [],
          stepResult: {
            reason: 'abort' as any,
            warnings: [],
            isContinued: false,
          },
          metadata: {},
          state: typedInput.state,
        } satisfies DurableLLMStepOutput;
      }

      // 1c. Check for tripwire from processInput (initial input processing).
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
            const baseInputProcessors = registryEntry?.inputProcessors ?? resolvedInputProcessors ?? [];
            // Output processors likewise fall back to the rebuilt list when the
            // per-process registry is empty (cross-process worker).
            const effectiveOutputProcessors = registryEntry?.outputProcessors ?? resolvedOutputProcessors ?? [];
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
                outputProcessors: effectiveOutputProcessors,
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
                currentModelSettings = merged.modelSettings ?? {};
                structuredOutput = merged.structuredOutput;

                // Processors (e.g. ToolSearchProcessor) can inject per-step meta-tools
                // like `search_tools` / `load_tool`. In the non-durable Agent the same
                // step that shows these tools to the model also executes them, so a
                // per-step tool map is enough. The DurableAgent instead runs tool calls
                // in a SEPARATE workflow step that resolves tools from the run registry
                // (see tool-call.ts). Without a write-back, those processor-injected
                // tools are missing there and the call fails with ToolNotFoundError
                // (issue #19571).
                //
                // Convert any raw Mastra tools the processor returned into CoreTool form
                // (mirroring the non-durable llm-execution-step) and merge them into the
                // run registry so the durable tool-call step can resolve and execute them.
                if (processInputStepResult.tools) {
                  const boundLogger = logger || new ConsoleLogger({ level: 'error' });
                  const convertedTools: Record<string, CoreTool> = {};
                  for (const [name, tool] of Object.entries(currentTools as Record<string, unknown>)) {
                    if (isMastraTool(tool)) {
                      convertedTools[name] = makeCoreTool(
                        tool as unknown as ToolToConvert,
                        {
                          name,
                          runId,
                          threadId: typedInput.state?.threadId,
                          resourceId: typedInput.state?.resourceId,
                          logger: boundLogger,
                          mastra: mastra ? createMastraProxy({ mastra, logger: boundLogger }) : undefined,
                          memory: registryEntry?.memory,
                          agentName: typedInput.agentName ?? agentId,
                          requestContext,
                          workspace: registryEntry?.workspace,
                          requireApproval: (tool as any).requireApproval,
                          backgroundConfig: (tool as any).background,
                          // Emit context.writer.write() / .custom() output through pubsub,
                          // matching how the durable tool-call step builds its writer.
                          outputWriter: pubsub
                            ? async (chunk: any) => {
                                await emitChunkEvent(pubsub, runId, chunk as ChunkType);
                              }
                            : undefined,
                        },
                        undefined,
                        execOptions.autoResumeSuspendedTools,
                      );
                    } else {
                      convertedTools[name] = tool as CoreTool;
                    }
                  }
                  currentTools = convertedTools as unknown as ToolSet;
                  if (registryEntry) {
                    // Store the exact per-step snapshot rather than merging onto the
                    // previous step's set. `currentTools` already starts from the full
                    // toolset resolved at the top of this step, so a snapshot keeps the
                    // static tools while dropping processor-injected tools the current
                    // step no longer exposes (e.g. a ToolSearchProcessor entry that hit
                    // its TTL). Merging would leave those stale tools executable by the
                    // tool-call step even though the model was never shown them.
                    registryEntry.tools = convertedTools;
                  }
                }
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
            const allInputProcessors =
              registryEntry?.llmRequestInputProcessors ??
              registryEntry?.inputProcessors ??
              resolvedLlmRequestInputProcessors ??
              resolvedInputProcessors ??
              [];
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
            const providerToolSpansByToolCallId = new Map<string, { span: AnySpan; ended: boolean }>();

            const resolveToolDef = (toolName: string): CoreTool | undefined => {
              const directTool = (currentTools as unknown as Record<string, CoreTool> | undefined)?.[toolName];
              if (directTool) return directTool;
              const registryTool = registryEntry?.tools?.[toolName];
              if (registryTool) return registryTool;
              // Resolve provider tools by model-facing name (e.g. 'web_search' → provider tool with id 'anthropic.web_search').
              // Check both currentTools and registryEntry.tools to match the durable tool-call step's resolution.
              const providerTool = findProviderToolByName(currentTools as any, toolName) as CoreTool | undefined;
              if (providerTool) return providerTool;
              return findProviderToolByName(registryEntry?.tools as any, toolName) as CoreTool | undefined;
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

            const injectProviderToolObservability = ({
              toolCallId,
              toolName,
              args,
              providerExecuted,
            }: {
              toolCallId: string;
              toolName: string;
              args?: unknown;
              providerExecuted?: boolean;
            }) => {
              if (!tracingContext?.currentSpan) return;

              const toolDef = resolveToolDef(toolName);
              const inferredProviderExecuted = inferProviderExecuted(providerExecuted, toolDef);
              if (!inferredProviderExecuted) return;
              const existingEntry = providerToolSpansByToolCallId.get(toolCallId);
              if (existingEntry) {
                if (args !== undefined && existingEntry.span.input === undefined) {
                  (existingEntry.span as any).update?.({ input: args });
                }
                return;
              }

              try {
                const parentSpan =
                  tracingContext.currentSpan.type === ('agent_run' as string)
                    ? tracingContext.currentSpan
                    : ((tracingContext.currentSpan as any).findParent?.('agent_run') ?? tracingContext.currentSpan);

                const span = (parentSpan as any).createChildSpan?.({
                  type: 'provider_tool_call',
                  name: `provider_tool: '${toolName}'`,
                  entityType: EntityType.TOOL,
                  entityId: toolName,
                  entityName: toolName,
                  attributes: {
                    toolType: 'provider-tool',
                    toolDescription: (toolDef as { description?: string } | undefined)?.description,
                    toolCallId,
                  },
                  metadata: { toolCallId },
                  ...(args !== undefined ? { input: args } : {}),
                });

                if (span) {
                  providerToolSpansByToolCallId.set(toolCallId, { span: span as AnySpan, ended: false });
                }
              } catch (err) {
                logger?.warn?.('[ProviderToolObservability] failed to create PROVIDER_TOOL_CALL span', {
                  error: err instanceof Error ? err.message : String(err),
                  toolName,
                });
              }
            };

            const cleanupToolObservabilitySpans = () => {
              for (const [toolCallId, entry] of clientToolObservabilityByToolCallId.entries()) {
                if (!entry.ended) {
                  const parsedArgs = parseClientToolArgsFromDeltas(toolCallId);
                  entry.span.end(parsedArgs !== undefined ? { metadata: { args: parsedArgs } } : undefined);
                  entry.ended = true;
                }
              }
              clientToolArgsTextByToolCallId.clear();

              for (const [, entry] of providerToolSpansByToolCallId.entries()) {
                if (!entry.ended) {
                  entry.span.end();
                  entry.ended = true;
                }
              }
              providerToolSpansByToolCallId.clear();
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

            // Collect chunks for post-stream message building (via
            // buildMessagesFromChunks) and for the processLLMResponse hook
            // (pairs with processLLMRequest — lets processors like
            // ResponseCache persist the model's response). Always populated
            // so reasoning/text/tool parts are reconstructed in stream order,
            // including empty reasoning spans that carry providerMetadata
            // (e.g. OpenAI itemId) required by subsequent turns (#19365).
            const collectedChunks: CollectedChunk[] = [];

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
                    registryEntry?.callTimeHeaders || currentModelSettings?.headers
                      ? {
                          ...(registryEntry?.callTimeHeaders as Record<string, string> | undefined),
                          ...(currentModelSettings?.headers as Record<string, string> | undefined),
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

            let deferredStepFinishChunk: any = null;
            try {
              let stepStartEmitted = false;
              for await (const rawChunk of trackedStream) {
                if (!rawChunk) continue;

                // Mirror the regular agent: if the abort signal fired between
                // chunks, stop consuming the stream immediately so we don't
                // send additional data to the client after cancellation.
                if (executionAbortSignal?.aborted) break;

                // Emit step-start before the first stream chunk so the
                // ordering matches the regular agent: start → step-start → response-metadata → …
                // onResult has already fired by the time the first chunk arrives,
                // so `request` and `warnings` are populated.
                if (!stepStartEmitted && pubsub) {
                  stepStartEmitted = true;
                  await emitStepStartEvent(pubsub, runId, {
                    stepId: DurableStepIds.LLM_EXECUTION,
                    messageId: currentMessageId,
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
                  injectProviderToolObservability({
                    toolCallId: rawChunk.payload.toolCallId,
                    toolName: rawChunk.payload.toolName,
                    providerExecuted: rawChunk.payload.providerExecuted,
                  });
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
                  injectProviderToolObservability({
                    toolCallId: rawChunk.payload.toolCallId,
                    toolName: rawChunk.payload.toolName,
                    args: rawChunk.payload.args,
                    providerExecuted: rawChunk.payload.providerExecuted,
                  });
                }

                // Forward every chunk to the client ('finish' was rewritten to 'step-finish' above).
                // Skip 'error' chunks — they are handled internally by the retry/fallback
                // logic and must not be emitted to the client stream. When all models are
                // exhausted the fatal error is propagated via emitError (mirrors the regular
                // agent's deferredErrorChunk pattern).
                //
                // Defer 'step-finish': for intermediate steps (hasToolCalls) we save it
                // on the output so llm-mapping can emit it AFTER tool-result chunks,
                // matching the regular agent's ordering (tool-result → step-finish).
                // For final steps (no tool calls) we emit it after the assistant message
                // is added to messageList.
                if (pubsub && rawChunk.type !== 'error') {
                  if (rawChunk.type === 'step-finish') {
                    deferredStepFinishChunk = clientChunk;
                  } else {
                    await emitChunkEvent(pubsub, runId, clientChunk);
                  }
                }

                // Collect every chunk for post-stream message building and the
                // processLLMResponse hook. Always collect — reasoning parts
                // (including empty spans with providerMetadata carrying
                // OpenAI itemIds) are required to correctly reconstruct the
                // assistant message and preserve pairing with subsequent
                // tool-calls (#19365).
                collectedChunks.push({
                  type: rawChunk.type,
                  payload: 'payload' in rawChunk ? rawChunk.payload : undefined,
                  metadata: (rawChunk as { metadata?: Record<string, unknown> }).metadata,
                });

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

                  case 'tool-result': {
                    const payload = rawChunk.payload as any;
                    // Close PROVIDER_TOOL_CALL span if one was opened for this tool call
                    const providerEntry = providerToolSpansByToolCallId.get(payload.toolCallId);
                    if (providerEntry && !providerEntry.ended) {
                      providerEntry.span.end({
                        output: payload.result,
                        attributes: { success: !payload.isError },
                      });
                      providerEntry.ended = true;
                    } else if (!providerEntry && tracingContext?.currentSpan) {
                      // Deferred result: no span was opened in this step invocation.
                      // Only create a synthetic span if this is actually a provider-executed tool.
                      const resultToolDef2 = resolveToolDef(payload.toolName);
                      const isProviderExec = inferProviderExecuted(payload.providerExecuted, resultToolDef2);
                      if (!isProviderExec) break;

                      let spanInput = payload.args;
                      if (spanInput === undefined) {
                        // Fallback: find args from the tool-call already stored in messageList
                        const allMessages = messageList.get.all.db();
                        for (const msg of allMessages) {
                          if (!msg.content?.parts) continue;
                          for (const part of msg.content.parts) {
                            if (
                              part.type === 'tool-invocation' &&
                              part.toolInvocation?.toolCallId === payload.toolCallId
                            ) {
                              spanInput = part.toolInvocation.args;
                              break;
                            }
                          }
                          if (spanInput !== undefined) break;
                        }
                      }
                      injectProviderToolObservability({
                        toolCallId: payload.toolCallId,
                        toolName: payload.toolName,
                        args: spanInput,
                        providerExecuted: true,
                      });
                      const deferredEntry = providerToolSpansByToolCallId.get(payload.toolCallId);
                      if (deferredEntry && !deferredEntry.ended) {
                        deferredEntry.span.end({
                          output: payload.result,
                          attributes: { success: !payload.isError },
                        });
                        deferredEntry.ended = true;
                      }
                    }
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
              // Clean up any unclosed observability spans after successful stream completion
              cleanupToolObservabilitySpans();
            } catch (error) {
              cleanupToolObservabilitySpans();
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
                // Return a clean output instead of throwing so the workflow
                // engine doesn't crash. The dowhile predicate will see
                // isContinued: false and stop the loop. The FINISH event
                // (emitted by the finalization block) will carry reason: 'abort'.
                return {
                  messageListState: messageList.serialize(),
                  text: textDeltas.join(''),
                  toolCalls: [],
                  stepResult: {
                    reason: 'abort' as any,
                    warnings: [],
                    isContinued: false,
                  },
                  metadata: { modelId: currentModel.modelId },
                  state: typedInput.state,
                } satisfies DurableLLMStepOutput;
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
              // to be a confirmed abort must short-circuit retry/fallback.
              const isStreamErrorAbort = executionAbortSignal?.aborted === true || streamErrorObj.name === 'AbortError';
              if (isStreamErrorAbort) {
                return {
                  messageListState: messageList.serialize(),
                  text: textDeltas.join(''),
                  toolCalls: [],
                  stepResult: {
                    reason: 'abort' as any,
                    warnings: [],
                    isContinued: false,
                  },
                  metadata: { modelId: currentModel.modelId },
                  state: typedInput.state,
                } satisfies DurableLLMStepOutput;
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

            // 12. Add assistant response to message list.
            // Build parts from the full chunk sequence via the same helper
            // the regular Agent uses, so reasoning spans (including empty
            // reasoning with providerMetadata.openai.itemId) are preserved
            // alongside text and tool-calls in stream order. Without this
            // OpenAI reasoning models fail on the next turn with
            // "Item 'fc_...' of type 'function_call' was provided without
            // its required 'reasoning' item" (#19365).
            //
            // Mirror the regular Agent's buildResponseModelMetadata so the
            // persisted assistant message carries the same content.metadata
            // (modelId/provider): prefer the static model, fall back to the
            // response-metadata chunk.
            const responseModelId = currentModel.modelId ?? responseMetadata?.modelId;
            const responseModelMetadata =
              responseModelId || currentModel.provider
                ? {
                    metadata: {
                      ...(responseModelId ? { modelId: responseModelId } : {}),
                      ...(currentModel.provider ? { provider: currentModel.provider } : {}),
                    },
                  }
                : undefined;
            const builtMessages = buildMessagesFromChunks({
              chunks: collectedChunks,
              messageId: currentMessageId,
              tools: currentTools,
              responseModelMetadata,
            });
            if (builtMessages.length > 0) {
              for (const msg of builtMessages) {
                messageList.add(msg, 'response');
              }

              // Sync the updated messageList to the in-process registry so
              // downstream steps (e.g. tool-call.ts's doFlush()) see the
              // assistant message when persisting before suspension.
              if (registryEntry) {
                registryEntry.messageList = messageList;
              }
            }

            // 13. Determine if we should continue (has tool calls)
            const isContinued = toolCalls.length > 0 && finishReason !== 'stop';
            const hasToolCalls = toolCalls.length > 0;

            // 13.5. Run processOutputStep for output processors (runs AFTER LLM response, BEFORE tool execution)
            // Mirrors the regular agent's llm-execution-step.ts processOutputStep call
            if (effectiveOutputProcessors.length > 0) {
              const outputStepRunner = new ProcessorRunner({
                inputProcessors: [],
                outputProcessors: effectiveOutputProcessors,
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
                  tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext,
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

            // 13.9. step-finish emission strategy:
            //
            // For FINAL steps (no tool calls): emit step-finish now. The assistant
            // message is in messageList and there are no tool-results to wait for.
            //
            // For INTERMEDIATE steps (hasToolCalls): save the step-finish chunk
            // on the output so llm-mapping can emit it AFTER tool-call.ts has
            // emitted tool-result chunks. This matches the regular agent's chunk
            // ordering (tool-result → step-finish) which MastraModelOutput relies
            // on for correct step content reconstruction.
            if (pubsub && deferredStepFinishChunk) {
              if (!hasToolCalls) {
                // Final step: emit immediately with pre-computed content
                // Build step content directly from the current step's data rather
                // than relying on messageList which may contain response messages
                // from previous iterations after deserialization.
                const stepContent: Array<{ type: string; [key: string]: unknown }> = [];
                const currentText = textDeltas.join('');
                if (currentText) {
                  stepContent.push({ type: 'text', text: currentText });
                }
                deferredStepFinishChunk = {
                  ...deferredStepFinishChunk,
                  payload: {
                    ...deferredStepFinishChunk.payload,
                    _durableStepContent: stepContent,
                  },
                };
                await emitChunkEvent(pubsub, runId, deferredStepFinishChunk);
                deferredStepFinishChunk = null;
              }
              // else: intermediate step — saved in output.deferredStepFinishChunk below
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
              // For intermediate steps (hasToolCalls), save the deferred step-finish
              // chunk so llm-mapping can emit it AFTER tool-result chunks.
              deferredStepFinishChunk: hasToolCalls ? deferredStepFinishChunk : undefined,
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
              // Return a clean output instead of throwing so the workflow
              // engine doesn't crash. The abort event was already emitted
              // by the inner catch.
              return {
                messageListState: messageList.serialize(),
                text: '',
                toolCalls: [],
                stepResult: {
                  reason: 'abort' as any,
                  warnings: [],
                  isContinued: false,
                },
                metadata: { modelId: modelEntry.config.modelId },
                state: typedInput.state,
              } satisfies DurableLLMStepOutput;
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
                  tracingContext,
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
