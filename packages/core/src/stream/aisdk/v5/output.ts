import { TransformStream } from 'stream/web';
import { getErrorMessage, type LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { consumeStream, createTextStreamResponse, createUIMessageStream, createUIMessageStreamResponse } from 'ai-v5';
import type { TextStreamPart, ToolSet, UIMessage, UIMessageStreamOptions } from 'ai-v5';
import type { MessageList } from '../../../agent/message-list';
import type { ObjectOptions } from '../../../loop/types';
import type { MastraModelOutput } from '../../base/output';
import type { ChunkType } from '../../types';
import type { ConsumeStreamOptions } from './compat';
import { getResponseUIMessageId, convertFullStreamChunkToUIMessageStream, DelayedPromise } from './compat';
import { getResponseFormat } from './object/schema';
import { createJsonTextStreamTransformer, createObjectStreamTransformer } from './object/stream-object';
import { transformResponse, transformSteps } from './output-helpers';
import { convertMastraChunkToAISDKv5 } from './transform';

export class AISDKV5OutputStream {
  #modelOutput: MastraModelOutput;
  #options: { toolCallStreaming?: boolean; includeRawChunks?: boolean; objectOptions?: ObjectOptions };
  #messageList: MessageList;
  #objectPromise = new DelayedPromise<any>();

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
          return (
            convertMastraChunkToAISDKv5({
              chunk: file,
            }) as any
          )?.file;
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
    const response = transformResponse({
      response: this.#modelOutput.response,
      isMessages: true,
      runId: this.#modelOutput.runId,
    });
    const newResponse = {
      ...response,
      messages: response.messages?.map((message: any) => ({
        role: message.role,
        content: message.content?.parts,
      })),
    };

    return newResponse;
  }

  get steps() {
    return transformSteps({ steps: this.#modelOutput.steps, runId: this.#modelOutput.runId });
  }

  get content() {
    const content =
      transformResponse({
        response: this.#modelOutput.response,
        isMessages: false,
        runId: this.#modelOutput.runId,
      }).messages?.flatMap((message: any) => {
        return message.content?.parts;
      }) ?? [];

    return content;
  }

  get fullStream() {
    let startEvent: TextStreamPart<ToolSet> | undefined;
    let hasStarted: boolean = false;
    // let stepCounter = 1;
    return this.#modelOutput.fullStream
      .pipeThrough(createObjectStreamTransformer({ objectOptions: this.#options.objectOptions }))
      .pipeThrough(
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

  get objectStream() {
    const self = this;
    if (!self.#options.objectOptions) {
      throw new Error('objectStream requires objectOptions');
    }

    return this.#modelOutput.fullStream
      .pipeThrough(
        createObjectStreamTransformer({
          objectOptions: self.#options.objectOptions,
          onFinish: data => self.#objectPromise.resolve(data),
          onError: error => self.#objectPromise.reject(error),
        }),
      )
      .pipeThrough(
        new TransformStream<ChunkType | any, LanguageModelV2StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'object') {
              controller.enqueue(chunk.object);
            }
          },
        }),
      );
  }

  get elementStream() {
    let publishedElements = 0;
    const self = this;
    if (!self.#options.objectOptions) {
      throw new Error('elementStream requires objectOptions');
    }

    return this.#modelOutput.fullStream
      .pipeThrough(
        createObjectStreamTransformer({
          objectOptions: self.#options.objectOptions,
          onFinish: data => self.#objectPromise.resolve(data),
          onError: error => self.#objectPromise.reject(error),
        }),
      )
      .pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            switch (chunk.type) {
              case 'object': {
                const array = chunk.object;
                // Only process arrays - stream individual elements as they become available
                if (Array.isArray(array)) {
                  // Publish new elements one by one
                  for (; publishedElements < array.length; publishedElements++) {
                    controller.enqueue(array[publishedElements]);
                  }
                }
                break;
              }
            }
          },
        }),
      );
  }

  get textStream() {
    const self = this;
    if (!self.#options.objectOptions) {
      return this.#modelOutput.textStream;
    }
    const responseFormat = getResponseFormat(self.#options.objectOptions);
    if (responseFormat?.type === 'json') {
      return this.#modelOutput.fullStream
        .pipeThrough(
          createObjectStreamTransformer({
            objectOptions: self.#options.objectOptions,
            onFinish: data => self.#objectPromise.resolve(data),
            onError: error => self.#objectPromise.reject(error),
          }),
        )
        .pipeThrough(createJsonTextStreamTransformer(self.#options.objectOptions));
    }

    return this.#modelOutput.textStream;
  }
  get object() {
    return this.#objectPromise.promise;
  }
}
