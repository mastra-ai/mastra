import { ReadableStream } from 'node:stream/web';
import { isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2Usage } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import type { CallSettings, ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import type { StructuredOutputOptions } from '../../../agent';
import type { MastraDBMessage, MessageList } from '../../../agent/message-list';
import { TripWire } from '../../../agent/trip-wire';
import { isSupportedLanguageModel, supportedLanguageModelSpecifications } from '../../../agent/utils';
import { getErrorFromUnknown } from '../../../error/utils.js';
import type { MastraLanguageModel, SharedProviderOptions } from '../../../llm/model/shared.types';
import type { IMastraLogger } from '../../../logger';
import { ConsoleLogger } from '../../../logger';
import { executeWithContextSync } from '../../../observability';
import type { ProcessorStreamWriter } from '../../../processors/index';
import { PrepareStepProcessor } from '../../../processors/processors/prepare-step';
import { ProcessorRunner } from '../../../processors/runner';
import { execute } from '../../../stream/aisdk/v5/execute';
import { DefaultStepResult } from '../../../stream/aisdk/v5/output-helpers';
import { safeEnqueue } from '../../../stream/base';
import { MastraModelOutput } from '../../../stream/base/output';
import type {
  ChunkType,
  ExecuteStreamModelManager,
  ModelManagerModelConfig,
  TextStartPayload,
} from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { Workspace } from '../../../workspace/workspace';
import type { LoopConfig, OuterLLMRun } from '../../types';
import { AgenticRunState } from '../run-state';
import { llmIterationOutputSchema } from '../schema';

type ProcessOutputStreamOptions<OUTPUT = undefined> = {
  tools?: ToolSet;
  messageId: string;
  includeRawChunks?: boolean;
  messageList: MessageList;
  outputStream: MastraModelOutput<OUTPUT>;
  runState: AgenticRunState;
  options?: LoopConfig<OUTPUT>;
  controller: ReadableStreamDefaultController<ChunkType<OUTPUT>>;
  responseFromModel: {
    warnings: any;
    request: any;
    rawResponse: any;
  };
  logger?: IMastraLogger;
};

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
}: ProcessOutputStreamOptions<OUTPUT>) {
  for await (const chunk of outputStream._getBaseStream()) {
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

    if (chunk.type == 'object' || chunk.type == 'object-result') {
      controller.enqueue(chunk);
      continue;
    }

    // Streaming
    if (
      chunk.type !== 'text-delta' &&
      chunk.type !== 'tool-call' &&
      // not 100% sure about this being the right fix.
      // basically for some llm providers they add response-metadata after each text-delta
      // we then flush the chunks by calling messageList.add (a few lines down)
      // this results in a bunch of weird separated text chunks on the message instead of combined chunks
      // easiest solution here is to just not flush for response-metadata
      // BUT does this cause other issues?
      // Alternative solution: in message list allow combining text deltas together when the message source is "response" and the text parts are directly next to each other
      // simple solution for now is to not flush text deltas on response-metadata
      chunk.type !== 'response-metadata' &&
      runState.state.isStreaming
    ) {
      if (runState.state.textDeltas.length) {
        const textStartPayload = chunk.payload as TextStartPayload;
        const providerMetadata = textStartPayload.providerMetadata ?? runState.state.providerOptions;

        const message: MastraDBMessage = {
          id: messageId,
          role: 'assistant' as const,
          content: {
            format: 2,
            parts: [
              {
                type: 'text' as const,
                text: runState.state.textDeltas.join(''),
                ...(providerMetadata ? { providerMetadata } : {}),
              },
            ],
          },
          createdAt: new Date(),
        };
        messageList.add(message, 'response');
      }

      runState.setState({
        isStreaming: false,
        textDeltas: [],
      });
    }

    // Only reset reasoning state for truly unexpected chunk types.
    // Some providers (e.g., ZAI/glm-4.6) send text-start before reasoning-end,
    // so we must allow text-start to pass through without clearing reasoningDeltas.
    if (
      chunk.type !== 'reasoning-start' &&
      chunk.type !== 'reasoning-delta' &&
      chunk.type !== 'reasoning-end' &&
      chunk.type !== 'redacted-reasoning' &&
      chunk.type !== 'reasoning-signature' &&
      chunk.type !== 'response-metadata' &&
      chunk.type !== 'text-start' &&
      runState.state.isReasoning
    ) {
      runState.setState({
        isReasoning: false,
        reasoningDeltas: [],
      });
    }

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

      case 'text-start': {
        // Capture text-start's providerMetadata (e.g., openai.itemId: "msg_xxx")
        // This is needed because, for example, OpenAI reasoning models send separate itemIds for
        // reasoning (rs_xxx) and text (msg_xxx) parts. The text's itemId must be
        // preserved so that when memory is replayed, OpenAI sees the required
        // following item for the reasoning part.
        if (chunk.payload.providerMetadata) {
          runState.setState({
            providerOptions: chunk.payload.providerMetadata,
          });
        }
        safeEnqueue(controller, chunk);
        break;
      }

      case 'text-delta': {
        const textDeltasFromState = runState.state.textDeltas;
        textDeltasFromState.push(chunk.payload.text);
        runState.setState({
          textDeltas: textDeltasFromState,
          isStreaming: true,
        });
        safeEnqueue(controller, chunk);
        break;
      }

      case 'text-end': {
        // Clear providerOptions to prevent text's providerMetadata from leaking
        // into subsequent parts (similar to reasoning-end clearing)
        runState.setState({
          providerOptions: undefined,
        });
        safeEnqueue(controller, chunk);
        break;
      }

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

      case 'reasoning-start': {
        runState.setState({
          isReasoning: true,
          reasoningDeltas: [],
          providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
        });

        if (Object.values(chunk.payload.providerMetadata || {}).find((v: any) => v?.redactedData)) {
          const message: MastraDBMessage = {
            id: messageId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'reasoning' as const,
                  reasoning: '',
                  details: [{ type: 'redacted', data: '' }],
                  providerMetadata: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                },
              ],
            },
            createdAt: new Date(),
          };
          messageList.add(message, 'response');
          safeEnqueue(controller, chunk);
          break;
        }
        safeEnqueue(controller, chunk);
        break;
      }

      case 'reasoning-delta': {
        const reasoningDeltasFromState = runState.state.reasoningDeltas;
        reasoningDeltasFromState.push(chunk.payload.text);
        runState.setState({
          isReasoning: true,
          reasoningDeltas: reasoningDeltasFromState,
          providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
        });
        safeEnqueue(controller, chunk);
        break;
      }

      case 'reasoning-end': {
        // Always store reasoning, even if empty - OpenAI requires item_reference for tool calls
        // See: https://github.com/mastra-ai/mastra/issues/9005
        const message: MastraDBMessage = {
          id: messageId,
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'reasoning' as const,
                reasoning: '',
                details: [{ type: 'text', text: runState.state.reasoningDeltas.join('') }],
                providerMetadata: chunk.payload.providerMetadata ?? runState.state.providerOptions,
              },
            ],
          },
          createdAt: new Date(),
        };

        messageList.add(message, 'response');

        // Reset reasoning state - clear providerOptions to prevent reasoning metadata
        // (like openai.itemId) from leaking into subsequent text parts
        runState.setState({
          isReasoning: false,
          reasoningDeltas: [],
          providerOptions: undefined,
        });

        safeEnqueue(controller, chunk);
        break;
      }

      case 'file':
        {
          const message: MastraDBMessage = {
            id: messageId,
            role: 'assistant' as const,
            content: {
              format: 2,
              parts: [
                {
                  type: 'file' as const,
                  // @ts-expect-error - data type mismatch, see TODO
                  data: chunk.payload.data, // TODO: incorrect string type
                  mimeType: chunk.payload.mimeType,
                },
              ],
            },
            createdAt: new Date(),
          };
          messageList.add(message, 'response');
          safeEnqueue(controller, chunk);
        }
        break;

      case 'source':
        {
          const message: MastraDBMessage = {
            id: messageId,
            role: 'assistant' as const,
            content: {
              format: 2,
              parts: [
                {
                  type: 'source',
                  source: {
                    sourceType: 'url',
                    id: chunk.payload.id,
                    url: chunk.payload.url || '',
                    title: chunk.payload.title,
                    providerMetadata: chunk.payload.providerMetadata,
                  },
                },
              ],
            },
            createdAt: new Date(),
          };
          messageList.add(message, 'response');
          safeEnqueue(controller, chunk);
        }
        break;

      case 'finish':
        runState.setState({
          providerOptions: chunk.payload.metadata.providerMetadata,
          stepResult: {
            reason: chunk.payload.reason,
            logprobs: chunk.payload.logprobs,
            warnings: responseFromModel.warnings,
            totalUsage: chunk.payload.totalUsage,
            headers: responseFromModel.rawResponse?.headers,
            messageId,
            isContinued: !['stop', 'error'].includes(chunk.payload.stepResult.reason),
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
        });

        runState.setState({
          stepResult: {
            isContinued: false,
            reason: 'error',
          },
        });

        const error = getErrorFromUnknown(chunk.payload.error, {
          fallbackMessage: 'Unknown error in agent stream',
        });
        safeEnqueue(controller, { ...chunk, payload: { ...chunk.payload, error } });
        await options?.onError?.({ error });
        break;

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
  }
}

