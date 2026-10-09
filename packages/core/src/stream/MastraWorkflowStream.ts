import { ReadableStream } from 'node:stream/web';
import type { Run, Step, WorkflowRunStatus } from '../workflows';
import type { ChunkType } from './types';
import { ChunkFrom } from './types';

const primaryUsageKeys = ['inputTokens', 'outputTokens', 'totalTokens'] as const;

export class MastraWorkflowStream<
  TState,
  TInput,
  TOutput,
  TSteps extends Step<string, any, any>[],
> extends ReadableStream<ChunkType> {
  #usageCount: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
    cachedInputTokens?: number;
    cacheCreationInputTokens?: number;
  } = {
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
  };
  #usageCountMissing = new Set<(typeof primaryUsageKeys)[number]>();
  #streamPromise: {
    promise: Promise<void>;
    resolve: (value: void) => void;
    reject: (reason?: any) => void;
  };
  #run: Run<any, TSteps, TState, TInput, TOutput>;

  constructor({
    createStream,
    run,
  }: {
    createStream: (writer: WritableStream<ChunkType>) => Promise<ReadableStream<any>> | ReadableStream<any>;
    run: Run<any, TSteps, TState, TInput, TOutput>;
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

    const updateUsageCount = (
      usage:
        | {
            inputTokens?: `${number}` | number;
            outputTokens?: `${number}` | number;
            totalTokens?: `${number}` | number;
            cachedInputTokens?: `${number}` | number;
            cacheCreationInputTokens?: `${number}` | number;
          }
        | {
            promptTokens?: `${number}` | number;
            completionTokens?: `${number}` | number;
            totalTokens?: `${number}` | number;
            cachedInputTokens?: `${number}` | number;
            cacheCreationInputTokens?: `${number}` | number;
          },
    ) => {
      const primaryUsage = {
        inputTokens:
          'inputTokens' in usage ? usage.inputTokens : 'promptTokens' in usage ? usage.promptTokens : undefined,
        outputTokens:
          'outputTokens' in usage
            ? usage.outputTokens
            : 'completionTokens' in usage
              ? usage.completionTokens
              : undefined,
        totalTokens: usage.totalTokens,
      };

      for (const key of primaryUsageKeys) {
        const value = primaryUsage[key] === undefined ? undefined : Number(primaryUsage[key]);
        if (value === undefined) {
          this.#usageCountMissing.add(key);
          this.#usageCount[key] = undefined;
        } else if (!this.#usageCountMissing.has(key)) {
          this.#usageCount[key] = (this.#usageCount[key] ?? 0) + value;
        }
      }

      for (const key of ['cachedInputTokens', 'cacheCreationInputTokens'] as const) {
        const value = usage[key] === undefined ? undefined : Number(usage[key]);
        if (value !== undefined) {
          this.#usageCount[key] = (this.#usageCount[key] ?? 0) + value;
        }
      }
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
              const output = chunk.payload?.output;
              if (output && 'payload' in output && output.payload) {
                const finishPayload = output.payload;
                if ('usage' in finishPayload && finishPayload.usage) {
                  updateUsageCount(finishPayload.usage);
                }
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

        let workflowStatus: WorkflowRunStatus = 'success';

        for await (const chunk of stream) {
          // update the usage count
          if (chunk.type === 'step-finish' && chunk.payload.usage) {
            updateUsageCount(chunk.payload.usage);
          } else if (chunk.type === 'workflow-canceled') {
            workflowStatus = 'canceled';
          } else if (chunk.type === 'workflow-step-suspended') {
            workflowStatus = 'suspended';
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
              usage: this.#usageCount,
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
