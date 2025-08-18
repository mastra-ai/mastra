import type { ReadableStream } from 'stream/web';
import { isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2, LanguageModelV2Usage } from '@ai-sdk/provider-v5';
import type { ToolSet } from 'ai-v5';
import type { MessageList } from '../../agent/message-list';
import { execute } from '../../stream/aisdk/v5/execute';
import { DefaultStepResult } from '../../stream/aisdk/v5/output-helpers';
import { convertMastraChunkToAISDKv5 } from '../../stream/aisdk/v5/transform';
import { MastraModelOutput } from '../../stream/base/output';
import type { ChunkType } from '../../stream/types';
import { createStep } from '../../workflows';
import type { LoopConfig, OuterLLMRun } from '../types';
import { AgenticRunState } from './run-state';
import { llmIterationOutputSchema } from './schema';

type ProcessOutputStreamOptions = {
  model: LanguageModelV2;
  tools?: ToolSet;
  messageId: string;
  includeRawChunks?: boolean;
  messageList: MessageList;
  outputStream: MastraModelOutput;
  runState: AgenticRunState;
  options?: LoopConfig;
  controller: ReadableStreamDefaultController<ChunkType>;
  responseFromModel: {
    warnings: any;
    request: any;
    rawResponse: any;
  };
};

async function processOutputStream({
  tools,
  messageId,
  messageList,
  outputStream,
  runState,
  options,
  controller,
  responseFromModel,
  includeRawChunks,
}: ProcessOutputStreamOptions) {
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
                signature: chunk.payload.signature,
                providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
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
    if (chunk.type !== 'text-delta' && chunk.type !== 'tool-call' && runState.state.isStreaming) {
      if (runState.state.textDeltas.length) {
        messageList.add(
          {
            id: messageId,
            role: 'assistant',
            content: [
              (chunk.payload.providerMetadata ?? runState.state.providerOptions)
                ? {
                    type: 'text',
                    text: runState.state.textDeltas.join(''),
                    providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
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
              messages: messageList.get.input.aiV5.model()?.map(message => ({
                role: message.role,
                content: message.content,
              })) as any,
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
          tools?.[chunk.payload.toolName] ||
          Object.values(tools || {})?.find(tool => `id` in tool && tool.id === chunk.payload.toolName);

        if (tool && 'onInputDelta' in tool) {
          try {
            await tool?.onInputDelta?.({
              inputTextDelta: chunk.payload.argsTextDelta,
              toolCallId: chunk.payload.toolCallId,
              messages: messageList.get.input.aiV5.model()?.map(message => ({
                role: message.role,
                content: message.content,
              })) as any,
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
                    url: chunk.payload.url,
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

        controller.enqueue(chunk);

        runState.setState({
          stepResult: {
            isContinued: false,
            reason: 'error',
          },
        });

        await options?.onError?.({ error: chunk.payload.error });

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

export function createLLMExecutionStep<Tools extends ToolSet = ToolSet>({
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
  objectOptions,
}: OuterLLMRun<Tools>) {
  return createStep({
    id: 'llm-execution',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, bail }) => {
      const runState = new AgenticRunState({
        _internal: _internal!,
        model,
      });

      console.log('Starting LLM Execution Step');

      let modelResult;
      let warnings: any;
      let request: any;
      let rawResponse: any;

      switch (model.specificationVersion) {
        case 'v2': {
          modelResult = execute({
            runId,
            model,
            providerOptions,
            inputMessages: messageList.get.all.aiV5.llmPrompt(),
            tools,
            toolChoice,
            options,
            modelSettings,
            telemetry_settings,
            includeRawChunks,
            objectOptions,
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
                from: 'AGENT',
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
          objectOptions,
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

          controller.enqueue({ type: 'abort', runId, from: 'AGENT', payload: {} });

          const usage = outputStream.usage;
          const responseMetadata = runState.state.responseMetadata;
          const text = outputStream.text;

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
              all: messageList.get.all.v3(),
              user: messageList.get.input.v3(),
              nonUser: messageList.get.response.v3(),
            },
          });
        }

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

      const toolCalls = outputStream.toolCalls?.map(chunk => {
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

      const finishReason = runState?.state?.stepResult?.reason ?? outputStream.finishReason;
      const hasErrored = runState.state.hasErrored;
      const usage = outputStream.usage;
      const responseMetadata = runState.state.responseMetadata;
      const text = outputStream.text;

      const steps = inputData.output?.steps || [];

      steps.push(
        new DefaultStepResult({
          warnings: outputStream.warnings,
          providerMetadata: providerOptions,
          finishReason: runState.state.stepResult?.reason,
          content: messageList.get.response.aiV5.modelContent(),
          // @ts-ignore this is how it worked internally for transformResponse which was removed TODO: how should this actually work?
          response: { ...responseMetadata, messages: messageList.get.response.aiV5.model() },
          request: request,
          usage: outputStream.usage as LanguageModelV2Usage,
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
