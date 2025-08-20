import { TransformStream } from 'stream/web';
import { getErrorMessage } from '@ai-sdk/provider-v5';
import { consumeStream, createTextStreamResponse, createUIMessageStream, createUIMessageStreamResponse } from 'ai-v5';
import type { ObjectStreamPart, TextStreamPart, ToolSet, UIMessage, UIMessageStreamOptions } from 'ai-v5';
import type { MessageList } from '../../../agent/message-list';
import type { ObjectOptions } from '../../../loop/types';
import type { MastraModelOutput } from '../../base/output';
import type { ChunkType } from '../../types';
import type { ConsumeStreamOptions } from './compat';
import { getResponseUIMessageId, convertFullStreamChunkToUIMessageStream } from './compat';
import { getResponseFormat } from './object/schema';
import { transformSteps } from './output-helpers';
import { convertMastraChunkToAISDKv5 } from './transform';
import type { OutputChunkType } from './transform';

type AISDKV5OutputStreamOptions = {
  toolCallStreaming?: boolean;
  includeRawChunks?: boolean;
  objectOptions?: ObjectOptions;
};

export class AISDKV5OutputStream {
  #modelOutput: MastraModelOutput;
  #options: AISDKV5OutputStreamOptions;
  #messageList: MessageList;
  constructor({
    modelOutput,
    options,
    messageList,
  }: {
    modelOutput: MastraModelOutput;
    options: AISDKV5OutputStreamOptions;
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
          const messageMetadataValue = messageMetadata?.({ part: part as TextStreamPart<ToolSet> });

          const partType = part.type;

          const transformedChunk = convertFullStreamChunkToUIMessageStream({
            part: part as TextStreamPart<ToolSet>,
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
    return this.#modelOutput.sources.then(sources =>
      sources.map(source => {
        return convertMastraChunkToAISDKv5({
          chunk: source,
        });
      }),
    );
  }

  get files() {
    return this.#modelOutput.files.then(files =>
      files
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
        .filter(Boolean),
    );
  }

  get text() {
    return this.#modelOutput.text;
  }

  get objectStream() {
    return this.#modelOutput.objectStream;
  }

  get generateTextFiles() {
    return this.#modelOutput.files.then(files =>
      files
        .map(file => {
          if (file.type === 'file') {
            return (
              convertMastraChunkToAISDKv5({
                chunk: file,
                mode: 'generate',
              }) as any
            )?.file;
          }
          return;
        })
        .filter(Boolean),
    );
  }

  get toolCalls() {
    return this.#modelOutput.toolCalls.then(toolCalls =>
      toolCalls.map(toolCall => {
        return convertMastraChunkToAISDKv5({
          chunk: toolCall,
        });
      }),
    );
  }

  get toolResults() {
    return this.#modelOutput.toolResults.then(toolResults =>
      toolResults.map(toolResult => {
        return convertMastraChunkToAISDKv5({
          chunk: toolResult,
        });
      }),
    );
  }

  get reasoningText() {
    return this.#modelOutput.reasoningText;
  }

  get reasoning() {
    return this.#modelOutput.reasoningDetails;
  }

  get response() {
    return this.#modelOutput.response.then(response => ({
      ...response,
    }));
  }

  get steps() {
    return this.#modelOutput.steps.then(steps => transformSteps({ steps }));
  }

  get generateTextSteps() {
    return this.#modelOutput.steps.then(steps => transformSteps({ steps }));
  }

  get content() {
    return this.#messageList.get.response.aiV5.modelContent();
  }

  get textStream() {
    return this.#modelOutput.textStream;
  }

  get elementStream() {
    return this.#modelOutput.elementStream;
  }

  get fullStream() {
    let startEvent: OutputChunkType;
    let hasStarted: boolean = false;

    // let stepCounter = 1;
    const responseFormat = getResponseFormat(this.#options.objectOptions?.schema);
    const fullStream = this.#modelOutput.fullStream;

    return fullStream.pipeThrough(
      new TransformStream<ChunkType | NonNullable<OutputChunkType>>({
        transform(chunk, controller) {
          if (responseFormat?.type === 'json' && chunk.type === 'object') {
            /**
             * Pass through 'object' chunks that were created by
             * createObjectStreamTransformer in base/output.ts.
             */
            controller.enqueue(chunk as ObjectStreamPart<any>);
            return;
          }

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

          if ('payload' in chunk) {
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
          }
        },
      }),
    );
  }

  async getFullOutput() {
    await this.consumeStream();

    const object = await this.object;

    const fullOutput = {
      text: await this.#modelOutput.text,
      usage: await this.#modelOutput.usage,
      steps: await this.generateTextSteps,
      finishReason: await this.#modelOutput.finishReason,
      warnings: await this.#modelOutput.warnings,
      providerMetadata: await this.#modelOutput.providerMetadata,
      request: await this.#modelOutput.request,
      reasoning: await this.reasoning,
      reasoningText: await this.reasoningText,
      toolCalls: await this.toolCalls,
      toolResults: await this.toolResults,
      sources: await this.sources,
      files: await this.generateTextFiles,
      response: await this.response,
      content: this.content,
      totalUsage: await this.#modelOutput.totalUsage,
      error: this.error,
      tripwire: this.#modelOutput.tripwire,
      tripwireReason: this.#modelOutput.tripwireReason,
      ...(object ? { object } : {}),
      // experimental_output: // TODO
    };

    fullOutput.response.messages = this.#modelOutput.messageList.get.response.aiV5.model();

    return fullOutput;
  }

  get error() {
    return this.#modelOutput.error;
  }

  get object() {
    return this.#modelOutput.object;
  }
}
