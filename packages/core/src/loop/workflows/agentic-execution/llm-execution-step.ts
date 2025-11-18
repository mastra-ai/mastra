import type { ReadableStream } from 'stream/web';
import { isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2, LanguageModelV2Usage } from '@ai-sdk/provider-v5';
import type { ToolSet } from 'ai-v5';
import { MessageList } from '../../../agent/message-list';
import { getErrorFromUnknown } from '../../../error/utils.js';
import { execute } from '../../../stream/aisdk/v5/execute';
import { DefaultStepResult } from '../../../stream/aisdk/v5/output-helpers';
import { MastraModelOutput } from '../../../stream/base/output';
import type { OutputSchema } from '../../../stream/base/schema';
import type {
  ChunkType,
  ExecuteStreamModelManager,
  ModelManagerModelConfig,
  TextStartPayload,
} from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { LoopConfig, OuterLLMRun } from '../../types';
import { AgenticRunState } from '../run-state';
import { llmIterationOutputSchema } from '../schema';
import { isControllerOpen } from '../stream';

type ProcessOutputStreamOptions<OUTPUT extends OutputSchema = undefined> = {
  model: LanguageModelV2;
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
};

async function processOutputStream<OUTPUT extends OutputSchema = undefined>({
  tools,
  messageId,
  messageList,
  outputStream,
  runState,
  options,
  controller,
  responseFromModel,
  includeRawChunks,
}: ProcessOutputStreamOptions<OUTPUT>) {
  for await (const chunk of outputStream._getBaseStream()) {
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

        messageList.add(
          {
            id: messageId,
            role: 'assistant',
            content: [
              providerMetadata
                ? {
                    type: 'text',
                    text: runState.state.textDeltas.join(''),
                    providerOptions: providerMetadata,
                  }
                : {
                    type: 'text',
                    text: runState.state.textDeltas.join(''),
                  },
            ],
          },
          'response',
        );
      }

      runState.setState({
        isStreaming: false,
        textDeltas: [],
      });
    }

    if (
      chunk.type !== 'reasoning-start' &&
      chunk.type !== 'reasoning-delta' &&
      chunk.type !== 'reasoning-end' &&
      chunk.type !== 'redacted-reasoning' &&
      chunk.type !== 'reasoning-signature' &&
      chunk.type !== 'response-metadata' &&
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

      case 'text-delta': {
        const textDeltasFromState = runState.state.textDeltas;
        textDeltasFromState.push(chunk.payload.text);
        runState.setState({
          textDeltas: textDeltasFromState,
          isStreaming: true,
        });
        if (isControllerOpen(controller)) {
          controller.enqueue(chunk);
        }
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
            console.error('Error calling onInputStart', error);
          }
        }

        if (isControllerOpen(controller)) {
          controller.enqueue(chunk);
        }

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
            console.error('Error calling onInputDelta', error);
          }
        }
        if (isControllerOpen(controller)) {
          controller.enqueue(chunk);
        }
        break;
      }

      case 'reasoning-start': {
        runState.setState({
          isReasoning: true,
          reasoningDeltas: [],
          providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
        });

        if (Object.values(chunk.payload.providerMetadata || {}).find((v: any) => v?.redactedData)) {
          messageList.add(
            {
              id: messageId,
              role: 'assistant',
              content: [
                {
                  type: 'reasoning',
                  text: '',
                  providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                },
              ],
            },
            'response',
          );
          if (isControllerOpen(controller)) {
            controller.enqueue(chunk);
          }
          break;
        }
        if (isControllerOpen(controller)) {
          controller.enqueue(chunk);
        }
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
        if (isControllerOpen(controller)) {
          controller.enqueue(chunk);
        }
        break;
      }

      case 'reasoning-end': {
        // Use the accumulated reasoning deltas from runState
        if (runState.state.reasoningDeltas.length > 0) {
          messageList.add(
            {
              id: messageId,
              role: 'assistant',
              content: [
                {
                  type: 'reasoning',
                  text: runState.state.reasoningDeltas.join(''),
                  providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                },
              ],
            },
            'response',
          );
        }

        // Reset reasoning state
        runState.setState({
          isReasoning: false,
          reasoningDeltas: [],
        });

        if (isControllerOpen(controller)) {
          controller.enqueue(chunk);
        }
        break;
      }

      case 'file':
        messageList.add(
          {
            id: messageId,
            role: 'assistant',
            content: [
              {
                type: 'file',
                data: chunk.payload.data,
                mimeType: chunk.payload.mimeType,
              },
            ],
          },
          'response',
        );
        controller.enqueue(chunk);
        break;

      case 'source':
        messageList.add(
          {
            id: messageId,
            role: 'assistant',
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
          },
          'response',
        );

        controller.enqueue(chunk);
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
        controller.enqueue({ ...chunk, payload: { ...chunk.payload, error } });
        await options?.onError?.({ error });
        break;

      default:
        if (isControllerOpen(controller)) {
          controller.enqueue(chunk);
        }
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

