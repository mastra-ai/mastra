import { ReadableStream } from 'node:stream/web';
import { isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2Usage } from '@ai-sdk/provider-v5';
import { APICallError, generateId } from '@internal/ai-sdk-v5';
import type { CallSettings, ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import type { StructuredOutputOptions } from '../../../agent';
import type { MessageList } from '../../../agent/message-list';
import type { CreatedAgentSignal } from '../../../agent/signals';
import { TripWire } from '../../../agent/trip-wire';
import { isSupportedLanguageModel, supportedLanguageModelSpecifications } from '../../../agent/utils';
import { generateBackgroundTaskSystemPrompt } from '../../../background-tasks';
import { getErrorFromUnknown } from '../../../error/utils.js';
import { mergeProviderOptions } from '../../../llm/model/provider-options';
import { ModelRouterLanguageModel } from '../../../llm/model/router';
import type { MastraLanguageModel, SharedProviderOptions } from '../../../llm/model/shared.types';
import type { IMastraLogger } from '../../../logger';
import { ConsoleLogger } from '../../../logger';
import { createObservabilityContext, SpanType } from '../../../observability';
import type { ModelInferenceContext } from '../../../observability';
import { executeWithContextSync, getStepAvailableToolNames } from '../../../observability/utils';
import type { CachedLLMStepResponse, InputProcessorOrWorkflow, ProcessorStreamWriter } from '../../../processors/index';
import { isProcessorWorkflow } from '../../../processors/index';
import { PrepareStepProcessor } from '../../../processors/processors/prepare-step';
import { ProcessorRunner } from '../../../processors/runner';
import { RequestContext } from '../../../request-context';
import { execute } from '../../../stream/aisdk/v5/execute';
import { DefaultStepResult } from '../../../stream/aisdk/v5/output-helpers';
import { safeEnqueue } from '../../../stream/base';
import { MastraModelOutput } from '../../../stream/base/output';
import type {
  ChunkType,
  ExecuteStreamModelManager,
  ModelManagerModelConfig,
  StreamChunkType,
  StreamTransport,
  StreamTransportRef,
} from '../../../stream/types';
import { ChunkFrom, readModelStreamTransport } from '../../../stream/types';
import {
  transformToolPayloadForTargets,
  withToolPayloadTransformMetadata,
  withToolPayloadTransformProviderMetadata,
} from '../../../tools/payload-transform';
import { findProviderToolByName, inferProviderExecuted } from '../../../tools/provider-tool-utils';
import type { ToolToConvert } from '../../../tools/tool-builder/builder';
import { isMastraTool } from '../../../tools/toolchecks';
import { makeCoreTool } from '../../../utils';
import { createStep } from '../../../workflows';
import type { Workspace } from '../../../workspace/workspace';
import type { LoopConfig, OuterLLMRun } from '../../types';
import { AgenticRunState } from '../run-state';
import { llmIterationOutputSchema } from '../schema';
import { buildMessagesFromChunks } from './build-messages-from-chunks';
import type { CollectedChunk } from './build-messages-from-chunks';
import { resolveConfiguredToolCallConcurrency, updateToolCallForeachConcurrency } from './tool-call-concurrency';
import type { ToolCallForeachOptions } from './tool-call-concurrency';

function getRequestInputProcessors({
  inputProcessors,
  llmRequestInputProcessors,
}: {
  inputProcessors?: InputProcessorOrWorkflow[];
  llmRequestInputProcessors?: InputProcessorOrWorkflow[];
}): InputProcessorOrWorkflow[] {
  if (!llmRequestInputProcessors?.length) {
    return inputProcessors || [];
  }

  if (!inputProcessors?.length) {
    return llmRequestInputProcessors;
  }

  const requestProcessorIds = new Set(
    llmRequestInputProcessors.filter(processor => !isProcessorWorkflow(processor)).map(processor => processor.id),
  );
  const additionalInputProcessors = inputProcessors.filter(
    processor => !isProcessorWorkflow(processor) && !requestProcessorIds.has(processor.id),
  );

  return additionalInputProcessors.length
    ? [...llmRequestInputProcessors, ...additionalInputProcessors]
    : llmRequestInputProcessors;
}

type ProcessOutputStreamResult = {
  collectedChunks: CollectedChunk[];
  interjectedSignals: CreatedAgentSignal[];
};

type ProcessOutputStreamOptions<OUTPUT = undefined> = {
  tools?: ToolSet;
  runId: string;
  messageId: string;
  includeRawChunks?: boolean;
  messageList: MessageList;
  outputStream: MastraModelOutput<OUTPUT>;
  runState: AgenticRunState;
  options?: LoopConfig<OUTPUT>;
  controller: ReadableStreamDefaultController<StreamChunkType<OUTPUT>>;
  responseFromModel: {
    warnings: any;
    request: any;
    rawResponse: any;
  };
  logger?: IMastraLogger;
  drainPendingSignals?: (runId: string) => CreatedAgentSignal[];
  transportRef?: StreamTransportRef;
  transportResolver?: () => StreamTransport | undefined;
  toolPayloadTransform?: NonNullable<OuterLLMRun['_internal']>['toolPayloadTransform'];
};

async function addToolPayloadTransformToChunk<OUTPUT>(
  chunk: ChunkType<OUTPUT>,
  {
    tools,
    policy,
    logger,
  }: {
    tools?: ToolSet;
    policy?: NonNullable<OuterLLMRun['_internal']>['toolPayloadTransform'];
    logger?: IMastraLogger;
  },
): Promise<ChunkType<OUTPUT>> {
  const payload = 'payload' in chunk ? chunk.payload : undefined;
  if (!payload || typeof payload !== 'object') {
    return chunk;
  }

  const toolName = (payload as { toolName?: unknown }).toolName;
  const toolCallId = (payload as { toolCallId?: unknown }).toolCallId;
  if (typeof toolName !== 'string' || typeof toolCallId !== 'string') {
    return chunk;
  }

  const tool =
    tools?.[toolName] ||
    findProviderToolByName(tools, toolName) ||
    Object.values(tools || {}).find((candidate: any) => `id` in candidate && candidate.id === toolName);
  const source = {
    policy,
    toolTransform: (tool as { transform?: unknown } | undefined)?.transform as any,
  };
  let transform;

  if (chunk.type === 'tool-call') {
    transform = await transformToolPayloadForTargets(
      {
        phase: 'input-available',
        toolName,
        toolCallId,
        input: (payload as { args?: unknown }).args,
        providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
      },
      source,
      logger,
    );
  } else if (chunk.type === 'tool-call-delta') {
    transform = await transformToolPayloadForTargets(
      {
        phase: 'input-delta',
        toolName,
        toolCallId,
        inputTextDelta: (payload as { argsTextDelta?: string }).argsTextDelta,
        providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
      },
      source,
      logger,
    );
  } else if (chunk.type === 'tool-result') {
    chunk = withToolPayloadTransformMetadata(
      chunk,
      await transformToolPayloadForTargets(
        {
          phase: 'input-available',
          toolName,
          toolCallId,
          input: (payload as { args?: unknown }).args,
          providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
        },
        source,
        logger,
      ),
    );
    transform = await transformToolPayloadForTargets(
      {
        phase: 'output-available',
        toolName,
        toolCallId,
        input: (payload as { args?: unknown }).args,
        output: (payload as { result?: unknown }).result,
        providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
      },
      source,
      logger,
    );
  } else if (chunk.type === 'tool-error') {
    chunk = withToolPayloadTransformMetadata(
      chunk,
      await transformToolPayloadForTargets(
        {
          phase: 'input-available',
          toolName,
          toolCallId,
          input: (payload as { args?: unknown }).args,
          providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
        },
        source,
        logger,
      ),
    );
    transform = await transformToolPayloadForTargets(
      {
        phase: 'error',
        toolName,
        toolCallId,
        input: (payload as { args?: unknown }).args,
        error: (payload as { error?: unknown }).error,
        providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
      },
      source,
      logger,
    );
  }

  return withToolPayloadTransformMetadata(chunk, transform);
}

function buildResponseModelMetadata(
  runState: AgenticRunState,
  model?: { provider?: string; modelId?: string },
): { metadata: Record<string, unknown> } | undefined {
  const metadata: Record<string, unknown> = {};
  const modelId = model?.modelId ?? runState.state.responseMetadata?.modelId;

  if (modelId) {
    metadata.modelId = modelId;
  }

  if (model?.provider) {
    metadata.provider = model.provider;
  }

  return Object.keys(metadata).length > 0 ? { metadata } : undefined;
}

function buildTripWireBailResponse<OUTPUT = undefined, TOOLS extends ToolSet = ToolSet>({
  error,
  controller,
  runId,
  model,
  messageList,
  messageId,
  stepTools,
  _internal,
}: {
  error: TripWire;
  controller: ReadableStreamDefaultController<StreamChunkType<OUTPUT>>;
  runId: string;
  model: MastraLanguageModel;
  messageList: MessageList;
  messageId: string;
  stepTools?: TOOLS;
  _internal: OuterLLMRun<TOOLS, OUTPUT>['_internal'];
}) {
  const tripwireChunk: ChunkType<OUTPUT> = {
    type: 'tripwire',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      reason: error.message,
      retry: error.options?.retry,
      metadata: error.options?.metadata,
      processorId: error.processorId,
    },
  };

  safeEnqueue(controller, tripwireChunk);

  const runState = new AgenticRunState({
    _internal,
    model,
  });

  return {
    callBail: true,
    outputStream: new MastraModelOutput<OUTPUT>({
      model: {
        modelId: model.modelId,
        provider: model.provider,
        version: model.specificationVersion,
      },
      stream: new ReadableStream({
        start(c) {
          c.enqueue(tripwireChunk);
          c.close();
        },
      }),
      messageList,
      messageId,
      options: { runId },
    }),
    runState,
    stepTools,
  };
}

