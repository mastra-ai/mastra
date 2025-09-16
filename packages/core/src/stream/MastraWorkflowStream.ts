import { ReadableStream } from 'stream/web';
import type { Run } from '../workflows';
import type { ChunkType } from './types';
import { ChunkFrom } from './types';

export class MastraWorkflowStream extends ReadableStream<ChunkType> {
  #usageCount = {
    inputTokens: 0,
    outputTokens: 0,
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
      inputTokens?: `${number}` | number;
      outputTokens?: `${number}` | number;
      totalTokens?: `${number}` | number;
    }) => {
      this.#usageCount.inputTokens += parseInt(usage?.inputTokens?.toString() ?? '0', 10);
      this.#usageCount.outputTokens += parseInt(usage?.outputTokens?.toString() ?? '0', 10);
      this.#usageCount.totalTokens += parseInt(usage?.totalTokens?.toString() ?? '0', 10);
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
              if (finishPayload) {
                updateUsageCount(finishPayload.usage);
              }
            }

            controller.enqueue(chunk);
          },
        });

        controller.enqueue({
          type: 'workflow-start',
          runId: run.runId,
          from: ChunkFrom.WORKFLOW,
          payload: {
            workflowId: run.workflowId,
          },
        });

        const stream: ReadableStream<ChunkType> = await createStream(writer);

        let workflowStatus = 'success';

        for await (const chunk of stream) {
          // update the usage count
          if (chunk.type === 'step-finish' && chunk.payload.usage) {
            updateUsageCount(chunk.payload.usage);
          } else if (chunk.type === 'workflow-canceled') {
            workflowStatus = 'canceled';
          } else if (chunk.type === 'workflow-step-result' && chunk.payload.status === 'failed') {
            workflowStatus = 'failed';
          }

          controller.enqueue(chunk);
        }

        controller.enqueue({
          type: 'workflow-finish',
          runId: run.runId,
          from: ChunkFrom.WORKFLOW,
          payload: {
            workflowStatus,
            output: {
              usage: this.#usageCount as any,
            },
            metadata: {},
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