function executeStreamWithFallbackModels<T>(
  models: ModelManagerModelConfig[],
  logger?: IMastraLogger,
): ExecuteStreamModelManager<T> {
  return async callback => {
    let index = 0;
    let finalResult: T | undefined;

    let done = false;
    let lastError: unknown;
    for (const modelConfig of models) {
      index++;
      const maxRetries = modelConfig.maxRetries || 0;
      let attempt = 0;

      if (done) {
        break;
      }

      while (attempt <= maxRetries) {
        try {
          const isLastModel = attempt === maxRetries && index === models.length;
          const result = await callback(modelConfig, isLastModel);
          finalResult = result;
          done = true;
          break;
        } catch (err) {
          // TripWire errors should be re-thrown immediately - they are intentional aborts
          // from processors (e.g., processInputStep) and should not trigger model retries
          if (err instanceof TripWire) {
            throw err;
          }

          lastError = err;
          attempt++;

          logger?.error(`Error executing model ${modelConfig.model.modelId}, attempt ${attempt}====`, err);

          // If we've exhausted all retries for this model, break and try the next model
          if (attempt > maxRetries) {
            break;
          }

          // Add exponential backoff before retrying to avoid hammering the API
          // This helps with rate limiting and gives transient failures time to recover
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 1s, 2s, 4s, 8s, max 10s
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    if (typeof finalResult === 'undefined') {
      const lastErrMsg = lastError instanceof Error ? lastError.message : String(lastError);
      const errorMessage = `Exhausted all fallback models and reached the maximum number of retries. Last error: ${lastErrMsg}`;
      logger?.error(errorMessage);
      throw new Error(errorMessage, { cause: lastError });
    }
    return finalResult;
  };
}

export function createLLMExecutionStep<TOOLS extends ToolSet = ToolSet, OUTPUT = undefined>({
  models,
  _internal,
  messageId,
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
  logger,
  agentId,
  downloadRetries,
  downloadConcurrency,
  processorStates,
  requestContext,
  methodType,
  modelSpanTracker,
  autoResumeSuspendedTools,
  maxProcessorRetries,
  workspace,
  outputWriter,
}: OuterLLMRun<TOOLS, OUTPUT>) {
  const initialSystemMessages = messageList.getAllSystemMessages();

  return createStep({
    id: 'llm-execution' as const,
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, bail, tracingContext }) => {
      // Start the MODEL_STEP span at the beginning of LLM execution
      modelSpanTracker?.startStep();

      let modelResult;
      let warnings: any;
      let request: any;
      let rawResponse: any;

      const { outputStream, callBail, runState, stepTools, stepWorkspace } = await executeStreamWithFallbackModels<{
        outputStream: MastraModelOutput<OUTPUT>;
        runState: AgenticRunState;
        callBail?: boolean;
        stepTools?: TOOLS;
        stepWorkspace?: Workspace;
      }>(
        models,
        logger,
      )(async (modelConfig, isLastModel) => {
        const model = modelConfig.model;
        const modelHeaders = modelConfig.headers;
        // Reset system messages to original before each step execution
        // This ensures that system message modifications in prepareStep/processInputStep/processors
        // don't persist across steps - each step starts fresh with original system messages
        if (initialSystemMessages) {
          messageList.replaceAllSystemMessages(initialSystemMessages);
        }

        // Add processor retry feedback from previous iteration AFTER the reset
        // This feedback was passed through workflow state to survive the system message reset
        if (inputData.processorRetryFeedback) {
          messageList.addSystem(inputData.processorRetryFeedback, 'processor-retry-feedback');
        }

        const currentStep: {
          model: MastraLanguageModel;
          tools?: TOOLS | undefined;
          toolChoice?: ToolChoice<TOOLS> | undefined;
          activeTools?: (keyof TOOLS)[] | undefined;
          providerOptions?: SharedProviderOptions | undefined;
          modelSettings?: Omit<CallSettings, 'abortSignal'> | undefined;
          structuredOutput?: StructuredOutputOptions<OUTPUT>;
          workspace?: Workspace;
        } = {
          model,
          tools,
          toolChoice,
          activeTools,
          providerOptions,
          modelSettings,
          structuredOutput,
          workspace,
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

            // Create a ProcessorStreamWriter from outputWriter if available
            const inputStepWriter: ProcessorStreamWriter | undefined = outputWriter
              ? { custom: async (data: { type: string }) => outputWriter(data as ChunkType) }
              : undefined;

            const processInputStepResult = await processorRunner.runProcessInputStep({
              messageList,
              stepNumber: inputData.output?.steps?.length || 0,
              tracingContext: stepTracingContext,
              requestContext,
              model,
              steps: inputData.output?.steps || [],
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
          } catch (error) {
            // Handle TripWire from processInputStep - emit tripwire chunk and signal abort
            if (error instanceof TripWire) {
              // Emit tripwire chunk to the stream
              safeEnqueue(controller, {
                type: 'tripwire',
                runId,
                from: ChunkFrom.AGENT,
                payload: {
                  reason: error.message,
                  retry: error.options?.retry,
                  metadata: error.options?.metadata,
                  processorId: error.processorId,
                },
              });

              // Create a minimal runState for the bail response
              const runState = new AgenticRunState({
                _internal: _internal!,
                model,
              });

              // Return via bail to properly signal the tripwire
              return {
                callBail: true,
                outputStream: new MastraModelOutput({
                  model: {
                    modelId: model.modelId,
                    provider: model.provider,
                    version: model.specificationVersion,
                  },
                  stream: new ReadableStream({
                    start(c) {
                      c.close();
                    },
                  }),
                  messageList,
                  messageId,
                  options: { runId },
                }),
                runState,
                stepTools: tools,
              };
            }
            logger?.error('Error in processInputStep processors:', error);
            throw error;
          }
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
            let suspendedToolObj = (metadata?.suspendedTools || metadata?.pendingToolApprovals) as Record<string, any>;
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

        if (isSupportedLanguageModel(currentStep.model)) {
          modelResult = executeWithContextSync({
            span: modelSpanTracker?.getTracingContext()?.currentSpan,
            fn: () =>
              execute({
                runId,
                model: currentStep.model,
                providerOptions: currentStep.providerOptions,
                inputMessages,
                tools: currentStep.tools,
                toolChoice: currentStep.toolChoice,
                activeTools: currentStep.activeTools as string[] | undefined,
                options,
                modelSettings: currentStep.modelSettings,
                includeRawChunks,
                structuredOutput: currentStep.structuredOutput,
                // Merge headers: modelConfig headers first, then modelSettings overrides them
                // Only create object if there are actual headers to avoid passing empty {}
                headers:
                  modelHeaders || currentStep.modelSettings?.headers
                    ? { ...modelHeaders, ...currentStep.modelSettings?.headers }
                    : undefined,
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

                  safeEnqueue(controller, {
                    runId,
                    from: ChunkFrom.AGENT,
                    type: 'step-start',
                    payload: {
                      request: request || {},
                      warnings: warnings || [],
                      messageId: messageId,
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
          messageId,
          options: {
            runId,
            toolCallStreaming,
            includeRawChunks,
            structuredOutput: currentStep.structuredOutput,
            outputProcessors,
            isLLMExecutionStep: true,
            tracingContext,
            processorStates,
            requestContext,
          },
        });

        try {
          await processOutputStream({
            outputStream,
            includeRawChunks,
            tools: currentStep.tools,
            messageId,
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
          });
        } catch (error) {
          const provider = model?.provider;
          const modelIdStr = model?.modelId;
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

          if (isAbortError(error) && options?.abortSignal?.aborted) {
            await options?.onAbort?.({
              steps: inputData?.output?.steps ?? [],
            });

            safeEnqueue(controller, { type: 'abort', runId, from: ChunkFrom.AGENT, payload: {} });

            return { callBail: true, outputStream, runState, stepTools: currentStep.tools };
          }

          if (isLastModel) {
            safeEnqueue(controller, {
              type: 'error',
              runId,
              from: ChunkFrom.AGENT,
              payload: { error },
            });

            runState.setState({
              hasErrored: true,
              stepResult: {
                isContinued: false,
                reason: 'error',
              },
            });
          } else {
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
          messageId,
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

      if (outputStream.tripwire) {
        // Set the step result to indicate abort
        runState.setState({
          stepResult: {
            isContinued: false,
            reason: 'tripwire',
          },
        });
      }

      /**
       * Add tool calls to the message list
       */

      const toolCalls = outputStream._getImmediateToolCalls()?.map(chunk => {
        return chunk.payload;
      });

      if (toolCalls.length > 0) {
        const message: MastraDBMessage = {
          id: messageId,
          role: 'assistant' as const,
          content: {
            format: 2,
            parts: toolCalls.map(toolCall => {
              return {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                },
                providerMetadata: toolCall.providerMetadata,
                providerExecuted: toolCall.providerExecuted,
              };
            }),
          },
          createdAt: new Date(),
        };
        messageList.add(message, 'response');
      }

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

          // Create a ProcessorStreamWriter from outputWriter if available
          const processorWriter: ProcessorStreamWriter | undefined = outputWriter
            ? { custom: async (data: { type: string }) => outputWriter(data as ChunkType) }
            : undefined;

          await processorRunner.runProcessOutputStep({
            steps: inputData.output?.steps ?? [],
            messages: messageList.get.all.db(),
            messageList,
            stepNumber,
            finishReason: immediateFinishReason,
            toolCalls: toolCallInfos.length > 0 ? toolCallInfos : undefined,
            text: immediateText,
            tracingContext: outputStepTracingContext,
            requestContext,
            retryCount: currentRetryCount,
            writer: processorWriter,
          });
        } catch (error) {
          if (error instanceof TripWire) {
            processOutputStepTripwire = error;
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
      // Only allow retry if maxProcessorRetries is set and we haven't exceeded it
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
        messageList.removeByIds([messageId]);
      }

      // Build retry feedback text if retrying
      // This will be passed through workflow state to survive the system message reset
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

      // isContinued should be true if:
      // - shouldRetry is true (processor requested retry)
      // - OR finishReason indicates more work (e.g., tool-use)
      const shouldContinue = shouldRetry || (!tripwireTriggered && !['stop', 'error'].includes(finishReason));

      // Increment processor retry count if we're retrying
      const nextProcessorRetryCount = shouldRetry ? currentProcessorRetryCount + 1 : currentProcessorRetryCount;

      return {
        messageId,
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
        // Pass retry feedback through workflow state to survive system message reset
        processorRetryFeedback: retryFeedbackText,
      };
    },
  });
}