async function processOutputStream<OUTPUT = undefined>({
  tools,
  messageId,
  messageList,
  outputStream,
  runState,
  options,
  controller,
  responseFromModel,
  includeRawChunks,
  logger,
  runId,
  drainPendingSignals,
  transportRef,
  transportResolver,
  toolPayloadTransform,
}: ProcessOutputStreamOptions<OUTPUT>): Promise<ProcessOutputStreamResult> {
  let transportSet = false;
  const collectedChunks: CollectedChunk[] = [];

  for await (let chunk of outputStream._getBaseStream()) {
    // Stop processing chunks if the abort signal has fired.
    // Some LLM providers continue streaming data after abort (e.g. due to buffering),
    // so we must check the signal on each iteration to avoid accumulating the full
    // response into the messageList after the caller has disconnected.
    if (options?.abortSignal?.aborted) {
      break;
    }

    if (!chunk) {
      continue;
    }

    if (!transportSet && transportRef && transportResolver) {
      const transport = transportResolver();
      if (transport) {
        transportRef.current = transport;
        transportSet = true;
      }
    }

    if (chunk.type == 'object' || chunk.type == 'object-result') {
      controller.enqueue(chunk);
      continue;
    }

    if (['tool-call', 'tool-call-input-streaming-start'].includes(chunk.type)) {
      const interjectedSignals = drainPendingSignals?.(runId) ?? [];
      if (interjectedSignals.length > 0) {
        return { collectedChunks, interjectedSignals };
      }
    }

    chunk = await addToolPayloadTransformToChunk(chunk, {
      tools,
      policy: toolPayloadTransform,
      logger,
    });

    // Collect every chunk for post-stream message building
    collectedChunks.push({
      type: chunk.type,
      payload: 'payload' in chunk ? chunk.payload : undefined,
      metadata: chunk.metadata,
    });

    switch (chunk.type) {
      case 'response-metadata':
        runState.setState({
          responseMetadata: {
            id: chunk.payload.id,
            timestamp: chunk.payload.timestamp,
            modelId: chunk.payload.modelId,
            headers: chunk.payload.headers,
          },
        });
        break;

      case 'tool-call-input-streaming-start': {
        const tool =
          tools?.[chunk.payload.toolName] ||
          Object.values(tools || {})?.find(tool => `id` in tool && tool.id === chunk.payload.toolName);

        if (tool && 'onInputStart' in tool) {
          try {
            await tool?.onInputStart?.({
              toolCallId: chunk.payload.toolCallId,
              messages: messageList.get.input.aiV5.model(),
              abortSignal: options?.abortSignal,
            });
          } catch (error) {
            logger?.error('Error calling onInputStart', error);
          }
        }

        safeEnqueue(controller, chunk);
        break;
      }

      case 'tool-call-delta': {
        const tool =
          tools?.[chunk.payload.toolName || ''] ||
          Object.values(tools || {})?.find(tool => `id` in tool && tool.id === chunk.payload.toolName);

        if (tool && 'onInputDelta' in tool) {
          try {
            await tool?.onInputDelta?.({
              inputTextDelta: chunk.payload.argsTextDelta,
              toolCallId: chunk.payload.toolCallId,
              messages: messageList.get.input.aiV5.model(),
              abortSignal: options?.abortSignal,
            });
          } catch (error) {
            logger?.error('Error calling onInputDelta', error);
          }
        }
        safeEnqueue(controller, chunk);
        break;
      }

      case 'finish':
        runState.setState({
          providerOptions: chunk.payload.metadata?.providerMetadata ?? chunk.payload.providerMetadata,
          stepResult: {
            reason: chunk.payload.reason,
            logprobs: chunk.payload.logprobs,
            warnings: responseFromModel.warnings,
            totalUsage: chunk.payload.totalUsage,
            headers: responseFromModel.rawResponse?.headers,
            messageId,
            isContinued: !['stop', 'error', 'length'].includes(chunk.payload.stepResult.reason),
            request: responseFromModel.request,
          },
        });
        break;

      case 'error':
        if (isAbortError(chunk.payload.error) && options?.abortSignal?.aborted) {
          break;
        }

        runState.setState({
          hasErrored: true,
          apiError: chunk.payload.error,
        });

        runState.setState({
          stepResult: {
            isContinued: false,
            reason: 'error',
          },
        });

        // Defer enqueueing the error chunk — processAPIError handlers may intercept it
        // after processOutputStream completes and signal a retry instead.
        // Store the chunk so it can be enqueued later if no retry occurs.
        runState.setState({
          deferredErrorChunk: chunk,
        });
        break;

      case 'tool-result': {
        // Patch deferred provider-executed tool results inline.
        // When a provider tool is deferred (e.g., Anthropic web_search called alongside
        // a client tool), the tool-call arrives in step N and is added to messageList as
        // state:'call' by buildMessagesFromChunks. The tool-result arrives in step N+1's
        // stream. We patch the existing call part to state:'result' with real data here
        // so the messageList is up-to-date as early as possible.
        // For same-stream results (call + result in one step), no matching part exists yet
        // so updateToolInvocation returns false — buildMessagesFromChunks handles the merge.
        if (chunk.payload.result != null) {
          const resultToolDef =
            tools?.[chunk.payload.toolName] || findProviderToolByName(tools, chunk.payload.toolName);
          messageList.updateToolInvocation({
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: chunk.payload.toolCallId,
              toolName: chunk.payload.toolName,
              args: chunk.payload.args,
              result: chunk.payload.result,
            },
            providerMetadata: withToolPayloadTransformProviderMetadata(chunk.payload.providerMetadata, chunk.metadata),
            providerExecuted: inferProviderExecuted(chunk.payload.providerExecuted, resultToolDef),
          });
        }
        safeEnqueue(controller, chunk);
        break;
      }

      default:
        safeEnqueue(controller, chunk);
    }

    if (
      [
        'text-delta',
        'reasoning-delta',
        'source',
        'tool-call',
        'tool-call-input-streaming-start',
        'tool-call-delta',
        'tool-call-input-streaming-end',
        'raw',
      ].includes(chunk.type)
    ) {
      if (chunk.type === 'raw' && !includeRawChunks) {
        continue;
      }

      await options?.onChunk?.(chunk);
    }

    if (runState.state.hasErrored) {
      break;
    }

    // Drain signals only at stream boundaries so follow-ups do not split visible assistant text
    // or separate a tool call from its result. Tool calls are handled before enqueueing so
    // an interjection can cancel a not-yet-visible tool call from the current step.
    if (['text-end', 'reasoning-end', 'tool-result', 'finish'].includes(chunk.type)) {
      const interjectedSignals = drainPendingSignals?.(runId) ?? [];
      if (interjectedSignals.length > 0) {
        return { collectedChunks, interjectedSignals };
      }
    }
  }

  return { collectedChunks, interjectedSignals: [] };
}

