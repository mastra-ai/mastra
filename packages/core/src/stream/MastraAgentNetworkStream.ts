import { ReadableStream } from 'node:stream/web';
import type { Run } from '../workflows';
import type { ChunkType, NetworkAbortPayload } from './types';
import { ChunkFrom } from './types';

export class MastraAgentNetworkStream extends ReadableStream<ChunkType> {
  #usageCount = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  };
  #streamPromise: {
    promise: Promise<void>;
    resolve: (value: void) => void;
    reject: (reason?: any) => void;
  };
  #run: Run;
  #aborted = false;

  constructor({
    createStream,
    run,
    abortSignal,
    onAbort,
  }: {
    createStream: (writer: WritableStream<ChunkType>) => Promise<ReadableStream<any>> | ReadableStream<any>;
    run: Run;
    /** Signal to abort the network execution */
    abortSignal?: AbortSignal;
    /** Callback fired when network execution is aborted */
    onAbort?: (event: any) => Promise<void> | void;
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
      reasoningTokens?: `${number}` | number;
      cachedInputTokens?: `${number}` | number;
    }) => {
      this.#usageCount.inputTokens += parseInt(usage?.inputTokens?.toString() ?? '0', 10);
      this.#usageCount.outputTokens += parseInt(usage?.outputTokens?.toString() ?? '0', 10);
      this.#usageCount.totalTokens += parseInt(usage?.totalTokens?.toString() ?? '0', 10);
      this.#usageCount.reasoningTokens += parseInt(usage?.reasoningTokens?.toString() ?? '0', 10);
      this.#usageCount.cachedInputTokens += parseInt(usage?.cachedInputTokens?.toString() ?? '0', 10);
    };

    // Track abort state for this instance
    let aborted = false;

    super({
      start: async controller => {
        // Wire abort signal to cancel the workflow run
        if (abortSignal) {
          const handleAbort = async () => {
            if (aborted) return;
            aborted = true;
            this.#aborted = true;

            // Emit abort event before cancelling
            const abortPayload: NetworkAbortPayload = {
              reason: abortSignal.reason || 'Aborted',
              runId: run.runId,
              usage: this.#usageCount,
            };
            controller.enqueue({
              type: 'network-execution-event-abort',
              payload: abortPayload,
              from: ChunkFrom.NETWORK,
              runId: run.runId,
            });

            // Cancel the workflow run
            await run.cancel();

            // Call the onAbort callback if provided
            await onAbort?.({ reason: abortSignal.reason });
          };

          abortSignal.addEventListener('abort', handleAbort);

          // If already aborted, handle immediately
          if (abortSignal.aborted) {
            await handleAbort();
          }
        }

        try {
          const writer = new WritableStream<ChunkType>({
            write: chunk => {
              // Don't write chunks after abort
              if (aborted) return;

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
                  } else if ('output' in finishPayload && finishPayload.output) {
                    const outputPayload = finishPayload.output;
                    if ('usage' in outputPayload && outputPayload.usage) {
                      updateUsageCount(outputPayload.usage);
                    }
                  }
                }
              }

              controller.enqueue(chunk);
            },
          });

          const stream: ReadableStream<ChunkType> = await createStream(writer);

          const getInnerChunk = (chunk: ChunkType) => {
            if (chunk.type === 'workflow-step-output') {
              return getInnerChunk(chunk.payload.output as any);
            }
            return chunk;
          };

          for await (const chunk of stream) {
            // Stop processing if aborted
            if (aborted) break;

            if (chunk.type === 'workflow-step-output') {
              const innerChunk = getInnerChunk(chunk);
              if (
                innerChunk.type === 'routing-agent-end' ||
                innerChunk.type === 'agent-execution-end' ||
                innerChunk.type === 'workflow-execution-end'
              ) {
                if (innerChunk.payload?.usage) {
                  updateUsageCount(innerChunk.payload.usage);
                }
              }
              if (innerChunk.type === 'network-execution-event-finish') {
                const finishPayload = {
                  ...innerChunk.payload,
                  usage: this.#usageCount,
                };
                controller.enqueue({ ...innerChunk, payload: finishPayload });
              } else {
                controller.enqueue(innerChunk);
              }
            }
          }

          controller.close();
          deferredPromise.resolve();
        } catch (error) {
          // Don't report error if we were aborted
          if (aborted) {
            controller.close();
            deferredPromise.resolve();
          } else {
            controller.error(error);
            deferredPromise.reject(error);
          }
        }
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

  /**
   * Whether the network execution was aborted
   */
  get aborted() {
    return this.#aborted;
  }

  /**
   * Cancel the network execution.
   * This will abort all running sub-agents, workflows, and tools.
   */
  cancelNetwork() {
    this.#run.cancel();
  }
}
