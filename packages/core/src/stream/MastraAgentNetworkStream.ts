import { ReadableStream } from 'node:stream/web';
import type { DefaultEngineType, Run, Step } from '../workflows';
import type { InferSchemaOutput, OutputSchema, PartialSchemaOutput } from './base/schema';
import type { ChunkType } from './types';

export class MastraAgentNetworkStream<OUTPUT extends OutputSchema = undefined> extends ReadableStream<ChunkType> {
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
  #objectPromise: {
    promise: Promise<InferSchemaOutput<OUTPUT> | undefined>;
    resolve: (value: InferSchemaOutput<OUTPUT> | undefined) => void;
    reject: (reason?: any) => void;
  };
  #objectStreamController: ReadableStreamDefaultController<PartialSchemaOutput<OUTPUT>> | null = null;
  #objectStream: ReadableStream<PartialSchemaOutput<OUTPUT>> | null = null;
  #run: Run;
  runId: string;

  constructor({
    createStream,
    run,
  }: {
    createStream: (writer: WritableStream<ChunkType>) => Promise<ReadableStream<any>> | ReadableStream<any>;
    run: Run<DefaultEngineType, Step<string, any, any, any, any, any, DefaultEngineType>[], any, any, any>;
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

    // Object promise for structured output
    const objectDeferredPromise = {
      promise: null,
      resolve: null,
      reject: null,
    } as unknown as {
      promise: Promise<InferSchemaOutput<OUTPUT> | undefined>;
      resolve: (value: InferSchemaOutput<OUTPUT> | undefined) => void;
      reject: (reason?: any) => void;
    };
    objectDeferredPromise.promise = new Promise((resolve, reject) => {
      objectDeferredPromise.resolve = resolve;
      objectDeferredPromise.reject = reject;
    });

    // Object stream controller reference
    let objectStreamController: ReadableStreamDefaultController<PartialSchemaOutput<OUTPUT>> | null = null;

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

    super({
      start: async controller => {
        try {
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

          let objectResolved = false;

          for await (const chunk of stream) {
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

              // Handle network-object chunks (partial objects during streaming)
              if (innerChunk.type === 'network-object') {
                if (objectStreamController) {
                  objectStreamController.enqueue((innerChunk as any).payload?.object);
                }
                controller.enqueue(innerChunk);
              }
              // Handle network-object-result chunks (final structured object)
              else if (innerChunk.type === 'network-object-result') {
                if (!objectResolved) {
                  objectResolved = true;
                  objectDeferredPromise.resolve((innerChunk as any).payload?.object);
                  if (objectStreamController) {
                    objectStreamController.close();
                  }
                }
                controller.enqueue(innerChunk);
              } else if (innerChunk.type === 'network-execution-event-finish') {
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

          // If no object was resolved, resolve with undefined
          if (!objectResolved) {
            objectDeferredPromise.resolve(undefined);
            if (objectStreamController) {
              objectStreamController.close();
            }
          }

          controller.close();
          deferredPromise.resolve();
        } catch (error) {
          controller.error(error);
          deferredPromise.reject(error);
          objectDeferredPromise.reject(error);
          if (objectStreamController) {
            objectStreamController.error(error);
          }
        }
      },
    });

    this.#run = run;
    this.#streamPromise = deferredPromise;

    this.runId = run.runId;
    this.#objectPromise = objectDeferredPromise;

    // Create object stream
    this.#objectStream = new ReadableStream<PartialSchemaOutput<OUTPUT>>({
      start: ctrl => {
        objectStreamController = ctrl;
        this.#objectStreamController = ctrl;
      },
    });
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
   * Returns a promise that resolves to the structured output object.
   * Only available when structuredOutput option is provided to network().
   * Resolves to undefined if no structuredOutput was requested.
   */
  get object(): Promise<InferSchemaOutput<OUTPUT> | undefined> {
    return this.#objectPromise.promise;
  }

  /**
   * Returns a ReadableStream of partial objects during structured output generation.
   * Useful for streaming partial results as they're being generated.
   */
  get objectStream(): ReadableStream<PartialSchemaOutput<OUTPUT>> {
    return this.#objectStream!;
  }
}
