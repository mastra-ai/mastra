import type { ReadableStream } from 'node:stream/web';
import { TransformStream } from 'node:stream/web';
import { getErrorMessage } from '@ai-sdk/provider-v5';
import {
  createTextStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from '@internal/ai-sdk-v5';
import type { ObjectStreamPart, TextStreamPart, ToolSet, UIMessage, UIMessageStreamOptions } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MessageList } from '../../../agent/message-list';
import type { LLMStepResult, StructuredOutputOptions } from '../../../agent/types';
import type { TracingContext } from '../../../observability';
import type { MastraModelOutput } from '../../base/output';
import type { InferSchemaOutput, OutputSchema } from '../../base/schema';
import type { ChunkType, StepTripwireData } from '../../types';
import type { ConsumeStreamOptions } from './compat';
import { getResponseUIMessageId, convertFullStreamChunkToUIMessageStream } from './compat';
import { convertMastraChunkToAISDKv5 } from './transform';
import type { OutputChunkType } from './transform';

export type AISDKV5FullOutput<OUTPUT extends OutputSchema = undefined> = {
  text: string;
  usage: LLMStepResult['usage'];
  steps: LLMStepResult<OUTPUT>[];
  finishReason: LLMStepResult['finishReason'];
  warnings: LLMStepResult['warnings'];
  providerMetadata: LLMStepResult['providerMetadata'];
  request: LLMStepResult['request'];
  reasoning: {
    providerMetadata: LLMStepResult['providerMetadata'];
    text: string;
    type: 'reasoning';
  }[];
  reasoningText: string | undefined;
  toolCalls: ReturnType<typeof convertMastraChunkToAISDKv5>[];
  toolResults: ReturnType<typeof convertMastraChunkToAISDKv5>[];
  sources: ReturnType<typeof convertMastraChunkToAISDKv5>[];
  files: unknown[];
  response: LLMStepResult['response'];
  content: LLMStepResult['content'];
  totalUsage: LLMStepResult['usage'];
  error: Error | string | { message: string; stack: string } | undefined;
  tripwire: StepTripwireData | undefined;
  traceId: string | undefined;
  /** All messages from this execution (input + memory history + response) */
  messages: MastraDBMessage[];
  /** Only messages loaded from memory (conversation history) */
  rememberedMessages: MastraDBMessage[];
  object?: InferSchemaOutput<OUTPUT>;
};

type AISDKV5OutputStreamOptions<OUTPUT extends OutputSchema = undefined> = {
  toolCallStreaming?: boolean;
  includeRawChunks?: boolean;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  tracingContext?: TracingContext;
};

export type AIV5FullStreamPart<OUTPUT extends OutputSchema = undefined> = OUTPUT extends undefined
  ? TextStreamPart<ToolSet>
  :
      | TextStreamPart<ToolSet>
      | {
          type: 'object';
          object: InferSchemaOutput<OUTPUT>;
        };
export type AIV5FullStreamType<OUTPUT extends OutputSchema = undefined> = ReadableStream<AIV5FullStreamPart<OUTPUT>>;

export class AISDKV5OutputStream<OUTPUT extends OutputSchema = undefined> {
  #modelOutput: MastraModelOutput<OUTPUT>;
  #options: AISDKV5OutputStreamOptions<OUTPUT>;
  #messageList: MessageList;

  /**
   * Trace ID used on the execution (if the execution was traced).
   */
  public traceId?: string;

  constructor({
    modelOutput,
    options,
    messageList,
  }: {
    modelOutput: MastraModelOutput<OUTPUT>;
    options: AISDKV5OutputStreamOptions<OUTPUT>;
    messageList: MessageList;
  }) {
    this.#modelOutput = modelOutput;
    this.#options = options;
    this.#messageList = messageList;
    this.traceId = options.tracingContext?.currentSpan?.externalTraceId;
  }

  toTextStreamResponse(init?: ResponseInit): Response {
    return createTextStreamResponse({
      // Type assertion needed due to ReadableStream type mismatch between Node.js (stream/web) and DOM types
      // Both have the same interface but TypeScript treats them as incompatible
      textStream: this.#modelOutput.textStream as unknown as globalThis.ReadableStream<string>,
      ...init,
    });
  }

