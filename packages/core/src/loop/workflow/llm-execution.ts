import type { ReadableStream } from 'stream/web';
import { isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2, LanguageModelV2Usage } from '@ai-sdk/provider-v5';
import type { ToolSet } from 'ai-v5';
import type { MessageList } from '../../agent/message-list';
import { execute } from '../../stream/aisdk/v5/execute';
import { DefaultStepResult } from '../../stream/aisdk/v5/output-helpers';
import { convertMastraChunkToAISDKv5 } from '../../stream/aisdk/v5/transform';
import { MastraModelOutput } from '../../stream/base/output';
import type { OutputSchema } from '../../stream/base/schema';
import type { ChunkType, ReasoningStartPayload, TextStartPayload } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { createStep } from '../../workflows';
import type { LoopConfig, OuterLLMRun } from '../types';
import { AgenticRunState } from './run-state';
import { llmIterationOutputSchema } from './schema';

type ProcessOutputStreamOptions<OUTPUT extends OutputSchema | undefined = undefined> = {
  model: LanguageModelV2;
  tools?: ToolSet;
  messageId: string;
  includeRawChunks?: boolean;
  messageList: MessageList;
  outputStream: MastraModelOutput<OUTPUT>;
  runState: AgenticRunState;
  options?: LoopConfig;
  controller: ReadableStreamDefaultController<ChunkType>;
  responseFromModel: {
    warnings: any;
    request: any;
    rawResponse: any;
  };
};

async function processOutputStream<OUTPUT extends OutputSchema | undefined = undefined>({
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
  for await (const chunk of outputStream.fullStream) {
    if (!chunk) {
      continue;
    }

    if (chunk.type == 'object') {
      // controller.enqueue(chunk);
      continue;
    }

    // Reasoning
    if (
      chunk.type !== 'reasoning-delta' &&
      chunk.type !== 'reasoning-signature' &&
      chunk.type !== 'redacted-reasoning' &&
      runState.state.isReasoning
    ) {
      if (runState.state.reasoningDeltas.length) {
        messageList.add(
          {
            id: messageId,
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: runState.state.reasoningDeltas.join(''),
                signature: (chunk.payload as ReasoningStartPayload).signature,
                providerOptions:
                  (chunk.payload as ReasoningStartPayload).providerMetadata ?? runState.state.providerOptions,
              },
            ],
          },
          'response',
        );
      }
      runState.setState({
        isReasoning: false,
        reasoningDeltas: [],
      });
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
        controller.enqueue(chunk);
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

        controller.enqueue(chunk);

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
        controller.enqueue(chunk);
        break;
      }

      case 'reasoning-start': {
        runState.setState({
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
          controller.enqueue(chunk);
          break;
        }
        controller.enqueue(chunk);
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
        controller.enqueue(chunk);
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
            isContinued: !['stop', 'error'].includes(chunk.payload.reason),
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

        let e = chunk.payload.error as any;
        if (typeof e === 'object') {
          e = new Error(e?.message || 'Unknown error');
          Object.assign(e, chunk.payload.error);
        }

        controller.enqueue({ ...chunk, payload: { ...chunk.payload, error: e } });
        await options?.onError?.({ error: e });

        break;
      default:
        controller.enqueue(chunk);
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
      const transformedChunk = convertMastraChunkToAISDKv5({
        chunk,
      });

      if (chunk.type === 'raw' && !includeRawChunks) {
        return;
      }

      await options?.onChunk?.({ chunk: transformedChunk } as any);
    }

    if (runState.state.hasErrored) {
      break;
    }
  }
}

export function createLLMExecutionStep<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>({
  model,
  _internal,
  messageId,
  runId,
  modelStreamSpan,
  telemetry_settings,
  tools,
  toolChoice,
  messageList,
  includeRawChunks,
  modelSettings,
  providerOptions,
  options,
  toolCallStreaming,
  controller,
  output,
  headers,
  downloadRetries,
  downloadConcurrency,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'llm-execution',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, bail }) => {
      const runState = new AgenticRunState({
        _internal: _internal!,
        model,
      });

      let modelResult;
      let warnings: any;
      let request: any;
      let rawResponse: any;

      switch (model.specificationVersion) {
        case 'v2': {
          const inputMessages = await messageList.get.all.aiV5.llmPrompt({
            downloadRetries,
            downloadConcurrency,
            supportedUrls: model?.supportedUrls as Record<string, RegExp[]>,
          });

          modelResult = execute({
            runId,
            model,
            providerOptions,
            inputMessages,
            tools,
            toolChoice,
            options,
            modelSettings,
            telemetry_settings,
            includeRawChunks,
            output,
            headers,
            onResult: ({
              warnings: warningsFromStream,
              request: requestFromStream,
              rawResponse: rawResponseFromStream,
            }) => {
              warnings = warningsFromStream;
              request = requestFromStream || {};
              rawResponse = rawResponseFromStream;

              controller.enqueue({
                runId,
                from: ChunkFrom.AGENT,
                type: 'step-start',
                payload: {
                  request: request || {},
                  warnings: [],
                  messageId: messageId,
                },
              });
            },
            modelStreamSpan,
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
        options: {
          runId,
          rootSpan: modelStreamSpan,
          toolCallStreaming,
          telemetry_settings,
          includeRawChunks,
          output,
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
        console.log('Error in LLM Execution Step', error);
        if (isAbortError(error) && options?.abortSignal?.aborted) {
          await options?.onAbort?.({
            steps: inputData?.output?.steps ?? [],
          });

          controller.enqueue({ type: 'abort', runId, from: ChunkFrom.AGENT, payload: {} });

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
              providerMetadata: providerOptions,
              ...responseMetadata,
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

        controller.enqueue({
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
      }

      /**
       * Add tool calls to the message list
       */

      const toolCalls = outputStream._getImmediateToolCalls()?.map(chunk => {
        return chunk.payload;
      });

      if (toolCalls.length > 0) {
        const assistantContent = [
          ...(toolCalls.map(toolCall => {
            return {
              type: 'tool-call',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args,
            };
          }) as any),
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

      const steps = inputData.output?.steps || [];

      steps.push(
        new DefaultStepResult({
          warnings: outputStream._getImmediateWarnings(),
          providerMetadata: providerOptions,
          finishReason: runState.state.stepResult?.reason,
          content: messageList.get.response.aiV5.modelContent(),
          // @ts-ignore this is how it worked internally for transformResponse which was removed TODO: how should this actually work?
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
          reason: hasErrored ? 'error' : finishReason,
          warnings,
          isContinued: !['stop', 'error'].includes(finishReason),
        },
        metadata: {
          providerMetadata: runState.state.providerOptions,
          ...responseMetadata,
          ...rawResponse,
          headers: rawResponse?.headers,
          request,
        },
        output: {
          text,
          toolCalls,
          usage: usage ?? inputData.output?.usage,
          steps,
        },
        messages,
      };
    },
  });
}
