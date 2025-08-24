import { ReadableStream, TransformStream } from 'stream/web';
import { convertFullStreamChunkToMastra } from './aisdk/v4/transform';
import type { ChunkType } from './types';
import { ChunkFrom } from './types';

export class MastraAgentStream<Output> extends ReadableStream<ChunkType> {
  #usageCount = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  #bufferedText: string[] = [];
  #toolResults: Record<string, any>[] = [];
  #toolCalls: Record<string, any>[] = [];
  #finishReason: string | null = null;
  #streamPromise: {
    promise: Promise<void>;
    resolve: (value: void) => void;
    reject: (reason?: any) => void;
  };
  #resultAsObject: Output | null = null;

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
        }>
      | {
          runId: string;
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
        const { runId } = await getOptions();

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
          from: ChunkFrom.AGENT,
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
            const transformedChunk = convertFullStreamChunkToMastra(chunk, { runId });

            if (transformedChunk) {
              switch (transformedChunk.type) {
                case 'text-delta':
                  this.#bufferedText.push(transformedChunk.payload.text);
                  break;
                case 'tool-call':
                  this.#toolCalls.push(transformedChunk.payload);
                  break;
                case 'tool-result':
                  this.#toolResults.push(transformedChunk.payload);
                  break;
                case 'step-finish':
                  if (transformedChunk.payload.reason) {
                    this.#finishReason = transformedChunk.payload.reason;
                  }
                  break;
                case 'finish':
                  updateUsageCount(transformedChunk.payload.usage);
                  transformedChunk.payload.totalUsage = this.#usageCount;
                  break;
              }
              controller.enqueue(transformedChunk);
            }
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
