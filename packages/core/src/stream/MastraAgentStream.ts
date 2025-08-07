import { ReadableStream, TransformStream, TextEncoderStream, TextDecoderStream } from 'stream/web';
import type { DataStreamOptions, DataStreamWriter, LanguageModelV1StreamPart, StreamData } from 'ai';
import { formatDataStreamPart } from 'ai';
import {
  consumeStream,
  getErrorMessage,
  getErrorMessageV4,
  mergeStreams,
  prepareResponseHeaders,
} from '../llm/model/stream/ai-sdk/v4/compat';
import type { ConsumeStreamOptions } from '../llm/model/stream/ai-sdk/v4/compat';
import { DefaultGeneratedFileWithType } from '../llm/model/stream/ai-sdk/v4/file';
import type { ChunkType } from './types';
export type { ChunkType } from './types';

function convertFullStreamChunkToAISDKv4({
  chunk,
  client,
  sendReasoning,
  sendSources,
  sendUsage = true,
  experimental_sendFinish = true,
  toolCallArgsDeltas,
  toolCallStreaming,
  getErrorMessage,
}: {
  chunk: any;
  client: boolean;
  sendReasoning: boolean;
  sendSources: boolean;
  sendUsage: boolean;
  experimental_sendFinish?: boolean;
  toolCallArgsDeltas?: Record<string, string[]>;
  toolCallStreaming?: boolean;
  getErrorMessage: (error: string) => string;
}) {
  if (chunk.type === 'text-delta') {
    if (client) {
      return formatDataStreamPart('text', chunk.payload.text);
    }
    return {
      type: 'text-delta',
      textDelta: chunk.payload.text,
    };
  } else if (chunk.type === 'step-start') {
    if (client) {
      return formatDataStreamPart('start_step', {
        messageId: chunk.payload.messageId,
      });
    }
    return {
      type: 'step-start',
      ...(chunk.payload || {}),
    };
  } else if (chunk.type === 'step-finish') {
    if (client) {
      if (!chunk.payload) {
        return;
      }
      console.log('finish_step', chunk);
      return formatDataStreamPart('finish_step', {
        finishReason: chunk.payload?.reason,
        usage: sendUsage
          ? {
              promptTokens: chunk.payload.totalUsage.promptTokens,
              completionTokens: chunk.payload.totalUsage.completionTokens,
            }
          : undefined,
        isContinued: chunk.payload.isContinued,
      });
    }

    const { totalUsage, reason, ...rest } = chunk.payload;
    return {
      usage: {
        promptTokens: totalUsage.promptTokens,
        completionTokens: totalUsage.completionTokens,
        totalTokens: totalUsage.totalTokens || totalUsage.promptTokens + totalUsage.completionTokens,
      },
      ...rest,
      finishReason: reason,
      type: 'step-finish',
    };
  } else if (chunk.type === 'finish') {
    if (client) {
      if (experimental_sendFinish) {
        return formatDataStreamPart('finish_message', {
          finishReason: chunk.payload.finishReason,
          usage: sendUsage
            ? {
                promptTokens: chunk.payload.usage.promptTokens,
                completionTokens: chunk.payload.usage.completionTokens,
              }
            : undefined,
        });
      }
      return;
    }

    return {
      type: 'finish',
      ...chunk.payload,
    };
  } else if (chunk.type === 'reasoning') {
    if (client) {
      if (sendReasoning) {
        return formatDataStreamPart('reasoning', chunk.payload.text);
      }
      return;
    }
    return {
      type: 'reasoning',
      textDelta: chunk.payload.text,
    };
  } else if (chunk.type === 'reasoning-signature') {
    if (client) {
      if (sendReasoning) {
        return formatDataStreamPart('reasoning_signature', {
          signature: chunk.payload.signature,
        });
      }
      return;
    }
    return {
      type: 'reasoning-signature',
      signature: chunk.payload.signature,
    };
  } else if (chunk.type === 'redacted-reasoning') {
    if (client) {
      if (sendReasoning) {
        return formatDataStreamPart('redacted_reasoning', {
          data: chunk.payload.data,
        });
      }
      return;
    }
    return {
      type: 'redacted-reasoning',
      data: chunk.payload.data,
    };
  } else if (chunk.type === 'source') {
    if (client && sendSources) {
      return formatDataStreamPart('source', chunk.payload.source);
    }
    return {
      type: 'source',
      source: chunk.payload.source,
    };
  } else if (chunk.type === 'file') {
    if (client) {
      return formatDataStreamPart('file', {
        mimeType: chunk.payload.mimeType,
        data: chunk.payload.data,
      });
    }
    return new DefaultGeneratedFileWithType({
      data: chunk.payload.data,
      mimeType: chunk.payload.mimeType,
    });
  } else if (chunk.type === 'tool-call') {
    if (client) {
      let args;

      if (!chunk.payload.args) {
        args = toolCallArgsDeltas?.[chunk.payload.toolCallId]?.join('') ?? '';
      } else {
        args = chunk.payload.args;
      }

      return formatDataStreamPart('tool_call', {
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: JSON.parse(args),
      });
    }

    return {
      type: 'tool-call',
      toolCallId: chunk.payload.toolCallId,
      toolName: chunk.payload.toolName,
      args: JSON.parse(chunk.payload.args),
    };
  } else if (chunk.type === 'tool-call-streaming-start' && toolCallStreaming) {
    if (client) {
      return formatDataStreamPart('tool_call_streaming_start', {
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
      });
    }
    return {
      type: 'tool-call-streaming-start',
      toolCallId: chunk.payload.toolCallId,
      toolName: chunk.payload.toolName,
    };
  } else if (chunk.type === 'tool-call-delta' && toolCallStreaming) {
    if (client) {
      return formatDataStreamPart('tool_call_delta', {
        toolCallId: chunk.payload.toolCallId,
        argsTextDelta: chunk.payload.argsTextDelta,
      });
    }
    return {
      type: 'tool-call-delta',
      toolCallId: chunk.payload.toolCallId,
      argsTextDelta: chunk.payload.argsTextDelta,
    };
  } else if (chunk.type === 'tool-result') {
    if (client) {
      return formatDataStreamPart('tool_result', {
        toolCallId: chunk.payload.toolCallId,
        result: chunk.payload.result,
      });
    }
    return {
      type: 'tool-result',
      args: chunk.payload.args,
      toolCallId: chunk.payload.toolCallId,
      toolName: chunk.payload.toolName,
      result: chunk.payload.result,
    };
  } else if (chunk.type === 'error') {
    if (client) {
      return formatDataStreamPart('error', getErrorMessage(chunk.payload.error));
    }
    return {
      type: 'error',
      error: chunk.payload.error,
    };
  } else {
    console.log('unknown chunk', chunk);
  }
}