function executeStreamWithFallbackModels<T>(
  models: ModelManagerModelConfig[],
  logger?: IMastraLogger,
  startIndex = 0,
): ExecuteStreamModelManager<T> {
  return async callback => {
    let index = startIndex;
    let finalResult: T | undefined;

    let done = false;
    let lastError: unknown;
    for (const modelConfig of models.slice(startIndex)) {
      index++;

      if (done) {
        break;
      }

      try {
        const isLastModel = index === models.length;
        const result = await callback(modelConfig, isLastModel);
        finalResult = result;
        done = true;
      } catch (err) {
        // TripWire errors should be re-thrown immediately - they are intentional aborts
        // from processors (e.g., processInputStep) and should not trigger model retries
        if (err instanceof TripWire) {
          throw err;
        }

        lastError = err;

        logger?.error(`Error executing model ${modelConfig.model.modelId}`, err);
      }
    }
    if (typeof finalResult === 'undefined') {
      const lastErrMsg = lastError instanceof Error ? lastError.message : String(lastError);
      const errorMessage = `Exhausted all fallback models. Last error: ${lastErrMsg}`;
      logger?.error(errorMessage);
      throw new Error(errorMessage, { cause: lastError });
    }
    return finalResult;
  };
}

export function createLLMExecutionStep<TOOLS extends ToolSet = ToolSet, OUTPUT = undefined>({
  models,
  _internal,
  messageId: messageIdPassed,
  runId,
  tools,
  toolChoice,
  activeTools,
  messageList,
  includeRawChunks,
  modelSettings,
  providerOptions,
  options,
  toolCallStreaming,
  controller,
  structuredOutput,
  outputProcessors,
  inputProcessors,
  llmRequestInputProcessors,
  errorProcessors,
  logger,
  agentId,
  downloadRetries,
  downloadConcurrency,
  processorStates,
  requestContext,
  methodType,
  requireToolApproval,
  toolCallConcurrency,
  toolCallForeachOptions,
  modelSpanTracker,
  autoResumeSuspendedTools,
  maxProcessorRetries,
  workspace,
  outputWriter,
}: OuterLLMRun<TOOLS, OUTPUT> & { toolCallForeachOptions?: ToolCallForeachOptions }) {
  const initialSystemMessages = messageList.getAllSystemMessages();
  const configuredToolCallConcurrency = resolveConfiguredToolCallConcurrency(toolCallConcurrency);

  let currentIteration = 0;

  return createStep({
    id: 'llm-execution' as const,
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, bail, tracingContext }) => {
      currentIteration++;

      // Insert a step-start boundary between loop iterations so that
      // consecutive tool-only turns are not collapsed into a single block
      // by convertToModelMessages. This ensures the LLM sees them as
      // sequential steps rather than parallel tool calls.
      if (currentIteration > 1) {
        messageList.stepStart();
      }

      let currentMessageId = inputData.isTaskCompleteCheckFailed
        ? `${messageIdPassed}-${currentIteration}`
        : inputData.messageId || messageIdPassed;
      // Start the MODEL_STEP span at the beginning of LLM execution
      modelSpanTracker?.startStep();

      let modelResult: ReturnType<typeof execute> | undefined;
      let warnings: any;
      let request: any;
      let rawResponse: any;
      let activeFallbackModelIndex = inputData.fallbackModelIndex || 0;
      let executedStepModel: string | undefined;
      const maxErrorProcessorRetries = maxProcessorRetries ?? (errorProcessors?.length ? 10 : undefined);
      const { outputStream, callBail, runState, stepTools, stepWorkspace, processAPIErrorRetry } =
        await executeStreamWithFallbackModels<{
          outputStream: MastraModelOutput<OUTPUT>;
          runState: AgenticRunState;
          callBail?: boolean;
          stepTools?: TOOLS;
          stepWorkspace?: Workspace;
          processAPIErrorRetry?: { retry: boolean };
        }>(
          models,
          logger,
          activeFallbackModelIndex,
        )(async (modelConfig, isLastModel) => {
          activeFallbackModelIndex = models.findIndex(candidate => candidate.id === modelConfig.id);
          const model = modelConfig.model;
          const modelHeaders = modelConfig.headers;

          // Re-stamp MODEL_GENERATION span with the fallback model so that downstream
          // exporters (Langfuse, etc.) attribute usage and cost to the model that
          // actually served the request instead of the first model in the list.
          if (modelSpanTracker && activeFallbackModelIndex > 0) {
            modelSpanTracker.updateGeneration({
              name: `llm: '${model.modelId}'`,
              attributes: {
                model: model.modelId,
                provider: model.provider,
              },
            });
          }
          // Reset system messages to original before each step execution
          // This ensures that system message modifications in prepareStep/processInputStep/processors
          // don't persist across steps - each step starts fresh with original system messages
          if (initialSystemMessages) {
            messageList.replaceAllSystemMessages(initialSystemMessages);
          }

          if (inputData.processorRetryFeedback) {
            messageList.addSystem(inputData.processorRetryFeedback, 'processor-retry-feedback');
          }

          const initialSignalEchoes = _internal?.initialSignalEchoes?.splice(0) ?? [];
          for (const initialSignal of initialSignalEchoes) {
            safeEnqueue(controller, initialSignal.toDataPart());
          }

          const pendingSignals = _internal?.drainPendingSignals?.(runId) ?? [];
          if (pendingSignals.length > 0) {
            currentMessageId = _internal?.generateId?.() ?? generateId();
          }
          for (const pendingSignal of pendingSignals) {
            messageList.add(pendingSignal, 'input');
            safeEnqueue(controller, pendingSignal.toDataPart());
          }

          const currentStep: {
            messageId: string;
            model: MastraLanguageModel;
            tools?: TOOLS | undefined;
            toolChoice?: ToolChoice<TOOLS> | undefined;
            activeTools?: (keyof TOOLS)[] | undefined;
            providerOptions?: SharedProviderOptions | undefined;
            modelSettings?: Omit<CallSettings, 'abortSignal'> | undefined;
            structuredOutput?: StructuredOutputOptions<OUTPUT>;
            workspace?: Workspace;
          } = {
            messageId: currentMessageId,
            model,
            tools,
            toolChoice,
            activeTools,
            providerOptions,
            modelSettings,
            structuredOutput,
            workspace,
          };
          const rotateResponseMessageId = () => {
            currentMessageId = _internal?.generateId?.() ?? generateId();
            currentStep.messageId = currentMessageId;
            return currentMessageId;
          };

          const inputStepProcessors = [
            ...(inputProcessors || []),
            ...(options?.prepareStep ? [new PrepareStepProcessor({ prepareStep: options.prepareStep })] : []),
          ];
          if (inputStepProcessors && inputStepProcessors.length > 0) {
            const processorRunner = new ProcessorRunner({
              inputProcessors: inputStepProcessors,
              outputProcessors: [],
              logger: logger || new ConsoleLogger({ level: 'error' }),
              agentName: agentId || 'unknown',
              processorStates,
            });

            try {
              // Use MODEL_STEP context so step processor spans are children of MODEL_STEP
              const stepTracingContext = modelSpanTracker?.getTracingContext() ?? tracingContext;

              // Create a ProcessorStreamWriter from outputWriter if available.
              // Forward any processor-supplied options (e.g. a future `transient`
              // flag) and override messageId so the step always owns the
              // response id for persisted data-* chunks.
              const inputStepWriter: ProcessorStreamWriter | undefined = outputWriter
                ? {
                    custom: async (data: { type: string }, options?: { messageId?: string }) =>
                      outputWriter(data as ChunkType, { ...options, messageId: currentStep.messageId }),
                  }
                : undefined;

              const processInputStepResult = await processorRunner.runProcessInputStep({
                messageList,
                stepNumber: inputData.output?.steps?.length || 0,
                ...createObservabilityContext(stepTracingContext),
                requestContext,
                model,
                steps: inputData.output?.steps || [],
                messageId: currentStep.messageId,
                rotateResponseMessageId,
                tools,
                toolChoice,
                activeTools: activeTools as string[] | undefined,
                providerOptions,
                modelSettings,
                structuredOutput,
                retryCount: inputData.processorRetryCount || 0,
                writer: inputStepWriter,
                abortSignal: options?.abortSignal,
              });
              Object.assign(currentStep, processInputStepResult);
              executedStepModel =
                currentStep.model.provider && currentStep.model.modelId
                  ? `${currentStep.model.provider}/${currentStep.model.modelId}`
                  : undefined;

              // Update MODEL_GENERATION span if processor actually changed model or modelSettings
              const modelChanged = processInputStepResult.model && processInputStepResult.model !== model;
              const modelSettingsChanged =
                processInputStepResult.modelSettings && processInputStepResult.modelSettings !== modelSettings;
              if (modelSpanTracker && (modelChanged || modelSettingsChanged)) {
                modelSpanTracker.updateGeneration({
                  ...(modelChanged ? { name: `llm: '${currentStep.model.modelId}'` } : {}),
                  attributes: {
                    ...(modelChanged
                      ? {
                          model: currentStep.model.modelId,
                          provider: currentStep.model.provider,
                        }
                      : {}),
                    ...(modelSettingsChanged ? { parameters: currentStep.modelSettings } : {}),
                  },
                });
              }

              // Update AGENT_RUN span if processor actually changed available tools
              const toolsChanged = processInputStepResult.tools && processInputStepResult.tools !== tools;
              const activeToolsChanged =
                processInputStepResult.activeTools && processInputStepResult.activeTools !== activeTools;
              if (toolsChanged || activeToolsChanged) {
                const agentSpan = tracingContext?.currentSpan?.findParent(SpanType.AGENT_RUN);
                if (agentSpan) {
                  const toolNames = activeToolsChanged
                    ? (processInputStepResult.activeTools as string[])
                    : currentStep.tools
                      ? Object.keys(currentStep.tools)
                      : undefined;
                  if (toolNames !== undefined) {
                    agentSpan.update({
                      attributes: {
                        availableTools: toolNames,
                      },
                    });
                  }
                }
              }

              // Convert any raw Mastra Tool objects returned by processors into CoreTool format.
              // Processors like ToolSearchProcessor return raw Tool instances that lack requestContext binding.
              if (processInputStepResult.tools && currentStep.tools) {
                const convertedTools: Record<string, unknown> = {};
                for (const [name, tool] of Object.entries(currentStep.tools)) {
                  if (isMastraTool(tool)) {
                    convertedTools[name] = makeCoreTool(
                      tool as unknown as ToolToConvert,
                      {
                        name,
                        runId,
                        threadId: _internal?.threadId,
                        resourceId: _internal?.resourceId,
                        logger,
                        agentName: agentId,
                        requestContext: requestContext || new RequestContext(),
                        outputWriter,
                        workspace: currentStep.workspace,
                        requireApproval: (tool as any).requireApproval,
                        backgroundConfig: (tool as any).background,
                      },
                      undefined,
                      autoResumeSuspendedTools,
                    );
                  } else {
                    convertedTools[name] = tool;
                  }
                }
                currentStep.tools = convertedTools as TOOLS;
              }
            } catch (error) {
              // Handle TripWire from processInputStep - emit tripwire chunk and signal abort
              if (error instanceof TripWire) {
                logger?.warn('Streaming input processor tripwire triggered', {
                  reason: error.message,
                  processorId: error.processorId,
                  retry: error.options?.retry,
                });
                return buildTripWireBailResponse({
                  error,
                  controller,
                  runId,
                  model,
                  messageList,
                  messageId: currentStep.messageId,
                  stepTools: tools,
                  _internal: _internal!,
                });
              }
              logger?.error('Error in processInputStep processors:', error);
              throw error;
            }
          }

          // Store activeTools on _internal so toolCallStep can enforce them
          if (_internal) {
            _internal.stepActiveTools = currentStep.activeTools as string[] | undefined;
          }

          if (toolCallForeachOptions) {
            updateToolCallForeachConcurrency(toolCallForeachOptions, {
              requireToolApproval,
              tools: currentStep.tools,
              activeTools: currentStep.activeTools as string[] | undefined,
              configuredConcurrency: configuredToolCallConcurrency,
            });
          }

          const runState = new AgenticRunState({
            _internal: _internal!,
            model: currentStep.model,
          });

          // Resolve supportedUrls - it may be a Promise (e.g., from ModelRouterLanguageModel)
          // This allows providers like Mistral to expose their native URL support for PDFs
          // See: https://github.com/mastra-ai/mastra/issues/12152
          let resolvedSupportedUrls: Record<string, RegExp[]> | undefined;
          const modelSupportedUrls = currentStep.model?.supportedUrls;
          if (modelSupportedUrls) {
            if (typeof (modelSupportedUrls as PromiseLike<unknown>).then === 'function') {
              resolvedSupportedUrls = await (modelSupportedUrls as PromiseLike<Record<string, RegExp[]>>);
            } else {
              resolvedSupportedUrls = modelSupportedUrls as Record<string, RegExp[]>;
            }
          }

          const messageListPromptArgs = {
            downloadRetries,
            downloadConcurrency,
            supportedUrls: resolvedSupportedUrls,
          };
          let inputMessages = await messageList.get.all.aiV5.llmPrompt(messageListPromptArgs);

          if (autoResumeSuspendedTools) {
            const messages = messageList.get.all.db();
            const assistantMessages = [...messages].reverse().filter(message => message.role === 'assistant');
            const suspendedToolsMessage = assistantMessages.find(message => {
              const pendingOrSuspendedTools =
                message.content.metadata?.suspendedTools || message.content.metadata?.pendingToolApprovals;
              if (pendingOrSuspendedTools) {
                return true;
              }
              const dataToolSuspendedParts = message.content.parts?.filter(
                part =>
                  (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') &&
                  !(part.data as any).resumed,
              );
              if (dataToolSuspendedParts && dataToolSuspendedParts.length > 0) {
                return true;
              }
              return false;
            });

            if (suspendedToolsMessage) {
              const metadata = suspendedToolsMessage.content.metadata;
              let suspendedToolObj = (metadata?.suspendedTools || metadata?.pendingToolApprovals) as Record<
                string,
                any
              >;
              if (!suspendedToolObj) {
                suspendedToolObj = suspendedToolsMessage.content.parts
                  ?.filter(part => part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval')
                  ?.reduce(
                    (acc, part) => {
                      if (
                        (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') &&
                        !(part.data as any).resumed
                      ) {
                        acc[(part.data as any).toolName] = part.data;
                      }
                      return acc;
                    },
                    {} as Record<string, any>,
                  );
              }
              const suspendedTools = Object.values(suspendedToolObj);
              if (suspendedTools.length > 0) {
                inputMessages = inputMessages.map((message, index) => {
                  if (message.role === 'system' && index === 0) {
                    message.content =
                      message.content +
                      `\n\nAnalyse the suspended tools: ${JSON.stringify(suspendedTools)}, using the messages available to you and the resumeSchema of each suspended tool, find the tool whose resumeData you can construct properly.
                      resumeData can not be an empty object nor null/undefined.
                      When you find that and call that tool, add the resumeData to the tool call arguments/input.
                      Also, add the runId of the suspended tool as suspendedToolRunId to the tool call arguments/input.
                      If the suspendedTool.type is 'approval', resumeData will be an object that contains 'approved' which can either be true or false depending on the user's message. If you can't construct resumeData from the message for approval type, set approved to true and add resumeData: { approved: true } to the tool call arguments/input.

                      IMPORTANT: If you're able to construct resumeData and get suspendedToolRunId, get the previous arguments/input of the tool call from args in the suspended tool, and spread it in the new arguments/input created, do not add duplicate data. 
                      `;
                  }

                  return message;
                });
              }
            }
          }

          if (_internal?.backgroundTaskManager && currentStep.tools) {
            const bgPrompt = generateBackgroundTaskSystemPrompt(currentStep.tools, _internal?.agentBackgroundConfig);
            inputMessages = inputMessages.map((message, index) => {
              if (message.role === 'system' && index === 0) {
                message.content = message.content + `\n\n${bgPrompt}`;
              }
              return message;
            });
          }

          // Run `processLLMRequest` for any input processors that implement it.
          // This hook lets processors rewrite the outbound prompt transiently
          // without persisting changes back to the message list, or short-circuit
          // the call entirely by returning a cached response.
          const requestStepRunner = new ProcessorRunner({
            inputProcessors: getRequestInputProcessors({ inputProcessors, llmRequestInputProcessors }),
            outputProcessors: [],
            logger: logger || new ConsoleLogger({ level: 'error' }),
            agentName: agentId || 'unknown',
            processorStates,
          });
          const requestStepWriter: ProcessorStreamWriter | undefined = outputWriter
            ? {
                custom: async (data: { type: string }, options?: { messageId?: string }) =>
                  outputWriter(data as ChunkType, { ...options, messageId: currentStep.messageId }),
              }
            : undefined;
          let cachedResponse: CachedLLMStepResponse | undefined;
          try {
            const requestStepResult = await requestStepRunner.runProcessLLMRequest({
              prompt: inputMessages,
              model: currentStep.model,
              stepNumber: inputData.output?.steps?.length || 0,
              steps: inputData.output?.steps || [],
              retryCount: inputData.processorRetryCount || 0,
              requestContext,
              tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext,
              writer: requestStepWriter,
              abortSignal: options?.abortSignal,
            });
            inputMessages = requestStepResult.prompt;
            cachedResponse = requestStepResult.response;
          } catch (error) {
            if (error instanceof TripWire) {
              logger?.warn('Streaming request processor tripwire triggered', {
                reason: error.message,
                processorId: error.processorId,
                retry: error.options?.retry,
              });
              return buildTripWireBailResponse({
                error,
                controller,
                runId,
                model: currentStep.model,
                messageList,
                messageId: currentStep.messageId,
                stepTools: currentStep.tools,
                _internal: _internal!,
              });
            }
            logger?.error('Error in processLLMRequest processors:', error);
            throw error;
          }

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
              messageId: currentStep.messageId,
            });
            const replayChunks = cachedResponse.chunks;
            modelResult = new ReadableStream({
              start(controller) {
                for (const chunk of replayChunks) {
                  // Reattach per-run metadata that was stripped at cache time.
                  controller.enqueue({
                    ...chunk,
                    runId,
                    from: ChunkFrom.AGENT,
                  });
                }
                controller.close();
              },
            }) as unknown as ReturnType<typeof execute>;
          } else if (isSupportedLanguageModel(currentStep.model)) {
            // Apply request-side context to MODEL_INFERENCE using the post-processor
            // tool set + per-step settings, then open the inference span. Doing this
            // immediately before execute() ensures the span's startTime excludes
            // input processor / prepareStep / processLLMRequest work, and that
            // availableTools / toolChoice reflect any per-step mutations.
            modelSpanTracker?.setInferenceContext?.({
              parameters: {
                ...currentStep.modelSettings,
                ...modelConfig.modelSettings,
              } as Record<string, unknown> | undefined,
              providerOptions: mergeProviderOptions(currentStep.providerOptions, modelConfig.providerOptions) as
                | Record<string, unknown>
                | undefined,
              availableTools: getStepAvailableToolNames(
                currentStep.tools as Record<string, unknown> | undefined,
                currentStep.activeTools as readonly string[] | undefined,
              ),
              toolChoice: currentStep.toolChoice as ModelInferenceContext['toolChoice'],
              responseFormat: currentStep.structuredOutput ? 'json_schema' : undefined,
            });
            modelSpanTracker?.startInference?.();

            modelResult = executeWithContextSync({
              span: modelSpanTracker?.getTracingContext()?.currentSpan,
              fn: () =>
                execute({
                  runId,
                  model: currentStep.model,
                  // Per-model providerOptions deep-merge per provider key on top of call-time providerOptions
                  providerOptions: mergeProviderOptions(currentStep.providerOptions, modelConfig.providerOptions),
                  inputMessages,
                  tools: currentStep.tools,
                  toolChoice: currentStep.toolChoice,
                  activeTools: currentStep.activeTools as string[] | undefined,
                  options,
                  // Per-model modelSettings shallow-merge on top of call-time modelSettings.
                  // Per-model maxRetries always wins so p-retry uses the right retry count for this model.
                  modelSettings: {
                    ...currentStep.modelSettings,
                    ...modelConfig.modelSettings,
                    maxRetries: modelConfig.maxRetries,
                  },
                  includeRawChunks,
                  structuredOutput: currentStep.structuredOutput,
                  // Merge headers: memory context first, then modelConfig headers, then modelSettings overrides
                  // x-thread-id / x-resource-id enable server-side memory enrichment (e.g. Memory Gateway)
                  headers: (() => {
                    const memoryHeaders: Record<string, string> = {};
                    if (_internal?.threadId) memoryHeaders['x-thread-id'] = _internal.threadId;
                    if (_internal?.resourceId) memoryHeaders['x-resource-id'] = _internal.resourceId;
                    const merged = {
                      ...memoryHeaders,
                      ...modelHeaders,
                      ...currentStep.modelSettings?.headers,
                    };
                    return Object.keys(merged).length > 0 ? merged : undefined;
                  })(),
                  methodType,
                  generateId: _internal?.generateId,
                  onResult: ({
                    warnings: warningsFromStream,
                    request: requestFromStream,
                    rawResponse: rawResponseFromStream,
                  }) => {
                    warnings = warningsFromStream;
                    request = requestFromStream || {};
                    rawResponse = rawResponseFromStream;

                    modelSpanTracker?.updateStep?.({
                      request: request || {},
                      inputMessages,
                      warnings: warnings || [],
                      messageId: currentStep.messageId,
                    });

                    safeEnqueue(controller, {
                      runId,
                      from: ChunkFrom.AGENT,
                      type: 'step-start',
                      payload: {
                        request: request || {},
                        warnings: warnings || [],
                        messageId: currentStep.messageId,
                      },
                    });
                  },
                  shouldThrowError: !isLastModel,
                }),
            });
          } else {
            throw new Error(
              `Unsupported model version: ${(currentStep.model as { specificationVersion?: string }).specificationVersion}. Supported versions: ${supportedLanguageModelSpecifications.join(', ')}`,
            );
          }

          const outputStream = new MastraModelOutput<OUTPUT>({
            model: {
              modelId: currentStep.model.modelId,
              provider: currentStep.model.provider,
              version: currentStep.model.specificationVersion,
            },
            stream: modelResult as ReadableStream<ChunkType<OUTPUT>>,
            messageList,
            messageId: currentStep.messageId,
            options: {
              runId,
              toolCallStreaming,
              includeRawChunks,
              structuredOutput: currentStep.structuredOutput,
              // Cached chunks were already shaped by output processors in the
              // original call. Re-running them on replay would double up.
              outputProcessors: cachedResponse ? [] : outputProcessors,
              isLLMExecutionStep: true,
              tracingContext,
              processorStates,
              requestContext,
            },
          });

          let transportResolver: (() => StreamTransport | undefined) | undefined;
          if (currentStep.model instanceof ModelRouterLanguageModel) {
            const routerModel = currentStep.model;
            transportResolver = () => readModelStreamTransport(modelResult) ?? routerModel._getStreamTransport();
          }

          try {
            const { collectedChunks, interjectedSignals } = await processOutputStream({
              outputStream,
              includeRawChunks,
              tools: currentStep.tools,
              runId,
              messageId: currentStep.messageId,
              messageList,
              runState,
              options,
              controller,
              responseFromModel: {
                warnings,
                request,
                rawResponse,
              },
              logger,
              drainPendingSignals: _internal?.drainPendingSignals,
              transportRef: _internal?.transportRef,
              transportResolver,
              toolPayloadTransform: _internal?.toolPayloadTransform,
            });

            // Build messages from the full chunk sequence and add to messageList.
            // This replaces the old inline flush approach — all parts are built in
            // correct stream order with proper providerMetadata attribution.
            const builtMessages = buildMessagesFromChunks({
              chunks: collectedChunks,
              messageId: currentStep.messageId,
              responseModelMetadata: buildResponseModelMetadata(runState, currentStep.model),
              tools: currentStep.tools,
            });
            for (const msg of builtMessages) {
              messageList.add(msg, 'response');
            }

            if (interjectedSignals.length > 0) {
              outputStream.messageId = rotateResponseMessageId();
              for (const signal of interjectedSignals) {
                messageList.add(signal, 'input');
                safeEnqueue(controller, signal.toDataPart());
              }
              runState.setState({
                stepResult: {
                  reason: 'other',
                  messageId: currentMessageId,
                  isContinued: true,
                },
              });
            }

            // Apply structuredOutput metadata to the assistant message.
            // MastraModelOutput's finish handler runs during the stream before messages
            // are added to messageList, so it can't find the message. We apply it here.
            const bufferedObject = outputStream._getImmediateObject();
            if (bufferedObject !== undefined) {
              const responseMessages = messageList.get.response.db();
              const lastAssistant = [...responseMessages].reverse().find(m => m.role === 'assistant');
              if (lastAssistant) {
                if (!lastAssistant.content.metadata) {
                  lastAssistant.content.metadata = {};
                }
                lastAssistant.content.metadata.structuredOutput = bufferedObject;
              }
            }

            // Run `processLLMResponse` for any input processors that implement
            // it. Pairs with `processLLMRequest`: lets a processor write the
            // response to a cache (or sink) using state stashed in the
            // request hook. Skipped on cache hit — that response did not come
            // from the model, so writing it back would just rewrite the same
            // value to the same key.
            if (!cachedResponse) {
              try {
                await requestStepRunner.runProcessLLMResponse({
                  chunks: collectedChunks,
                  model: currentStep.model,
                  stepNumber: inputData.output?.steps?.length || 0,
                  steps: inputData.output?.steps || [],
                  warnings,
                  request,
                  rawResponse,
                  fromCache: false,
                  retryCount: inputData.processorRetryCount || 0,
                  requestContext,
                  tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext,
                  writer: requestStepWriter,
                  abortSignal: options?.abortSignal,
                });
              } catch (responseProcessorError) {
                if (responseProcessorError instanceof TripWire) {
                  logger?.warn('Streaming response processor tripwire triggered', {
                    reason: responseProcessorError.message,
                    processorId: responseProcessorError.processorId,
                    retry: responseProcessorError.options?.retry,
                  });
                  return buildTripWireBailResponse({
                    error: responseProcessorError,
                    controller,
                    runId,
                    model: currentStep.model,
                    messageList,
                    messageId: currentStep.messageId,
                    stepTools: currentStep.tools,
                    _internal: _internal!,
                  });
                }
                logger?.error('Error in processLLMResponse processors:', responseProcessorError);
                throw responseProcessorError;
              }
            }
          } catch (error) {
            const provider = model?.provider;
            const modelIdStr = model?.modelId;

            // Handle abort first — a client-disconnect mid-stream is the
            // expected exit path, not an error. Logging it at error level
            // pollutes monitoring (see #15844 for the production
            // numbers). Bail out with a debug log before the upstream /
            // generic error branches so we never emit an
            // `error`-level entry for an AbortError.
            if (isAbortError(error) && options?.abortSignal?.aborted) {
              logger?.debug?.('LLM execution aborted', { runId });
              await options?.onAbort?.({
                steps: inputData?.output?.steps ?? [],
              });

              safeEnqueue(controller, { type: 'abort', runId, from: ChunkFrom.AGENT, payload: {} });

              return { callBail: true, outputStream, runState, stepTools: currentStep.tools };
            }

            const isUpstreamError = APICallError.isInstance(error);

            if (isUpstreamError) {
              const providerInfo = provider ? ` from ${provider}` : '';
              const modelInfo = modelIdStr ? ` (model: ${modelIdStr})` : '';
              logger?.error(`Upstream LLM API error${providerInfo}${modelInfo}`, {
                error,
                runId,
                ...(provider && { provider }),
                ...(modelIdStr && { modelId: modelIdStr }),
              });
            } else {
              logger?.error('Error in LLM execution', {
                error,
                runId,
                ...(provider && { provider }),
                ...(modelIdStr && { modelId: modelIdStr }),
              });
            }

            if (isLastModel) {
              // Defer enqueueing the error chunk — processAPIError handlers may intercept it
              // and signal a retry instead.
              runState.setState({
                hasErrored: true,
                apiError: error,
                deferredErrorChunk: {
                  type: 'error',
                  runId,
                  from: ChunkFrom.AGENT,
                  payload: { error },
                },
                stepResult: {
                  isContinued: false,
                  reason: 'error',
                },
              });
            } else {
              // For non-last models, try processAPIError before falling through to next model
              // This allows error processors to fix the request and retry with the SAME model
              const processorRunner = new ProcessorRunner({
                inputProcessors: inputProcessors || [],
                outputProcessors: outputProcessors || [],
                errorProcessors: errorProcessors || [],
                logger: logger || new ConsoleLogger({ level: 'error' }),
                agentName: agentId || 'unknown',
                processorStates,
              });

              const currentRetryCount = inputData.processorRetryCount || 0;
              const canRetryError =
                maxErrorProcessorRetries !== undefined && currentRetryCount < maxErrorProcessorRetries;
              const apiErrorWriter: ProcessorStreamWriter | undefined = outputWriter
                ? {
                    custom: async (data: { type: string }, options?: { messageId?: string }) =>
                      outputWriter(data as ChunkType, { ...options, messageId: currentMessageId }),
                  }
                : undefined;

              const errorResult = await processorRunner.runProcessAPIError({
                error,
                messages: messageList.get.all.db(),
                messageList,
                stepNumber: inputData.output?.steps?.length || 0,
                steps: inputData.output?.steps || [],
                retryCount: currentRetryCount,
                requestContext,
                writer: apiErrorWriter,
                abortSignal: options?.abortSignal,
                messageId: currentMessageId,
                rotateResponseMessageId: () => {
                  currentMessageId = _internal?.generateId?.() ?? generateId();
                  // Keep the active output stream in sync so bail/retry paths
                  // below report the rotated id instead of the stale one, and so
                  // any subsequent chunks the stream writes itself use the new id.
                  outputStream.messageId = currentMessageId;
                  return currentMessageId;
                },
              });

              if (errorResult.retry && canRetryError) {
                // Signal retry - store on runState so it's handled after the callback returns
                runState.setState({
                  hasErrored: false,
                  apiError: undefined,
                });

                // Return normally (don't throw) so executeStreamWithFallbackModels considers this done
                // The retry will be handled by the processAPIError handling below
                return {
                  outputStream,
                  callBail: false,
                  runState,
                  stepTools: currentStep.tools,
                  stepWorkspace: currentStep.workspace,
                  processAPIErrorRetry: {
                    retry: true,
                  },
                };
              }

              throw error;
            }
          }

          // Handle abort detected via signal check in processOutputStream (loop broke early).
          // The model may not have thrown an AbortError (e.g. it continued streaming despite abort),
          // so this handles the case where processOutputStream completed normally via `break`.
          if (options?.abortSignal?.aborted) {
            await options?.onAbort?.({
              steps: inputData?.output?.steps ?? [],
            });

            safeEnqueue(controller, { type: 'abort', runId, from: ChunkFrom.AGENT, payload: {} });

            return { callBail: true, outputStream, runState, stepTools: currentStep.tools };
          }

          return {
            outputStream,
            callBail: false,
            runState,
            stepTools: currentStep.tools,
            stepWorkspace: currentStep.workspace,
          };
        });

      if (executedStepModel) {
        messageList.enrichLastStepStart(executedStepModel);
      }

      // Store modified tools and workspace in _internal so toolCallStep can access them
      // without going through workflow serialization (which would lose execute functions)
      if (_internal) {
        _internal.stepTools = stepTools;
        _internal.stepWorkspace = stepWorkspace ?? _internal.stepWorkspace;
      }

      if (callBail) {
        const usage = outputStream._getImmediateUsage();
        const responseMetadata = runState.state.responseMetadata;
        const text = outputStream._getImmediateText();

        return bail({
          messageId: outputStream.messageId,
          stepResult: {
            reason: 'tripwire',
            warnings,
            isContinued: false,
          },
          metadata: {
            providerMetadata: runState.state.providerOptions,
            ...responseMetadata,
            modelMetadata: runState.state.modelMetadata,
            headers: rawResponse?.headers,
            request,
          },
          output: {
            text,
            toolCalls: [],
            usage: usage ?? inputData.output.usage,
            steps: [],
          },
          messages: {
            all: messageList.get.all.aiV5.model(),
            user: messageList.get.input.aiV5.model(),
            nonUser: messageList.get.response.aiV5.model(),
          },
        });
      }

      // Handle processAPIError for API rejections
      // This covers two cases:
      // 1. Non-last model: processAPIError was already run in the catch block, result passed via processAPIErrorRetry
      // 2. Last model: error came as a stream chunk, run processAPIError now
      let apiErrorRetryResult: { retry: boolean } | undefined = processAPIErrorRetry;

      if (!apiErrorRetryResult && runState.state.hasErrored && runState.state.apiError) {
        const currentRetryCount = inputData.processorRetryCount || 0;
        const canRetryError = maxErrorProcessorRetries !== undefined && currentRetryCount < maxErrorProcessorRetries;
        const processorRunner = new ProcessorRunner({
          inputProcessors: inputProcessors || [],
          outputProcessors: outputProcessors || [],
          errorProcessors: errorProcessors || [],
          logger: logger || new ConsoleLogger({ level: 'error' }),
          agentName: agentId || 'unknown',
          processorStates,
        });

        const apiErrorWriter2: ProcessorStreamWriter | undefined = outputWriter
          ? {
              custom: async (data: { type: string }, options?: { messageId?: string }) =>
                outputWriter(data as ChunkType, { ...options, messageId: currentMessageId }),
            }
          : undefined;

        const errorResult = await processorRunner.runProcessAPIError({
          error: runState.state.apiError,
          messages: messageList.get.all.db(),
          messageList,
          stepNumber: inputData.output?.steps?.length || 0,
          steps: inputData.output?.steps || [],
          retryCount: currentRetryCount,
          requestContext,
          writer: apiErrorWriter2,
          abortSignal: options?.abortSignal,
          messageId: currentMessageId,
          rotateResponseMessageId: () => {
            currentMessageId = _internal?.generateId?.() ?? generateId();
            // Keep the active output stream in sync so the retry payload and
            // any downstream chunks use the rotated id.
            outputStream.messageId = currentMessageId;
            return currentMessageId;
          },
        });

        if (errorResult.retry && canRetryError) {
          apiErrorRetryResult = errorResult;
          // Clear error state for retry
          runState.setState({
            hasErrored: false,
            apiError: undefined,
            deferredErrorChunk: undefined,
          });
        }
      }

      // If processAPIError signaled retry, return early with retry metadata
      if (apiErrorRetryResult?.retry) {
        const currentProcessorRetryCount = inputData.processorRetryCount || 0;
        const steps = inputData.output?.steps || [];
        const nextProcessorRetryCount = currentProcessorRetryCount + 1;

        const messages = {
          all: messageList.get.all.aiV5.model(),
          user: messageList.get.input.aiV5.model(),
          // Do not return failed assistant output as new response messages for this retry step.
          // That output was already added to messageList while processing the failed stream;
          // returning it in messages.nonUser would make agentic-execution/index.ts append it again.
          nonUser: [],
        };

        return {
          messageId: outputStream.messageId,
          stepResult: {
            reason: 'retry',
            warnings,
            isContinued: true,
          },
          metadata: {
            providerMetadata: runState.state.providerOptions,
            ...runState.state.responseMetadata,
            modelMetadata: runState.state.modelMetadata,
            headers: rawResponse?.headers,
            request,
          },
          output: {
            text: '',
            toolCalls: [],
            usage: outputStream._getImmediateUsage() ?? inputData.output?.usage,
            steps,
          },
          messages,
          processorRetryCount: nextProcessorRetryCount,
          ...(activeFallbackModelIndex > 0 ? { fallbackModelIndex: activeFallbackModelIndex } : {}),
        };
      }

      // If error was deferred and no retry was signaled, enqueue the error chunk now
      if (runState.state.deferredErrorChunk && runState.state.hasErrored) {
        const deferredChunk = runState.state.deferredErrorChunk;
        const deferredError = getErrorFromUnknown(deferredChunk.payload.error, {
          fallbackMessage: 'Unknown error in agent stream',
        });
        safeEnqueue(controller, { ...deferredChunk, payload: { ...deferredChunk.payload, error: deferredError } });
        await options?.onError?.({ error: deferredError });
        runState.setState({ deferredErrorChunk: undefined });
      }

      if (outputStream.tripwire) {
        // Set the step result to indicate abort
        runState.setState({
          stepResult: {
            isContinued: false,
            reason: 'tripwire',
          },
        });
      }

      // Tool calls are added to the message list inline during stream processing (case 'tool-call').
      // Tool results (including deferred provider results) are handled inline (case 'tool-result').
      const toolCalls = (outputStream._getImmediateToolCalls() ?? []).map(chunk => {
        const tool = stepTools?.[chunk.payload.toolName] || findProviderToolByName(stepTools, chunk.payload.toolName);
        return {
          ...chunk.payload,
          providerExecuted: inferProviderExecuted(chunk.payload.providerExecuted, tool),
        };
      });

      // Call processOutputStep for processors (runs AFTER LLM response, BEFORE tool execution)
      // This allows processors to validate/modify the response and trigger retries if needed
      let processOutputStepTripwire: TripWire | null = null;
      if (outputProcessors && outputProcessors.length > 0) {
        const processorRunner = new ProcessorRunner({
          inputProcessors: [],
          outputProcessors,
          logger: logger || new ConsoleLogger({ level: 'error' }),
          agentName: agentId || 'unknown',
          processorStates,
        });

        try {
          const stepNumber = inputData.output?.steps?.length || 0;
          const immediateText = outputStream._getImmediateText();
          const immediateFinishReason = outputStream._getImmediateFinishReason();

          // Convert toolCalls to ToolCallInfo format
          const toolCallInfos = toolCalls.map(tc => ({
            toolName: tc.toolName,
            toolCallId: tc.toolCallId,
            args: tc.args,
          }));

          // Get current processor retry count from iteration data
          const currentRetryCount = inputData.processorRetryCount || 0;

          // Use MODEL_STEP context so step processor spans are children of MODEL_STEP
          const outputStepTracingContext = modelSpanTracker?.getTracingContext() ?? tracingContext;

          // Create a ProcessorStreamWriter from outputWriter if available.
          // Forward any processor-supplied options and override messageId so
          // the step always owns the response id for persisted data-* chunks.
          const processorWriter: ProcessorStreamWriter | undefined = outputWriter
            ? {
                custom: async (data: { type: string }, options?: { messageId?: string }) =>
                  outputWriter(data as ChunkType, { ...options, messageId: outputStream.messageId }),
              }
            : undefined;

          await processorRunner.runProcessOutputStep({
            steps: inputData.output?.steps ?? [],
            messages: messageList.get.all.db(),
            messageList,
            stepNumber,
            finishReason: immediateFinishReason,
            toolCalls: toolCallInfos.length > 0 ? toolCallInfos : undefined,
            text: immediateText,
            usage: outputStream._getImmediateUsage(),
            ...createObservabilityContext(outputStepTracingContext),
            requestContext,
            retryCount: currentRetryCount,
            writer: processorWriter,
          });
        } catch (error) {
          if (error instanceof TripWire) {
            processOutputStepTripwire = error;
            logger?.warn('Output step processor tripwire triggered', {
              reason: error.message,
              processorId: error.processorId,
              retry: error.options?.retry,
            });
            // If retry is requested, we'll handle it below
            // For now, we just capture the tripwire
          } else {
            logger?.error('Error in processOutputStep processors:', error);
            throw error;
          }
        }
      }

      const finishReason = runState?.state?.stepResult?.reason ?? outputStream._getImmediateFinishReason();
      const hasErrored = runState.state.hasErrored;
      const usage = outputStream._getImmediateUsage();
      const responseMetadata = runState.state.responseMetadata;
      const text = outputStream._getImmediateText();
      const object = outputStream._getImmediateObject();
      // Check if tripwire was triggered (from stream processors or output step processors)
      const tripwireTriggered = outputStream.tripwire || processOutputStepTripwire !== null;

      // Get current processor retry count
      const currentProcessorRetryCount = inputData.processorRetryCount || 0;

      // Check if this is a retry request from processOutputStep
      const retryRequested = processOutputStepTripwire?.options?.retry === true;
      const canRetry = maxProcessorRetries !== undefined && currentProcessorRetryCount < maxProcessorRetries;
      const shouldRetry = retryRequested && canRetry;

      // Log if retry was requested but not allowed
      if (retryRequested && !canRetry) {
        if (maxProcessorRetries === undefined) {
          logger?.warn?.(`Processor requested retry but maxProcessorRetries is not set. Treating as abort.`);
        } else {
          logger?.warn?.(
            `Processor requested retry but maxProcessorRetries (${maxProcessorRetries}) exceeded. ` +
              `Current count: ${currentProcessorRetryCount}. Treating as abort.`,
          );
        }
      }

      const steps = inputData.output?.steps || [];

      // Only include content from this iteration, not all accumulated content
      // Get the number of existing response messages to know where this iteration starts
      const existingResponseCount = inputData.messages?.nonUser?.length || 0;
      const allResponseContent = messageList.get.response.aiV5.modelContent(steps.length);

      // Extract only the content added in this iteration
      const currentIterationContent = allResponseContent.slice(existingResponseCount);

      // Build tripwire data if this step is being rejected
      // This includes both retry scenarios and max retries exceeded
      const stepTripwireData = processOutputStepTripwire
        ? {
            reason: processOutputStepTripwire.message,
            retry: processOutputStepTripwire.options?.retry,
            metadata: processOutputStepTripwire.options?.metadata,
            processorId: processOutputStepTripwire.processorId,
          }
        : undefined;

      // Always add the current step to the steps array
      // If tripwire data is set, the step's text will return empty string
      // This keeps the step in history but excludes its text from final output
      steps.push(
        new DefaultStepResult({
          warnings: outputStream._getImmediateWarnings(),
          providerMetadata: runState.state.providerOptions,
          finishReason: runState.state.stepResult?.reason,
          content: currentIterationContent,
          response: { ...responseMetadata, ...rawResponse, messages: messageList.get.response.aiV5.model() },
          request: request,
          usage: outputStream._getImmediateUsage() as LanguageModelV2Usage,
          tripwire: stepTripwireData,
        }),
      );

      // Remove rejected response messages from the messageList before the next iteration.
      // Without this, the LLM sees the rejected assistant response in its prompt on retry,
      // which confuses models and often causes empty text responses.
      if (shouldRetry) {
        messageList.removeByIds([outputStream.messageId]);
      }

      const retryFeedbackText =
        shouldRetry && processOutputStepTripwire
          ? `[Processor Feedback] Your previous response was not accepted: ${processOutputStepTripwire.message}. Please try again with the feedback in mind.`
          : undefined;

      const messages = {
        all: messageList.get.all.aiV5.model(),
        user: messageList.get.input.aiV5.model(),
        nonUser: messageList.get.response.aiV5.model(),
      };

      // Determine step result
      // If shouldRetry is true, we continue the loop instead of triggering tripwire
      const stepReason = shouldRetry ? 'retry' : tripwireTriggered ? 'tripwire' : hasErrored ? 'error' : finishReason;

      const nextFallbackModelIndex = shouldRetry ? activeFallbackModelIndex : 0;

      // isContinued should be true if:
      // - shouldRetry is true (processor requested retry)
      // - OR there are non-provider-executed tool calls to process (some LLMs return finishReason 'stop' even with tool calls)
      // - OR finishReason indicates more work (e.g., tool-use)
      // Provider-executed tools (e.g. web_search) are handled server-side — the response already
      // contains both the tool execution and the text output, so no additional loop iteration is needed.
      //
      // NOTE: hasPendingToolCalls must NOT override finishReason='length'.
      // When the provider hits max_tokens mid-generation, it returns finishReason='length' and
      // may also emit a partial/truncated tool call. Retrying with the same parameters produces
      // the same truncation → infinite loop until maxSteps. PR #13861 / issue #13012 explicitly
      // excluded 'length' from shouldContinue; this guard prevents hasPendingToolCalls from
      // inadvertently re-enabling it.
      // See: https://github.com/mastra-ai/mastra/issues/15717
      const hasPendingToolCalls = toolCalls && toolCalls.some(tc => !tc.providerExecuted) && finishReason !== 'length';
      const shouldContinue =
        shouldRetry ||
        (!tripwireTriggered && (hasPendingToolCalls || !['stop', 'error', 'length'].includes(finishReason)));

      // Reset retry count after a successful non-retry step; only consecutive retries carry forward.
      const nextProcessorRetryCount = shouldRetry ? currentProcessorRetryCount + 1 : 0;

      return {
        messageId: outputStream.messageId,
        stepResult: {
          reason: stepReason,
          warnings,
          isContinued: shouldContinue,
          // Pass retry metadata for tracking
          ...(shouldRetry && processOutputStepTripwire
            ? {
                retryReason: processOutputStepTripwire.message,
                retryMetadata: processOutputStepTripwire.options?.metadata,
                retryProcessorId: processOutputStepTripwire.processorId,
              }
            : {}),
        },
        metadata: {
          providerMetadata: runState.state.providerOptions,
          ...responseMetadata,
          ...rawResponse,
          modelMetadata: runState.state.modelMetadata,
          headers: rawResponse?.headers,
          request,
        },
        output: {
          text,
          toolCalls: shouldRetry ? [] : toolCalls, // Clear tool calls on retry
          usage: usage ?? inputData.output?.usage,
          steps,
          ...(object ? { object } : {}),
        },
        messages,
        // Track processor retry count for next iteration
        processorRetryCount: nextProcessorRetryCount,
        processorRetryFeedback: retryFeedbackText,
        ...(nextFallbackModelIndex > 0 ? { fallbackModelIndex: nextFallbackModelIndex } : {}),
      };
    },
  });
}
