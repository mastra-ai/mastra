import { TransformStream } from 'stream/web';
import { getErrorMessage } from '@ai-sdk/provider-v5';
import { createTextStreamResponse, createUIMessageStream, createUIMessageStreamResponse } from 'ai-v5';
import type { TextStreamPart, ToolSet, UIMessage, UIMessageStreamOptions } from 'ai-v5';

import type { MessageList } from '../../../agent/message-list';
import type { MastraModelOutput } from '../../base/output';
import type { ChunkType } from '../../types';
import type { ConsumeStreamOptions } from './compat';
import { getResponseUIMessageId, consumeStream, convertFullStreamChunkToUIMessageStream } from './compat';
import { transformResponse, transformSteps } from './output-helpers';
import { convertMastraChunkToAISDKv5 } from './transform';

export class AISDKV5OutputStream {
  #modelOutput: MastraModelOutput;
  #options: { toolCallStreaming?: boolean; includeRawChunks?: boolean };
  #messageList: MessageList;

  constructor({
    modelOutput,
    options,
    messageList,
  }: {
    modelOutput: MastraModelOutput;
    options: { toolCallStreaming?: boolean; includeRawChunks?: boolean };
    messageList: MessageList;
  }) {
    this.#modelOutput = modelOutput;
    this.#options = options;
    this.#messageList = messageList;
  }

  toTextStreamResponse(init?: ResponseInit): Response {
    return createTextStreamResponse({
      textStream: this.#modelOutput.textStream as any,
      ...init,
    });
  }

  toUIMessageStreamResponse<UI_MESSAGE extends UIMessage>({
    // @ts-ignore
    generateMessageId,
    originalMessages,
    sendFinish,
    sendReasoning,
    sendSources,
    onError,
    sendStart,
    messageMetadata,
    onFinish,
    ...init
  }: UIMessageStreamOptions<UI_MESSAGE> & ResponseInit = {}) {
    return createUIMessageStreamResponse({
      stream: this.toUIMessageStream({
        // @ts-ignore
        generateMessageId,
        originalMessages,
        sendFinish,
        sendReasoning,
        sendSources,
        onError,
        sendStart,
        messageMetadata,
        onFinish,
      }),
      ...init,
    });
  }

  toUIMessageStream<UI_MESSAGE extends UIMessage>({
    // @ts-ignore
    generateMessageId,
    originalMessages,
    sendFinish = true,
    sendReasoning = true,
    sendSources = false,
    onError = getErrorMessage,
    sendStart = true,
    messageMetadata,
    onFinish,
  }: UIMessageStreamOptions<UI_MESSAGE> = {}) {
    const responseMessageId =
      generateMessageId != null
        ? getResponseUIMessageId({
            originalMessages,
            responseMessageId: generateMessageId,
          })
        : undefined;

    return createUIMessageStream({
      onError,
      onFinish,
      generateId: () => responseMessageId ?? generateMessageId?.(),
      execute: async ({ writer }) => {
        for await (const part of this.fullStream) {
          const messageMetadataValue = messageMetadata?.({ part });

          const partType = part.type;

          const transformedChunk = convertFullStreamChunkToUIMessageStream({
            part,
            sendReasoning,
            messageMetadataValue,
            sendSources,
            sendStart,
            sendFinish,
            responseMessageId,
            onError,
          });

          if (transformedChunk) {
            writer.write(transformedChunk as any);
          }

          // start and finish events already have metadata
          // so we only need to send metadata for other parts
          if (messageMetadataValue != null && partType !== 'start' && partType !== 'finish') {
            writer.write({
              type: 'message-metadata',
              messageMetadata: messageMetadataValue,
            });
          }
        }
      },
    });
  }

  async consumeStream(options?: ConsumeStreamOptions): Promise<void> {
    try {
      await consumeStream({
        stream: this.fullStream.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              controller.enqueue(chunk);
            },
          }),
        ) as any,
        onError: options?.onError,
      });
    } catch (error) {
      console.log('consumeStream error', error);
      options?.onError?.(error);
    }
  }

  get sources() {
    return this.#modelOutput.sources.map(source => {
      return convertMastraChunkToAISDKv5({
        chunk: source,
      });
    });
  }

  get files() {
    return this.#modelOutput.files
      .map(file => {
        if (file.type === 'file') {
          return convertMastraChunkToAISDKv5({
            chunk: file,
          });
        }
        return;
      })
      .filter(Boolean);
  }

  get toolCalls() {
    return this.#modelOutput.toolCalls.map(toolCall => {
      return convertMastraChunkToAISDKv5({
        chunk: toolCall,
      });
    });
  }

  get toolResults() {
    return this.#modelOutput.toolResults.map(toolResult => {
      return convertMastraChunkToAISDKv5({
        chunk: toolResult,
      });
    });
  }

  get reasoningText() {
    return this.#modelOutput.reasoningText;
  }

  get reasoning() {
    return this.#modelOutput.reasoningDetails;
  }

  get response() {
    return transformResponse({
      response: this.#modelOutput.response,
      isMessages: true,
      runId: this.#modelOutput.runId,
    });
  }

  get steps() {
    return transformSteps({ steps: this.#modelOutput.steps, runId: this.#modelOutput.runId });
  }

  get content() {
    return (
      transformResponse({
        response: this.response,
        isMessages: true,
        runId: this.#modelOutput.runId,
      }).messages?.flatMap((message: any) => message.content) ?? []
    );
  }

  get fullStream() {
    let startEvent: TextStreamPart<ToolSet> | undefined;
    let hasStarted: boolean = false;
    // let stepCounter = 1;
    return this.#modelOutput.fullStream.pipeThrough(
      new TransformStream<ChunkType, TextStreamPart<ToolSet>>({
        transform(chunk, controller) {
          if (chunk.type === 'step-start' && !startEvent) {
            startEvent = convertMastraChunkToAISDKv5({
              chunk,
            });
            // stepCounter++;
            return;
          } else if (chunk.type !== 'error') {
            hasStarted = true;
          }

          if (startEvent && hasStarted) {
            controller.enqueue(startEvent as any);
            startEvent = undefined;
          }

          const transformedChunk = convertMastraChunkToAISDKv5({
            chunk,
          });

          if (transformedChunk) {
            // if (!['start', 'finish', 'finish-step'].includes(transformedChunk.type)) {
            //   console.log('step counter', stepCounter);
            //   transformedChunk.id = transformedChunk.id ?? stepCounter.toString();
            // }

            controller.enqueue(transformedChunk);
          }
        },
      }),
    );
  }

  async getFullOutput() {
    await this.consumeStream();
    return {
      text: this.#modelOutput.text,
      usage: this.#modelOutput.usage,
      steps: this.steps,
      finishReason: this.#modelOutput.finishReason,
      warnings: this.#modelOutput.warnings,
      providerMetadata: this.#modelOutput.providerMetadata,
      request: this.#modelOutput.request,
      reasoning: this.reasoning,
      reasoningText: this.reasoningText,
      toolCalls: this.toolCalls,
      toolResults: this.toolResults,
      sources: this.sources,
      files: this.files,
      response: this.response,
      content: this.content,
      totalUsage: this.#modelOutput.totalUsage,
      // experimental_output: // TODO
    };
  }
}