function convertFullStreamChunkToMastra(value: any, ctx: { runId: string }, write: (chunk: any) => void) {
  if (value.type === 'step-start') {
    write({
      type: 'step-start',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        messageId: value.messageId,
        request: { body: JSON.parse(value.request!.body ?? '{}') },
        warnings: value.warnings,
      },
    });
  } else if (value.type === 'tool-call') {
    write({
      type: 'tool-call',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        toolCallId: value.toolCallId,
        args: value.args,
        toolName: value.toolName,
      },
    });
  } else if (value.type === 'tool-result') {
    write({
      type: 'tool-result',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        toolCallId: value.toolCallId,
        toolName: value.toolName,
        args: value.args,
        result: value.result,
      },
    });
  } else if (value.type === 'tool-call-delta') {
    write({
      type: 'tool-call-delta',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        argsTextDelta: value.argsTextDelta,
        toolCallId: value.toolCallId,
        toolName: value.toolName,
      },
    });
  } else if (value.type === 'tool-call-streaming-start') {
    write({
      type: 'tool-call-streaming-start',
      runId: ctx.runId,
      from: 'AGENT',
      payload: value,
    });
  } else if (value.type === 'text-delta') {
    if (value.textDelta) {
      write({
        type: 'text-delta',
        runId: ctx.runId,
        from: 'AGENT',
        payload: {
          text: value.textDelta,
        },
      });
    }
  } else if (value.type === 'step-finish') {
    write({
      type: 'step-finish',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        reason: value.finishReason,
        usage: value.usage,
        response: value.response,
        messageId: value.messageId,
        providerMetadata: value.providerMetadata,
      },
    });
  } else if (value.type === 'finish') {
    const { finishReason, usage, providerMetadata, ...rest } = value;
    write({
      type: 'finish',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        reason: value.finishReason,
        usage: value.usage,
        providerMetadata: value.providerMetadata,
        ...rest,
      },
    });
  } else if (value.type === 'response-metadata') {
    write({
      type: 'response-metadata',
      runId: ctx.runId,
      from: 'AGENT',
      payload: value,
    });
  } else if (value.type === 'reasoning') {
    write({
      type: 'reasoning',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        text: value.textDelta,
      },
    });
  } else if (value.type === 'reasoning-signature') {
    write({
      type: 'reasoning-signature',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        signature: value.signature,
      },
    });
  } else if (value.type === 'redacted-reasoning') {
    write({
      type: 'redacted-reasoning',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        data: value.data,
      },
    });
  } else if (value.type === 'source') {
    write({
      type: 'source',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        source: value.source,
      },
    });
  } else if (value.type === 'file') {
    write({
      type: 'file',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        data: value.data,
        base64: value.base64,
        mimeType: value.mimeType,
      },
    });
  } else if (value.type === 'error') {
    console.log('error to MASTRA', value);
    write({
      type: 'error',
      runId: ctx.runId,
      from: 'AGENT',
      payload: {
        error: value.error,
      },
    });
  }
}