function executeStreamWithFallbackModels<T>(models: ModelManagerModelConfig[]): ExecuteStreamModelManager<T> {
  return async callback => {
    let index = 0;
    let finalResult: T | undefined;

    let done = false;
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
          const result = await callback(modelConfig.model, isLastModel);
          finalResult = result;
          done = true;
          break;
        } catch (err) {
          attempt++;

          console.error(`Error executing model ${modelConfig.model.modelId}, attempt ${attempt}====`, err);

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
      console.error('Exhausted all fallback models and reached the maximum number of retries.');
      throw new Error('Exhausted all fallback models and reached the maximum number of retries.');
    }
    return finalResult;
  };
}

export function createLLMExecutionStep<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>({
  models,
  _internal,
  messageId,
  runId,
  tools,
  toolChoice,
  messageList,
  includeRawChunks,
  modelSettings,
  providerOptions,
  options,
  toolCallStreaming,
  controller,
  structuredOutput,
  outputProcessors,
  headers,
  downloadRetries,
  downloadConcurrency,
  processorStates,
  methodType,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'llm-execution',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, bail, tracingContext }) => {
      let modelResult;
      let warnings: any;
      let request: any;
      let rawResponse: any;

      const { outputStream, callBail, runState } = await executeStreamWithFallbackModels<{
        outputStream: MastraModelOutput<OUTPUT | undefined>;
        runState: AgenticRunState;
        callBail?: boolean;
      }>(models)(async (model, isLastModel) => {
        const runState = new AgenticRunState({
          _internal: _internal!,
          model,
        });

        switch (model.specificationVersion) {
          case 'v2': {
            const messageListPromptArgs = {
              downloadRetries,
              downloadConcurrency,
              supportedUrls: model?.supportedUrls as Record<string, RegExp[]>,
            };
            let inputMessages = await messageList.get.all.aiV5.llmPrompt(messageListPromptArgs);

            // Call prepareStep callback if provided
            let stepModel = model;
            let stepToolChoice = toolChoice;
            let stepTools = tools;

            if (options?.prepareStep) {
              try {
                const prepareStepResult = await options.prepareStep({
                  stepNumber: inputData.output?.steps?.length || 0,
                  steps: inputData.output?.steps || [],
                  model,
                  messages: messageList.get.all.aiV5.model(),
                });

                if (prepareStepResult) {
                  if (prepareStepResult.model) {
                    stepModel = prepareStepResult.model;
                  }
                  if (prepareStepResult.toolChoice) {
                    stepToolChoice = prepareStepResult.toolChoice;
                  }
                  if (prepareStepResult.activeTools && stepTools) {
                    const activeToolsSet = new Set(prepareStepResult.activeTools);
                    stepTools = Object.fromEntries(
                      Object.entries(stepTools).filter(([toolName]) => activeToolsSet.has(toolName)),
                    ) as typeof tools;
                  }
                  if (prepareStepResult.messages) {
                    const newMessages = prepareStepResult.messages;
                    const newMessageList = new MessageList();

                    for (const message of newMessages) {
                      if (message.role === 'system') {
                        newMessageList.addSystem(message);
                      } else if (message.role === 'user') {
                        newMessageList.add(message, 'input');
                      } else if (message.role === 'assistant' || message.role === 'tool') {
                        newMessageList.add(message, 'response');
                      }
                    }

                    inputMessages = await newMessageList.get.all.aiV5.llmPrompt(messageListPromptArgs);
                  }
                }
              } catch (error) {
                console.error('Error in prepareStep callback:', error);
              }
            }

            modelResult = execute({
              runId,
              model: stepModel,
              providerOptions,
              inputMessages,
              tools: stepTools,
              toolChoice: stepToolChoice,
              options,
              modelSettings,
              includeRawChunks,
              structuredOutput,
              headers,
              methodType,
              onResult: ({
                warnings: warningsFromStream,
                request: requestFromStream,
                rawResponse: rawResponseFromStream,
              }) => {
                warnings = warningsFromStream;
                request = requestFromStream || {};
                rawResponse = rawResponseFromStream;

                if (!isControllerOpen(controller)) {
                  // Controller is closed or errored, skip enqueueing
                  // This can happen when downstream errors (like in onStepFinish) close the controller
                  return;
                }

                controller.enqueue({
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
            });
            break;
          }
          default: {
            throw new Error(`Unsupported model version: ${model.specificationVersion}`);
          }
        }

        const outputStream = new MastraModelOutput({
          model: {
            modelId: model.modelId,
            provider: model.provider,
            version: model.specificationVersion,
          },
          stream: modelResult as ReadableStream<ChunkType>,
          messageList,
          messageId,
          options: {
            runId,
            toolCallStreaming,
            includeRawChunks,
            structuredOutput,
            outputProcessors,
            isLLMExecutionStep: true,
            tracingContext,
            processorStates,
          },
        });

        try {
          await processOutputStream({
            outputStream,
            includeRawChunks,
            model,
            tools,
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
          });
        } catch (error) {
          console.error('Error in LLM Execution Step', error);
          if (isAbortError(error) && options?.abortSignal?.aborted) {
            await options?.onAbort?.({
              steps: inputData?.output?.steps ?? [],
            });

            if (isControllerOpen(controller)) {
              controller.enqueue({ type: 'abort', runId, from: ChunkFrom.AGENT, payload: {} });
            }

            return { callBail: true, outputStream, runState };
          }

          if (isLastModel) {
            if (isControllerOpen(controller)) {
              controller.enqueue({
                type: 'error',
                runId,
                from: ChunkFrom.AGENT,
                payload: { error },
              });
            }

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

        return { outputStream, callBail: false, runState };
      });

      if (callBail) {
        const usage = outputStream._getImmediateUsage();
        const responseMetadata = runState.state.responseMetadata;
        const text = outputStream._getImmediateText();

        return bail({
          messageId,
          stepResult: {
            reason: 'abort',
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
            usage: usage ?? inputData.output?.usage,
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
            reason: 'abort',
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
        const assistantContent = [
          ...toolCalls.map(toolCall => {
            return {
              type: 'tool-call' as const,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args,
            };
          }),
        ];

        messageList.add(
          {
            id: messageId,
            role: 'assistant',
            content: assistantContent,
          },
          'response',
        );
      }

      const finishReason = runState?.state?.stepResult?.reason ?? outputStream._getImmediateFinishReason();
      const hasErrored = runState.state.hasErrored;
      const usage = outputStream._getImmediateUsage();
      const responseMetadata = runState.state.responseMetadata;
      const text = outputStream._getImmediateText();
      const object = outputStream._getImmediateObject();
      // Check if tripwire was triggered
      const tripwireTriggered = outputStream.tripwire;

      const steps = inputData.output?.steps || [];

      // Only include content from this iteration, not all accumulated content
      // Get the number of existing response messages to know where this iteration starts
      const existingResponseCount = inputData.messages?.nonUser?.length || 0;
      const allResponseContent = messageList.get.response.aiV5.modelContent(steps.length);

      // Extract only the content added in this iteration
      const currentIterationContent = allResponseContent.slice(existingResponseCount);

      steps.push(
        new DefaultStepResult({
          warnings: outputStream._getImmediateWarnings(),
          providerMetadata: runState.state.providerOptions,
          finishReason: runState.state.stepResult?.reason,
          content: currentIterationContent,
          response: { ...responseMetadata, ...rawResponse, messages: messageList.get.response.aiV5.model() },
          request: request,
          usage: outputStream._getImmediateUsage() as LanguageModelV2Usage,
        }),
      );

      const messages = {
        all: messageList.get.all.aiV5.model(),
        user: messageList.get.input.aiV5.model(),
        nonUser: messageList.get.response.aiV5.model(),
      };

      return {
        messageId,
        stepResult: {
          reason: tripwireTriggered ? 'abort' : hasErrored ? 'error' : finishReason,
          warnings,
          isContinued: tripwireTriggered ? false : !['stop', 'error'].includes(finishReason),
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
          toolCalls,
          usage: usage ?? inputData.output?.usage,
          steps,
          ...(object ? { object } : {}),
        },
        messages,
      };
    },
  });
}
