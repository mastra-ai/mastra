import { ReadableStream, TransformStream } from 'stream/web';

export type ChunkType = {
  type: string;
  runId: string;
  from: string;
  payload: Record<string, any>;
};

export class MastraWorkflowStream extends ReadableStream<ChunkType> {
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

  constructor({
    createStream,
    getOptions,
  }: {
    createStream: (writer: WritableStream<ChunkType>) => Promise<ReadableStream<any>> | ReadableStream<any>;
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
              (chunk.type === 'step-output' &&
                chunk.payload?.output?.from === 'AGENT' &&
                chunk.payload?.output?.type === 'finish') ||
              (chunk.type === 'step-output' &&
                chunk.payload?.output?.from === 'WORKFLOW' &&
                chunk.payload?.output?.type === 'finish')
            ) {
              console.log('WRITING ?????');

              const finishPayload = chunk.payload?.output.payload;
              updateUsageCount(finishPayload.usage);
            }

            controller.enqueue(chunk);
          },
        });

        this.#usageCount = {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        };

        controller.enqueue({
          type: 'start',
          runId,
          from: 'WORKFLOW',
          payload: {},
        });

        const stream = await createStream(writer);

        const updateUsageCount = (usage: {
          promptTokens?: `${number}` | number;
          completionTokens?: `${number}` | number;
          totalTokens?: `${number}` | number;
        }) => {
          this.#usageCount.promptTokens += parseInt(usage.promptTokens?.toString() ?? '0', 10);
          this.#usageCount.completionTokens += parseInt(usage.completionTokens?.toString() ?? '0', 10);
          this.#usageCount.totalTokens += parseInt(usage.totalTokens?.toString() ?? '0', 10);
        };

        for await (const chunk of stream) {
          if (
            (chunk.type === 'step-output' &&
              chunk.payload?.output?.from === 'AGENT' &&
              chunk.payload?.output?.type === 'finish') ||
            (chunk.type === 'step-output' &&
              chunk.payload?.output?.from === 'WORKFLOW' &&
              chunk.payload?.output?.type === 'finish')
          ) {
            console.log('WRITING ?????');

            const finishPayload = chunk.payload?.output.payload;
            updateUsageCount(finishPayload.usage);
          }

          controller.enqueue(chunk);
        }
        controller.enqueue({
          type: 'finish',
          runId,
          from: 'WORKFLOW',
          payload: {
            usage: this.#usageCount,
          },
        });

        controller.close();
        deferredPromise.resolve();
      },
    });

    this.#streamPromise = deferredPromise;
  }

  get finishReason() {
    return this.#streamPromise.promise.then(() => this.#finishReason);
  }

  get usage() {
    return this.#streamPromise.promise.then(() => this.#usageCount);
  }
}