export class MastraStreamManager<Output> {}

export class MastraAgentStream<Output> extends ReadableStream<ChunkType> {
  #usageCount = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  #bufferedText: string[] = [];
  #toolCallArgsDeltas: Record<string, string[]> = {};
  #toolResults: Record<string, any>[] = [];
  #toolCalls: Record<string, any>[] = [];
  #finishReason: string | null = null;
  #streamPromise: {
    promise: Promise<void>;
    resolve: (value: void) => void;
    reject: (reason?: any) => void;
  };
  #resultAsObject: Output | null = null;
  #toolCallStreaming: boolean | undefined;

  constructor({
    createStream,
    getOptions,
  }: {
    createStream: (
      writer: WritableStream<ChunkType>,
      onResult: (result: Output) => void,
    ) => Promise<ReadableStream<any>> | ReadableStream<any>;
    getOptions: () =>
      | Promise<{
          runId: string;
          toolCallStreaming?: boolean;
        }>
      | {
          runId: string;
          toolCallStreaming?: boolean;
        };
  }) {
    const deferredPromise = {
      promise: null,
      resolve: null,
      reject: null,
    } as unknown as {
      promise: Promise<void>;
      resolve: (value: void) => void;
      reject: (reason?: any) => void;
    };
    deferredPromise.promise = new Promise((resolve, reject) => {
      deferredPromise.resolve = resolve;
      deferredPromise.reject = reject;
    });

    super({
      start: async controller => {
        const { runId, toolCallStreaming } = await getOptions();

        this.#toolCallStreaming = toolCallStreaming;

        const writer = new WritableStream<ChunkType>({
          write: chunk => {
            if (
              chunk.type === 'tool-output' &&
              chunk.payload?.output?.from === 'AGENT' &&
              chunk.payload?.output?.type === 'finish'
            ) {
              const finishPayload = chunk.payload?.output.payload;
              updateUsageCount(finishPayload.usage);
            }

            controller.enqueue(chunk);
          },
        });

        controller.enqueue({
          type: 'start',
          runId,
          from: 'AGENT',
          payload: {},
        });

        const updateUsageCount = (usage: {
          promptTokens?: `${number}` | number;
          completionTokens?: `${number}` | number;
          totalTokens?: `${number}` | number;
        }) => {
          this.#usageCount.promptTokens += parseInt(usage.promptTokens?.toString() ?? '0', 10);
          this.#usageCount.completionTokens += parseInt(usage.completionTokens?.toString() ?? '0', 10);
          this.#usageCount.totalTokens += parseInt(usage.totalTokens?.toString() ?? '0', 10);
        };

        try {
          const stream = await createStream(writer, result => {
            this.#resultAsObject = result;
          });

          for await (const chunk of stream) {
            console.log('CHUNK ####', chunk);
            convertFullStreamChunkToMastra(chunk, { runId }, chunk => {
              switch (chunk.type) {
                case 'tool-call-delta':
                  if (!this.#toolCallArgsDeltas[chunk.payload.toolCallId]) {
                    this.#toolCallArgsDeltas[chunk.payload.toolCallId] = [];
                    controller.enqueue({
                      type: 'tool-call-streaming-start',
                      from: 'AGENT',
                      runId,
                      payload: {
                        toolCallId: chunk.payload.toolCallId,
                        toolName: chunk.payload.toolName,
                      },
                    });
                  }
                  this.#toolCallArgsDeltas?.[chunk.payload.toolCallId]?.push(chunk.payload.argsTextDelta);
                  break;
                case 'text-delta':
                  this.#bufferedText.push(chunk.payload.text);
                  break;
                case 'tool-call':
                  this.#toolCalls.push(chunk.payload);
                  break;
                case 'tool-result':
                  this.#toolResults.push(chunk.payload);
                  break;
                case 'step-finish':
                case 'finish':
                  if (chunk.payload.reason) {
                    this.#finishReason = chunk.payload.reason;
                  }
                  updateUsageCount(chunk.payload.usage);
                  chunk.payload.totalUsage = this.#usageCount;
                  break;
              }

              console.log('WTF IS', chunk);
              controller.enqueue(chunk);
            });
          }

          controller.close();
          deferredPromise.resolve();
        } catch (error) {
          controller.error(error);
          deferredPromise.reject(error);
        }
      },
    });

    this.#streamPromise = deferredPromise;
  }

  teeStream() {
    const [stream1] = this.tee();
    return stream1;
  }

  get toFullStreamV4() {
    const toolCallArgsDeltas = this.#toolCallArgsDeltas;
    return this.teeStream().pipeThrough(
      new TransformStream<ChunkType, LanguageModelV1StreamPart>({
        transform(chunk, controller) {
          const transformedChunk = convertFullStreamChunkToAISDKv4({
            chunk,
            client: false,
            sendReasoning: false,
            sendSources: false,
            sendUsage: false,
            experimental_sendFinish: false,
            toolCallArgsDeltas: toolCallArgsDeltas,
            getErrorMessage,
          });

          if (transformedChunk) {
            controller.enqueue(transformedChunk as LanguageModelV1StreamPart);
          }
        },
      }),
    );
  }

  mergeIntoDataStream(writer: DataStreamWriter, options?: DataStreamOptions) {
    writer.merge(
      this.toDataStreamV4({
        getErrorMessage: writer.onError,
        sendUsage: options?.sendUsage,
        sendReasoning: options?.sendReasoning,
        sendSources: options?.sendSources,
        experimental_sendFinish: options?.experimental_sendFinish,
      })
        .pipeThrough(new TextEncoderStream() as unknown as TransformStream<LanguageModelV1StreamPart, Uint8Array>)
        .pipeThrough(new TextDecoderStream()) as Parameters<typeof writer.merge>[0],
    );
  }

  toTextStreamResponse(init?: ResponseInit): Response {
    return new Response(this.textStream.pipeThrough(new TextEncoderStream()) as BodyInit, {
      status: init?.status ?? 200,
      headers: prepareResponseHeaders(init?.headers, {
        contentType: 'text/plain; charset=utf-8',
      }),
    });
  }

  async consumeStream(options?: ConsumeStreamOptions): Promise<void> {
    try {
      await consumeStream({
        stream: this.pipeThrough(
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

  toDataStreamResponseV4({
    headers,
    status,
    statusText,
    data,
    getErrorMessage,
    sendUsage,
    sendReasoning,
    sendSources,
    experimental_sendFinish,
  }: ResponseInit &
    DataStreamOptions & {
      data?: StreamData;
      getErrorMessage?: (error: unknown) => string;
    } = {}): Response {
    let dataStream = this.toDataStreamV4({
      getErrorMessage,
      sendUsage,
      sendReasoning,
      sendSources,
      experimental_sendFinish,
    }).pipeThrough(new TextEncoderStream() as unknown as TransformStream<LanguageModelV1StreamPart, Uint8Array>);

    if (data) {
      dataStream = mergeStreams(
        data.stream as unknown as ReadableStream<Uint8Array>,
        dataStream,
      ) as ReadableStream<Uint8Array>;
    }

    return new Response(dataStream as BodyInit, {
      status,
      statusText,
      headers: prepareResponseHeaders(headers, {
        contentType: 'text/plain; charset=utf-8',
        dataStreamVersion: 'v1',
      }),
    });
  }

  toDataStreamV4({
    sendReasoning = false,
    sendSources = false,
    sendUsage = true,
    experimental_sendFinish = true,
    getErrorMessage = getErrorMessageV4,
  }: {
    sendReasoning?: boolean;
    sendSources?: boolean;
    sendUsage?: boolean;
    experimental_sendFinish?: boolean;
    getErrorMessage?: (error: string) => string;
  } = {}) {
    const toolCallArgsDeltas = this.#toolCallArgsDeltas;
    const toolCallStreaming = this.#toolCallStreaming;

    return this.pipeThrough(
      new TransformStream<ChunkType, LanguageModelV1StreamPart>({
        transform(chunk, controller) {
          const transformedChunk = convertFullStreamChunkToAISDKv4({
            chunk,
            client: true,
            sendReasoning,
            sendSources,
            sendUsage,
            experimental_sendFinish,
            toolCallArgsDeltas: toolCallArgsDeltas,
            toolCallStreaming,
            getErrorMessage,
          });

          if (transformedChunk) {
            controller.enqueue(transformedChunk as LanguageModelV1StreamPart);
          }
        },
      }),
    );
  }

  get finishReason() {
    return this.#streamPromise.promise.then(() => this.#finishReason);
  }

  get toolCalls() {
    return this.#streamPromise.promise.then(() => this.#toolCalls);
  }

  get toolResults() {
    return this.#streamPromise.promise.then(() => this.#toolResults);
  }

  get usage() {
    return this.#streamPromise.promise.then(() => this.#usageCount);
  }

  get text() {
    return this.#streamPromise.promise.then(() => this.#bufferedText.join(''));
  }

  get object(): Promise<Output extends undefined ? null : Output> {
    return this.#streamPromise.promise.then(() => this.#resultAsObject) as Promise<
      Output extends undefined ? null : Output
    >;
  }

  get textStream() {
    return this.pipeThrough(
      new TransformStream<ChunkType, string>({
        transform(chunk, controller) {
          if (chunk.type === 'text-delta') {
            controller.enqueue(chunk.payload.text);
          }
        },
      }),
    );
  }
}
