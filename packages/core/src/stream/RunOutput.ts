import EventEmitter from 'events';
import { ReadableStream } from 'stream/web';
import type { LanguageModelUsage } from 'ai-v5';
import type { WorkflowResult, WorkflowRunStatus } from '../workflows';
import { DelayedPromise } from './aisdk/v5/compat';
import type { MastraBaseStream } from './base/base';
import { consumeStream } from './base/consume-stream';
import { ChunkFrom } from './types';
import type { WorkflowStreamEvent } from './types';

export class WorkflowRunOutput<TResult extends WorkflowResult<any, any, any, any> = WorkflowResult<any, any, any, any>>
  implements MastraBaseStream<WorkflowStreamEvent>
{
  #status: WorkflowRunStatus = 'running';
  #usageCount: Required<LanguageModelUsage> = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  };
  #consumptionStarted = false;
  #baseStream: ReadableStream<WorkflowStreamEvent>;
  #emitter = new EventEmitter();
  #bufferedChunks: WorkflowStreamEvent[] = [];

  #streamFinished = false;

  #delayedPromises = {
    usage: new DelayedPromise<LanguageModelUsage>(),
    result: new DelayedPromise<TResult>(),
  };

  /**
   * Unique identifier for this workflow run
   */
  public runId: string;
  /**
   * Unique identifier for this workflow
   */
  public workflowId: string;

  constructor({
    runId,
    workflowId,
    stream,
  }: {
    runId: string;
    workflowId: string;
    stream: ReadableStream<WorkflowStreamEvent>;
  }) {
    const self = this;
    this.runId = runId;
    this.workflowId = workflowId;

    this.#baseStream = stream;
    stream
      .pipeTo(
        new WritableStream({
          start() {
            const chunk: WorkflowStreamEvent = {
              type: 'workflow-start',
              runId: self.runId,
              from: ChunkFrom.WORKFLOW,
              payload: {
                workflowId: self.workflowId,
              },
            } as WorkflowStreamEvent;

            self.#bufferedChunks.push(chunk);
            self.#emitter.emit('chunk', chunk);
          },
          write(chunk) {
            if (chunk.type !== 'workflow-step-finish') {
              self.#bufferedChunks.push(chunk);
              self.#emitter.emit('chunk', chunk);
            }

            // @ts-ignore yoo
            if (chunk.type === 'workflow-step-finish' && chunk.payload.usage) {
              // @ts-ignore yoo
              self.#updateUsageCount(chunk.payload.usage);
            } else if (chunk.type === 'workflow-canceled') {
              self.#status = 'canceled';
            } else if (chunk.type === 'workflow-step-suspended') {
              self.#status = 'suspended';
            } else if (chunk.type === 'workflow-step-result' && chunk.payload.status === 'failed') {
              self.#status = 'failed';
            }
          },
          close() {
            if (self.#status === 'running') {
              self.#status = 'success';
            }

            self.#emitter.emit('chunk', {
              type: 'workflow-finish',
              runId: self.runId,
              from: ChunkFrom.WORKFLOW,
              payload: {
                workflowStatus: self.#status,
                metadata: {},
                output: {
                  // @ts-ignore
                  usage: self.#usageCount,
                },
              },
            });

            self.#delayedPromises.usage.resolve(self.#usageCount);

            Object.entries(self.#delayedPromises).forEach(([key, promise]) => {
              if (promise.status.type === 'pending') {
                promise.reject(new Error(`promise '${key}' was not resolved or rejected when stream finished`));
              }
            });

            self.#streamFinished = true;
            self.#emitter.emit('finish');
          },
        }),
      )
      .catch(reason => {
        // eslint-disable-next-line no-console
        console.log(' something went wrong', reason);
      });
  }

  #getDelayedPromise<T>(promise: DelayedPromise<T>): Promise<T> {
    if (!this.#consumptionStarted) {
      void this.consumeStream();
    }
    return promise.promise;
  }

  #updateUsageCount(
    usage:
      | {
          inputTokens?: `${number}` | number;
          outputTokens?: `${number}` | number;
          totalTokens?: `${number}` | number;
          reasoningTokens?: `${number}` | number;
          cachedInputTokens?: `${number}` | number;
        }
      | {
          promptTokens?: `${number}` | number;
          completionTokens?: `${number}` | number;
          totalTokens?: `${number}` | number;
          reasoningTokens?: `${number}` | number;
          cachedInputTokens?: `${number}` | number;
        },
  ) {
    let totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    };
    if ('inputTokens' in usage) {
      totalUsage.inputTokens += parseInt(usage?.inputTokens?.toString() ?? '0', 10);
      totalUsage.outputTokens += parseInt(usage?.outputTokens?.toString() ?? '0', 10);
      // we need to handle both formats because you can use a V1 model inside a stream workflow
    } else if ('promptTokens' in usage) {
      totalUsage.inputTokens += parseInt(usage?.promptTokens?.toString() ?? '0', 10);
      totalUsage.outputTokens += parseInt(usage?.completionTokens?.toString() ?? '0', 10);
    }
    totalUsage.totalTokens += parseInt(usage?.totalTokens?.toString() ?? '0', 10);

    totalUsage.reasoningTokens += parseInt(usage?.reasoningTokens?.toString() ?? '0', 10);
    totalUsage.cachedInputTokens += parseInt(usage?.cachedInputTokens?.toString() ?? '0', 10);
    this.#usageCount = totalUsage;
  }

  /**
   * @internal
   */
  updateResults(results: TResult) {
    this.#delayedPromises.result.resolve(results);
  }

  /**
   * @internal
   */
  rejectResults(error: Error) {
    this.#delayedPromises.result.reject(error);
  }

  /**
   * @internal
   */
  resume(stream: ReadableStream<WorkflowStreamEvent>) {
    this.#baseStream = stream;
    this.#streamFinished = false;
    this.#consumptionStarted = false;
    this.#status = 'running';
    this.#delayedPromises = {
      usage: new DelayedPromise<LanguageModelUsage>(),
      result: new DelayedPromise<TResult>(),
    };

    const self = this;
    stream
      .pipeTo(
        new WritableStream({
          start() {
            const chunk: WorkflowStreamEvent = {
              type: 'workflow-start',
              runId: self.runId,
              from: ChunkFrom.WORKFLOW,
              payload: {
                workflowId: self.workflowId,
              },
            } as WorkflowStreamEvent;

            self.#bufferedChunks.push(chunk);
            self.#emitter.emit('chunk', chunk);
          },
          write(chunk) {
            if (chunk.type !== 'workflow-step-finish') {
              self.#bufferedChunks.push(chunk);
              self.#emitter.emit('chunk', chunk);
            }

            // @ts-ignore yoo
            if (chunk.type === 'workflow-step-finish' && chunk.payload.usage) {
              // @ts-ignore yoo
              self.#updateUsageCount(chunk.payload.usage);
            } else if (chunk.type === 'workflow-canceled') {
              self.#status = 'canceled';
            } else if (chunk.type === 'workflow-step-suspended') {
              self.#status = 'suspended';
            } else if (chunk.type === 'workflow-step-result' && chunk.payload.status === 'failed') {
              self.#status = 'failed';
            }
          },
          close() {
            if (self.#status === 'running') {
              self.#status = 'success';
            }

            self.#emitter.emit('chunk', {
              type: 'workflow-finish',
              runId: self.runId,
              from: ChunkFrom.WORKFLOW,
              payload: {
                workflowStatus: self.#status,
                metadata: {},
                output: {
                  // @ts-ignore
                  usage: self.#usageCount,
                },
              },
            });

            self.#streamFinished = true;
            self.#emitter.emit('finish');
          },
        }),
      )
      .catch(reason => {
        // eslint-disable-next-line no-console
        console.log(' something went wrong', reason);
      });
  }

  async consumeStream(options?: Parameters<typeof consumeStream>[0]): Promise<void> {
    if (this.#consumptionStarted) {
      return;
    }

    this.#consumptionStarted = true;

    try {
      await consumeStream({
        stream: this.#baseStream as globalThis.ReadableStream,
        onError: options?.onError,
      });
    } catch (error) {
      options?.onError?.(error);
    }
  }

  get fullStream(): ReadableStream<WorkflowStreamEvent> {
    const self = this;
    return new ReadableStream<WorkflowStreamEvent>({
      start(controller) {
        // Replay existing buffered chunks
        self.#bufferedChunks.forEach(chunk => {
          controller.enqueue(chunk);
        });

        // If stream already finished, close immediately
        if (self.#streamFinished) {
          controller.close();
          return;
        }

        // Listen for new chunks and stream finish
        const chunkHandler = (chunk: WorkflowStreamEvent) => {
          controller.enqueue(chunk);
        };

        const finishHandler = () => {
          self.#emitter.off('chunk', chunkHandler);
          self.#emitter.off('finish', finishHandler);
          controller.close();
        };

        self.#emitter.on('chunk', chunkHandler);
        self.#emitter.on('finish', finishHandler);
      },

      pull(_controller) {
        // Only start consumption when someone is actively reading the stream
        if (!self.#consumptionStarted) {
          void self.consumeStream();
        }
      },

      cancel() {
        // Stream was cancelled, clean up
        self.#emitter.removeAllListeners();
      },
    });
  }

  get status() {
    return this.#status;
  }

  get result() {
    return this.#getDelayedPromise(this.#delayedPromises.result);
  }

  get usage() {
    return this.#getDelayedPromise(this.#delayedPromises.usage);
  }

  /**
   * @deprecated Use `fullStream.locked` instead
   */
  get locked(): boolean {
    console.warn('WorkflowRunOutput.locked is deprecated. Use fullStream.locked instead.');
    return this.fullStream.locked;
  }

  /**
   * @deprecated Use `fullStream.cancel()` instead
   */
  cancel(reason?: any): Promise<void> {
    console.warn('WorkflowRunOutput.cancel() is deprecated. Use fullStream.cancel() instead.');
    return this.fullStream.cancel(reason);
  }

  /**
   * @deprecated Use `fullStream.getReader()` instead
   */
  getReader(
    options?: ReadableStreamGetReaderOptions,
  ): ReadableStreamDefaultReader<WorkflowStreamEvent> | ReadableStreamBYOBReader {
    console.warn('WorkflowRunOutput.getReader() is deprecated. Use fullStream.getReader() instead.');
    return this.fullStream.getReader(options as any) as any;
  }

  /**
   * @deprecated Use `fullStream.pipeThrough()` instead
   */
  pipeThrough<T>(
    transform: ReadableWritablePair<T, WorkflowStreamEvent>,
    options?: StreamPipeOptions,
  ): ReadableStream<T> {
    console.warn('WorkflowRunOutput.pipeThrough() is deprecated. Use fullStream.pipeThrough() instead.');
    return this.fullStream.pipeThrough(transform as any, options) as ReadableStream<T>;
  }

  /**
   * @deprecated Use `fullStream.pipeTo()` instead
   */
  pipeTo(destination: WritableStream<WorkflowStreamEvent>, options?: StreamPipeOptions): Promise<void> {
    console.warn('WorkflowRunOutput.pipeTo() is deprecated. Use fullStream.pipeTo() instead.');
    return this.fullStream.pipeTo(destination, options);
  }

  /**
   * @deprecated Use `fullStream.tee()` instead
   */
  tee(): [ReadableStream<WorkflowStreamEvent>, ReadableStream<WorkflowStreamEvent>] {
    console.warn('WorkflowRunOutput.tee() is deprecated. Use fullStream.tee() instead.');
    return this.fullStream.tee();
  }

  /**
   * @deprecated Use `fullStream[Symbol.asyncIterator]()` instead
   */
  [Symbol.asyncIterator](): AsyncIterableIterator<WorkflowStreamEvent> {
    console.warn(
      'WorkflowRunOutput[Symbol.asyncIterator]() is deprecated. Use fullStream[Symbol.asyncIterator]() instead.',
    );
    return this.fullStream[Symbol.asyncIterator]();
  }

  /**
   * Helper method to treat this object as a ReadableStream
   * @deprecated Use `fullStream` directly instead
   */
  toReadableStream(): ReadableStream<WorkflowStreamEvent> {
    console.warn('WorkflowRunOutput.toReadableStream() is deprecated. Use fullStream directly instead.');
    return this.fullStream;
  }
}