  toUIMessageStreamResponse<UI_MESSAGE extends UIMessage>({
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
    let responseMessageId =
      generateMessageId != null
        ? getResponseUIMessageId({
            originalMessages,
            responseMessageId: generateMessageId,
          })
        : undefined;

    return createUIMessageStream({
      onError,
      onFinish,
      generateId: () => responseMessageId ?? generateMessageId?.() ?? generateId(),
      execute: async ({ writer }) => {
        for await (const part of this.fullStream) {
          const messageMetadataValue = messageMetadata?.({ part: part as TextStreamPart<ToolSet> });

          const partType = part.type;

          responseMessageId = this.#modelOutput.messageId;

          const transformedChunk = convertFullStreamChunkToUIMessageStream<UI_MESSAGE>({
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
            writer.write(transformedChunk);
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
    await this.#modelOutput.consumeStream(options);
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
            const result = convertMastraChunkToAISDKv5({
              chunk: file,
            });
            return result && 'file' in result ? result.file : undefined;
          }
          return;
        })
        .filter(Boolean),
    );
  }

  get text() {
    return this.#modelOutput.text;
  }

  /**
   * Stream of valid JSON chunks. The final JSON result is validated against the output schema when the stream ends.
   */
  get objectStream() {
    return this.#modelOutput.objectStream;
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
    return this.#modelOutput.reasoning.then(reasoningChunk => {
      return reasoningChunk.map(reasoningPart => {
        return {
          providerMetadata: reasoningPart.payload.providerMetadata,
          text: reasoningPart.payload.text,
          type: 'reasoning',
        };
      });
    });
  }

  get warnings() {
    return this.#modelOutput.warnings;
  }

  get usage() {
    return this.#modelOutput.usage;
  }

  get finishReason() {
    return this.#modelOutput.finishReason;
  }

  get providerMetadata() {
    return this.#modelOutput.providerMetadata;
  }

  get request() {
    return this.#modelOutput.request;
  }

  get totalUsage() {
    return this.#modelOutput.totalUsage;
  }

  get response() {
    return this.#modelOutput.response.then(response => ({
      ...response,
    }));
  }

  get steps() {
    return this.#modelOutput.steps.then(steps => steps);
  }

  get content(): LLMStepResult['content'] {
    return this.#messageList.get.response.aiV5.modelContent();
  }

  /**
   * Stream of only text content, compatible with streaming text responses.
   */
  get textStream() {
    return this.#modelOutput.textStream;
  }

  /**
   * Stream of individual array elements when output schema is an array type.
   */
  get elementStream() {
    return this.#modelOutput.elementStream;
  }

  /**
   * Stream of all chunks in AI SDK v5 format.
   */
  get fullStream(): AIV5FullStreamType<OUTPUT> {
    let startEvent: OutputChunkType;
    let hasStarted: boolean = false;

    // let stepCounter = 1;

    return this.#modelOutput.fullStream.pipeThrough(
      new TransformStream<
        ChunkType<OUTPUT> | NonNullable<OutputChunkType>,
        TextStreamPart<ToolSet> | ObjectStreamPart<OUTPUT>
      >({
        transform(chunk, controller) {
          if (chunk.type === 'object') {
            /**
             * Pass through 'object' chunks
             */
            controller.enqueue(chunk as TextStreamPart<ToolSet> | ObjectStreamPart<OUTPUT>);
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
            controller.enqueue(startEvent as TextStreamPart<ToolSet> | ObjectStreamPart<OUTPUT>);
            startEvent = undefined;
          }

          if ('payload' in chunk) {
            const transformedChunk = convertMastraChunkToAISDKv5<OUTPUT>({
              chunk,
            });

            if (transformedChunk) {
              // if (!['start', 'finish', 'finish-step'].includes(transformedChunk.type)) {
              //   console.log('step counter', stepCounter);
              //   transformedChunk.id = transformedChunk.id ?? stepCounter.toString();
              // }

              controller.enqueue(transformedChunk as TextStreamPart<ToolSet> | ObjectStreamPart<OUTPUT>);
            }
          }
        },
      }),
    ) as AIV5FullStreamType<OUTPUT>;
  }

  async getFullOutput() {
    await this.consumeStream({
      onError: (error: any) => {
        throw error;
      },
    });

    const object = await this.object;

    const fullOutput: AISDKV5FullOutput<OUTPUT> = {
      text: await this.#modelOutput.text,
      usage: await this.#modelOutput.usage,
      steps: await this.steps,
      finishReason: await this.#modelOutput.finishReason,
      warnings: await this.#modelOutput.warnings,
      providerMetadata: await this.#modelOutput.providerMetadata,
      request: await this.#modelOutput.request,
      reasoning: await this.reasoning,
      reasoningText: await this.reasoningText,
      toolCalls: await this.toolCalls,
      toolResults: await this.toolResults,
      sources: await this.sources,
      files: await this.files,
      response: await this.response,
      content: this.content,
      totalUsage: await this.#modelOutput.totalUsage,
      error: this.error,
      tripwire: this.#modelOutput.tripwire,
      traceId: this.traceId,
      // All messages from this execution (input + memory history + response)
      messages: this.#modelOutput.messageList.get.all.db(),
      // Only messages loaded from memory (conversation history)
      rememberedMessages: this.#modelOutput.messageList.get.remembered.db(),
      ...(object !== undefined ? { object } : {}),
    };

    fullOutput.response.messages = this.#modelOutput.messageList.get.response.aiV5.model();

    return fullOutput;
  }

  get tripwire() {
    return this.#modelOutput.tripwire;
  }

  get error() {
    return this.#modelOutput.error;
  }

  get object() {
    return this.#modelOutput.object;
  }
}
