import { ReadableStream } from 'stream/web';
import type { Run } from '../workflows';
import type { ChunkType } from './types';
import { ChunkFrom } from './types';

export class MastraWorkflowStream extends ReadableStream<ChunkType> {
  #usageCount = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  #streamPromise: {
    promise: Promise<void>;
    resolve: (value: void) => void;
    reject: (reason?: any) => void;
  };
  #run: Run;

  constructor({
    createStream,
    run,
  }: {
    createStream: (writer: WritableStream<ChunkType>) => Promise<ReadableStream<any>> | ReadableStream<any>;
    run: Run;
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

    const updateUsageCount = (usage: {
      promptTokens?: `${number}` | number;
      completionTokens?: `${number}` | number;
      totalTokens?: `${number}` | number;
    }) => {
      this.#usageCount.promptTokens += parseInt(usage.promptTokens?.toString() ?? '0', 10);
      this.#usageCount.completionTokens += parseInt(usage.completionTokens?.toString() ?? '0', 10);
      this.#usageCount.totalTokens += parseInt(usage.totalTokens?.toString() ?? '0', 10);
    };

    super({
      start: async controller => {
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
              const finishPayload = chunk.payload?.output.payload;
              updateUsageCount(finishPayload.usage);
            }

            controller.enqueue(chunk);
          },
        });

        controller.enqueue({
          type: 'workflow-start',
          runId: run.runId,
          from: ChunkFrom.WORKFLOW,
          payload: {},
        });

        const stream: ReadableStream<ChunkType> = await createStream(writer);

        for await (const chunk of stream) {
          // update the usage count
          if (chunk.type === 'step-finish') {
            updateUsageCount(chunk.payload.usage);
          }

          controller.enqueue(chunk);
        }

        controller.enqueue({
          type: 'workflow-finish',
          runId: run.runId,
          from: ChunkFrom.WORKFLOW,
          payload: {
            stepResult: {
              reason: 'stop',
            },
            output: {
              usage: this.#usageCount as any,
            },
            metadata: {},
            messages: {
              all: [],
              user: [],
              nonUser: [],
            },
          },
        });

        controller.close();
        deferredPromise.resolve();
      },
    });

    this.#run = run;
    this.#streamPromise = deferredPromise;
  }

  get status() {
    return this.#streamPromise.promise.then(() => this.#run._getExecutionResults()).then(res => res!.status);
  }

  get result() {
    return this.#streamPromise.promise.then(() => this.#run._getExecutionResults());
  }

  get usage() {
    return this.#streamPromise.promise.then(() => this.#usageCount);
  }
}
