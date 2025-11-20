import type { LLMStepResult } from '@mastra/core/agent';
import type { ChunkType, OutputSchema, NetworkChunkType } from '@mastra/core/stream';

// Helper type for inferring schema output
type InferSchemaOutput<T> = T extends OutputSchema ? any : undefined;

/**
 * Delayed promise class for lazy promise construction
 */
class DelayedPromise<T> {
  private _promise: Promise<T> | undefined;
  private _resolve: undefined | ((value: T) => void) = undefined;
  private _reject: undefined | ((error: unknown) => void) = undefined;

  get promise(): Promise<T> {
    if (!this._promise) {
      this._promise = new Promise<T>((resolve, reject) => {
        this._resolve = resolve;
        this._reject = reject;
      });
    }
    return this._promise;
  }

  resolve(value: T): void {
    if (this._promise) {
      this._resolve?.(value);
    }
  }

  reject(error: unknown): void {
    if (this._promise) {
      this._reject?.(error);
    }
  }
}

/**
 * Consumes a stream to completion
 */
async function consumeStream({
  stream,
  onError,
}: {
  stream: ReadableStream<any>;
  onError?: (error: unknown) => void;
}): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (error) {
    onError?.(error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Converts an SSE Response stream into a typed chunk stream
 */
export function createChunkStreamFromResponse<OUTPUT extends OutputSchema = undefined>(
  response: Response,
): ReadableStream<ChunkType<OUTPUT>> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream<ChunkType<OUTPUT>>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: '

              if (data === '[DONE]') {
                controller.close();
                return;
              }

              try {
                const chunk = JSON.parse(data) as ChunkType<OUTPUT>;
                controller.enqueue(chunk);
              } catch (error) {
                console.error('❌ JSON parse error:', error, 'Data:', data);
                continue;
              }
            }
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Convert a Response with record-separated body into a typed chunk stream
 * Used for workflow streaming which uses \x1E record separator instead of SSE format
 */
export function createWorkflowChunkStreamFromResponse<T = any>(
  response: Response,
  recordSeparator: string = '\x1E',
): ReadableStream<T> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let failedChunk: string | undefined = undefined;

  return new ReadableStream<T>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            break;
          }

          // Decode binary data to text
          const decoded = decoder.decode(value, { stream: true });

          // Split by record separator
          const chunks = decoded.split(recordSeparator);

          // Process each chunk
          for (const chunk of chunks) {
            if (chunk) {
              const newChunk: string = failedChunk ? failedChunk + chunk : chunk;
              try {
                const parsedChunk = JSON.parse(newChunk) as T;
                controller.enqueue(parsedChunk);
                failedChunk = undefined;
              } catch {
                // If JSON parsing fails, save it to combine with next chunk
                failedChunk = newChunk;
              }
            }
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Convert a Response with SSE body into a typed NetworkChunkType stream
 */
export function createNetworkChunkStreamFromResponse(response: Response): ReadableStream<NetworkChunkType> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream<NetworkChunkType>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: '

              if (data === '[DONE]') {
                controller.close();
                return;
              }

              try {
                const chunk = JSON.parse(data) as NetworkChunkType;
                controller.enqueue(chunk);
              } catch (error) {
                console.error('❌ JSON parse error:', error, 'Data:', data);
                continue;
              }
            }
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export class MastraClientModelOutput<OUTPUT extends OutputSchema = undefined> {
  #baseStream: ReadableStream<ChunkType<OUTPUT>>;
  #bufferedChunks: ChunkType<OUTPUT>[] = [];
  #streamFinished = false;
  #error: Error | undefined;

  // Buffers for accumulating data
  #bufferedText: string[] = [];
  #bufferedReasoning: LLMStepResult['reasoning'] = [];
  #bufferedReasoningText: string = '';
  #bufferedSources: LLMStepResult['sources'] = [];
  #bufferedFiles: LLMStepResult['files'] = [];
  #bufferedToolCalls: LLMStepResult['toolCalls'] = [];
  #bufferedToolResults: LLMStepResult['toolResults'] = [];
  #bufferedSteps: LLMStepResult[] = [];
  #bufferedWarnings: LLMStepResult['warnings'] = [];
  #bufferedContent: LLMStepResult['content'] = [];
  #bufferedUsage: LLMStepResult['usage'] = {
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
  };
  #bufferedObject: InferSchemaOutput<OUTPUT> | undefined;
  #currentStepBuffer: Partial<LLMStepResult> = {
    text: '',
    reasoning: [],
    sources: [],
    files: [],
    toolCalls: [],
    toolResults: [],
    content: [],
  };

  constructor({ stream }: { stream: ReadableStream<ChunkType<OUTPUT>> }) {
    const self = this;

    // Create a transform stream that processes chunks and resolves delayed promises
    this.#baseStream = stream.pipeThrough(
      new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
        async transform(chunk, controller) {
          // Buffer the chunk for replay
          self.#bufferedChunks.push(chunk);

          // Process chunk based on type
          try {
            await self.#processChunk(chunk);
          } catch (error) {
            self.#error = error instanceof Error ? error : new Error(String(error));
            self.#delayedPromises.finishReason.reject(self.#error);
          }

          // Pass chunk through
          controller.enqueue(chunk);
        },

        flush() {
          self.#streamFinished = true;
          self.#resolveAllPromises();
        },
      }),
    );
  }

  #delayedPromises = {
    suspendPayload: new DelayedPromise<any>(),
    object: new DelayedPromise<InferSchemaOutput<OUTPUT>>(),
    finishReason: new DelayedPromise<LLMStepResult['finishReason']>(),
    usage: new DelayedPromise<LLMStepResult['usage']>(),
    warnings: new DelayedPromise<LLMStepResult['warnings']>(),
    providerMetadata: new DelayedPromise<LLMStepResult['providerMetadata']>(),
    response: new DelayedPromise<LLMStepResult<OUTPUT>['response']>(),
    request: new DelayedPromise<LLMStepResult['request']>(),
    text: new DelayedPromise<LLMStepResult['text']>(),
    reasoning: new DelayedPromise<LLMStepResult['reasoning']>(),
    reasoningText: new DelayedPromise<string | undefined>(),
    sources: new DelayedPromise<LLMStepResult['sources']>(),
    files: new DelayedPromise<LLMStepResult['files']>(),
    toolCalls: new DelayedPromise<LLMStepResult['toolCalls']>(),
    toolResults: new DelayedPromise<LLMStepResult['toolResults']>(),
    steps: new DelayedPromise<LLMStepResult[]>(),
    totalUsage: new DelayedPromise<LLMStepResult['usage']>(),
    content: new DelayedPromise<LLMStepResult['content']>(),
  };

  #consumptionStarted = false;

  async #processChunk(chunk: ChunkType<OUTPUT>): Promise<void> {
    switch (chunk.type) {
      case 'text-delta':
        this.#bufferedText.push((chunk.payload as any).text);
        break;

      case 'reasoning-delta':
        this.#bufferedReasoningText += (chunk.payload as any).text;
        break;

      case 'tool-call':
        this.#bufferedToolCalls.push(chunk.payload as any);
        break;

      case 'tool-result':
        this.#bufferedToolResults.push(chunk.payload as any);
        break;

      case 'source':
        this.#bufferedSources.push(chunk.payload as any);
        break;

      case 'file':
        this.#bufferedFiles.push(chunk.payload as any);
        break;

      case 'step-finish':
        // Save current step
        this.#bufferedSteps.push({
          ...this.#currentStepBuffer,
          finishReason: (chunk.payload as any).stepResult?.reason,
          usage: (chunk.payload as any).stepResult?.usage || this.#bufferedUsage,
        } as LLMStepResult);

        // Reset step buffer
        this.#currentStepBuffer = {
          text: '',
          reasoning: [],
          sources: [],
          files: [],
          toolCalls: [],
          toolResults: [],
          content: [],
        };
        break;

      case 'finish':
        const finishPayload = chunk.payload as any;
        // Usage can be in payload.usage or payload.stepResult.usage
        if (finishPayload.usage) {
          this.#bufferedUsage = finishPayload.usage;
        } else if (finishPayload.stepResult?.usage) {
          this.#bufferedUsage = finishPayload.stepResult.usage;
        }
        this.#delayedPromises.finishReason.resolve(finishPayload.stepResult?.reason);
        break;

      case 'error':
        const errorPayload = chunk.payload as any;
        const error = new Error(String(errorPayload.error || errorPayload));
        this.#error = error;
        this.#delayedPromises.finishReason.reject(error);
        break;
    }
  }

  #resolveAllPromises(): void {
    // Resolve all accumulated data
    try {
      this.#delayedPromises.text.resolve(this.#bufferedText.join(''));
    } catch {}
    try {
      this.#delayedPromises.reasoning.resolve(this.#bufferedReasoning);
    } catch {}
    try {
      this.#delayedPromises.reasoningText.resolve(
        this.#bufferedReasoningText.length > 0 ? this.#bufferedReasoningText : undefined,
      );
    } catch {}
    try {
      this.#delayedPromises.sources.resolve(this.#bufferedSources);
    } catch {}
    try {
      this.#delayedPromises.files.resolve(this.#bufferedFiles);
    } catch {}
    try {
      this.#delayedPromises.toolCalls.resolve(this.#bufferedToolCalls);
    } catch {}
    try {
      this.#delayedPromises.toolResults.resolve(this.#bufferedToolResults);
    } catch {}
    try {
      this.#delayedPromises.steps.resolve(this.#bufferedSteps);
    } catch {}
    try {
      this.#delayedPromises.warnings.resolve(this.#bufferedWarnings);
    } catch {}
    try {
      this.#delayedPromises.content.resolve(this.#bufferedContent);
    } catch {}
    try {
      this.#delayedPromises.usage.resolve(this.#bufferedUsage);
    } catch {}
    try {
      this.#delayedPromises.totalUsage.resolve(this.#bufferedUsage);
    } catch {}

    if (this.#bufferedObject !== undefined) {
      try {
        this.#delayedPromises.object.resolve(this.#bufferedObject);
      } catch {}
    }

    // Resolve with empty/undefined if not already resolved
    try {
      this.#delayedPromises.finishReason.resolve(undefined);
    } catch {}
  }

  async consumeStream(options?: { onError?: (error: unknown) => void }): Promise<void> {
    if (this.#consumptionStarted) {
      return;
    }

    this.#consumptionStarted = true;

    try {
      await consumeStream({
        stream: this.#baseStream as globalThis.ReadableStream<any>,
        onError: options?.onError,
      });
    } catch (error) {
      this.#error = error instanceof Error ? error : new Error(String(error));
      options?.onError?.(error);
    }
  }

  #getDelayedPromise<T>(promise: DelayedPromise<T>): Promise<T> {
    if (!this.#consumptionStarted) {
      void this.consumeStream();
    }
    return promise.promise;
  }

  /**
   * ReadableStream for consuming stream chunks.
   * ReadableStream is async iterable, so you can use it with for-await-of loops.
   *
   * @example
   * ```typescript
   * const stream = await agent.stream("Hello");
   * for await (const chunk of stream.fullStream) {
   *   if (chunk.type === 'text-delta') {
   *     console.log(chunk.payload.text);
   *   }
   * }
   * ```
   */
  get fullStream(): ReadableStream<ChunkType<OUTPUT>> {
    const self = this;

    return new ReadableStream<ChunkType<OUTPUT>>({
      async start(controller) {
        // Start consumption if not started
        if (!self.#consumptionStarted) {
          self.#consumptionStarted = true;
        }

        // Enqueue all buffered chunks first
        for (const chunk of self.#bufferedChunks) {
          controller.enqueue(chunk);
        }

        // If stream is finished, we're done
        if (self.#streamFinished) {
          controller.close();
          return;
        }

        // Otherwise, consume the rest of the stream
        const reader = self.#baseStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });
  }

  /**
   * Resolves to the complete text response after streaming completes.
   */
  get text() {
    return this.#getDelayedPromise(this.#delayedPromises.text);
  }

  /**
   * Resolves to reasoning parts array for models that support reasoning.
   */
  get reasoning(): Promise<LLMStepResult['reasoning']> {
    return this.#getDelayedPromise(this.#delayedPromises.reasoning);
  }

  /**
   * Resolves to complete reasoning text for models that support reasoning.
   */
  get reasoningText(): Promise<string | undefined> {
    return this.#getDelayedPromise(this.#delayedPromises.reasoningText);
  }

  get sources(): Promise<LLMStepResult['sources']> {
    return this.#getDelayedPromise(this.#delayedPromises.sources);
  }

  get files(): Promise<LLMStepResult['files']> {
    return this.#getDelayedPromise(this.#delayedPromises.files);
  }

  get steps(): Promise<LLMStepResult[]> {
    return this.#getDelayedPromise(this.#delayedPromises.steps);
  }

  get suspendPayload(): Promise<any> {
    return this.#getDelayedPromise(this.#delayedPromises.suspendPayload);
  }

  /**
   * Resolves to the reason generation finished.
   */
  get finishReason(): Promise<LLMStepResult['finishReason']> {
    return this.#getDelayedPromise(this.#delayedPromises.finishReason);
  }

  /**
   * Resolves to array of all tool calls made during execution.
   */
  get toolCalls(): Promise<LLMStepResult['toolCalls']> {
    return this.#getDelayedPromise(this.#delayedPromises.toolCalls);
  }

  /**
   * Resolves to array of all tool execution results.
   */
  get toolResults(): Promise<LLMStepResult['toolResults']> {
    return this.#getDelayedPromise(this.#delayedPromises.toolResults);
  }

  /**
   * Resolves to token usage statistics including inputTokens, outputTokens, and totalTokens.
   */
  get usage(): Promise<LLMStepResult['usage']> {
    return this.#getDelayedPromise(this.#delayedPromises.usage);
  }

  /**
   * Resolves to array of all warnings generated during execution.
   */
  get warnings(): Promise<LLMStepResult['warnings']> {
    return this.#getDelayedPromise(this.#delayedPromises.warnings);
  }

  /**
   * Resolves to provider metadata generated during execution.
   */
  get providerMetadata(): Promise<LLMStepResult['providerMetadata']> {
    return this.#getDelayedPromise(this.#delayedPromises.providerMetadata);
  }

  /**
   * Resolves to the complete response from the model.
   */
  get response(): Promise<LLMStepResult<OUTPUT>['response']> {
    return this.#getDelayedPromise(this.#delayedPromises.response);
  }

  /**
   * Resolves to the complete request sent to the model.
   */
  get request(): Promise<LLMStepResult['request']> {
    return this.#getDelayedPromise(this.#delayedPromises.request);
  }

  /**
   * Resolves to the complete content from the model.
   */
  get content(): Promise<LLMStepResult['content']> {
    return this.#getDelayedPromise(this.#delayedPromises.content);
  }

  /**
   * Resolves to an error if an error occurred during streaming.
   */
  get error(): Error | undefined {
    return this.#error;
  }

  /**
   * @deprecated Use fullStream or await properties like text, toolCalls, etc. instead
   */
  async processDataStream(options: { onChunk: (chunk: ChunkType<OUTPUT>) => Promise<void> }): Promise<void> {
    for await (const chunk of this.fullStream) {
      await options.onChunk(chunk);
    }
  }
}

/**
 * MastraClientNetworkOutput - Client-side wrapper for network streaming
 */
export class MastraClientNetworkOutput extends ReadableStream<NetworkChunkType> {
  #error: Error | undefined;
  #consumptionStarted = false;

  // Buffered data from finish event
  #bufferedUsage: any = undefined;
  #bufferedResult: any = undefined;
  #bufferedStatus: string | undefined = undefined;

  // Delayed promises for properties
  #delayedPromises = {
    usage: new DelayedPromise<any>(),
    result: new DelayedPromise<any>(),
    status: new DelayedPromise<string>(),
  };

  constructor({ stream }: { stream: ReadableStream<NetworkChunkType> }) {
    // Capture state in closures for use in the start callback
    const state = {
      error: undefined as Error | undefined,
      consumptionStarted: false,
      bufferedUsage: undefined as any,
      bufferedResult: undefined as any,
      bufferedStatus: undefined as string | undefined,
      delayedPromises: {
        usage: new DelayedPromise<any>(),
        result: new DelayedPromise<any>(),
        status: new DelayedPromise<string>(),
      },
    };

    // Create the ReadableStream that this class extends
    super({
      async start(controller) {
        // Mark consumption as started
        if (!state.consumptionStarted) {
          state.consumptionStarted = true;
        }

        // Process the incoming stream
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Resolve promises if not already resolved
              try {
                if (state.bufferedUsage) {
                  state.delayedPromises.usage.resolve(state.bufferedUsage);
                } else {
                  state.delayedPromises.usage.resolve(undefined);
                }
              } catch (error) {
                console.error('Error resolving usage promise:', error);
              }
              if (state.bufferedResult === undefined) {
                try {
                  state.delayedPromises.result.resolve(undefined);
                } catch (error) {
                  console.error('Error resolving result promise:', error);
                }
              }
              if (state.bufferedStatus === undefined) {
                try {
                  state.delayedPromises.status.resolve('unknown');
                } catch (error) {
                  console.error('Error resolving status promise:', error);
                }
              }
              controller.close();
              break;
            }

            // Process chunk to extract metadata
            if (value.type === 'network-execution-event-finish') {
              const payload = value.payload as any;
              state.bufferedResult = payload;
              state.bufferedStatus = payload?.completionReason ?? 'complete';
              state.bufferedUsage = payload?.usage;

              state.delayedPromises.result.resolve(state.bufferedResult);
              state.delayedPromises.status.resolve(state.bufferedStatus!);

              if (state.bufferedUsage) {
                state.delayedPromises.usage.resolve(state.bufferedUsage);
              }
            }

            // Enqueue the chunk
            controller.enqueue(value);
          }
        } catch (error) {
          state.error = error instanceof Error ? error : new Error(String(error));
          state.delayedPromises.status.reject(state.error);
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });

    // Copy state to instance after super() is called
    this.#error = state.error;
    this.#consumptionStarted = state.consumptionStarted;
    this.#bufferedUsage = state.bufferedUsage;
    this.#bufferedResult = state.bufferedResult;
    this.#bufferedStatus = state.bufferedStatus;
    this.#delayedPromises = state.delayedPromises;
  }

  /**
   * The stream itself - since this class extends ReadableStream, you can iterate over it directly
   * This getter is provided for backward compatibility and clarity
   */
  get fullStream(): ReadableStream<NetworkChunkType> {
    return this;
  }

  /**
   * Promise that resolves to the usage count from the server's finish event
   */
  get usage(): Promise<any> {
    this.#ensureConsumption();
    return this.#delayedPromises.usage.promise;
  }

  /**
   * Promise that resolves to the network execution result
   */
  get result(): Promise<any> {
    this.#ensureConsumption();
    return this.#delayedPromises.result.promise;
  }

  /**
   * Promise that resolves to the network execution status
   */
  get status(): Promise<string> {
    this.#ensureConsumption();
    return this.#delayedPromises.status.promise;
  }

  /**
   * Returns the error if one occurred during streaming
   */
  get error(): Error | undefined {
    return this.#error;
  }

  /**
   * Ensure stream consumption is triggered
   * Since this class IS a ReadableStream, we trigger consumption by getting a reader
   */
  #ensureConsumption(): void {
    if (!this.#consumptionStarted) {
      this.#consumptionStarted = true;
      // Start consuming the stream (this class itself) in the background
      void consumeStream({
        stream: this,
        onError: error => {
          this.#error = error instanceof Error ? error : new Error(String(error));
          this.#delayedPromises.status.reject(this.#error);
          this.#delayedPromises.result.reject(this.#error);
          this.#delayedPromises.usage.reject(this.#error);
        },
      });
    }
  }

  /**
   * @deprecated Use fullStream or await properties like status, result, usage instead
   */
  async processDataStream(options: { onChunk: (chunk: NetworkChunkType) => Promise<void> }): Promise<void> {
    for await (const chunk of this.fullStream) {
      await options.onChunk(chunk);
    }
  }
}

/**
 * MastraClientWorkflowOutput - Client-side wrapper for workflow streaming
 */
export class MastraClientWorkflowOutput extends ReadableStream<ChunkType> {
  #baseStream: ReadableStream<ChunkType>;
  #bufferedChunks: ChunkType[] = [];
  #streamFinished = false;
  #error: Error | undefined;
  #consumptionStarted = false;

  // Buffered data from finish event
  #bufferedUsage: any = undefined;
  #bufferedResult: any = undefined;
  #bufferedStatus: string | undefined = undefined;

  // Delayed promises for properties
  #delayedPromises = {
    usage: new DelayedPromise<any>(),
    result: new DelayedPromise<any>(),
    status: new DelayedPromise<string>(),
  };

  constructor({ stream }: { stream: ReadableStream<ChunkType> }) {
    // Capture state in closures for use in the start callback
    const state = {
      bufferedChunks: [] as ChunkType[],
      streamFinished: false,
      error: undefined as Error | undefined,
      consumptionStarted: false,
      bufferedUsage: undefined as any,
      bufferedResult: undefined as any,
      bufferedStatus: undefined as string | undefined,
      delayedPromises: {
        usage: new DelayedPromise<any>(),
        result: new DelayedPromise<any>(),
        status: new DelayedPromise<string>(),
      },
    };

    // Create the ReadableStream that this class extends
    super({
      async start(controller) {
        // Mark consumption as started
        if (!state.consumptionStarted) {
          state.consumptionStarted = true;
        }

        // Process the incoming stream and buffer chunks
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              state.streamFinished = true;
              // Resolve promises
              try {
                if (state.bufferedUsage) {
                  state.delayedPromises.usage.resolve(state.bufferedUsage);
                } else {
                  state.delayedPromises.usage.resolve(undefined);
                }
              } catch (error) {
                console.error('Error resolving usage promise:', error);
              }
              if (state.bufferedResult === undefined) {
                try {
                  state.delayedPromises.result.resolve(undefined);
                } catch (error) {
                  console.error('Error resolving result promise:', error);
                }
              }
              if (state.bufferedStatus === undefined) {
                try {
                  state.delayedPromises.status.resolve('unknown');
                } catch (error) {
                  console.error('Error resolving status promise:', error);
                }
              }
              controller.close();
              break;
            }

            // Buffer the chunk
            state.bufferedChunks.push(value);

            // Process chunk to extract metadata
            if (value.type === 'workflow-finish') {
              const payload = value.payload as any;
              state.bufferedStatus = payload?.workflowStatus ?? 'unknown';
              state.bufferedUsage = payload?.output?.usage;
              state.bufferedResult = payload;

              state.delayedPromises.status.resolve(state.bufferedStatus!);
              state.delayedPromises.result.resolve(state.bufferedResult);
              if (state.bufferedUsage) {
                state.delayedPromises.usage.resolve(state.bufferedUsage);
              }
            }

            // Enqueue the chunk
            controller.enqueue(value);
          }
        } catch (error) {
          state.error = error instanceof Error ? error : new Error(String(error));
          state.delayedPromises.status.reject(state.error);
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });

    // Copy state to instance after super() is called
    this.#baseStream = stream;
    this.#bufferedChunks = state.bufferedChunks;
    this.#streamFinished = state.streamFinished;
    this.#error = state.error;
    this.#consumptionStarted = state.consumptionStarted;
    this.#bufferedUsage = state.bufferedUsage;
    this.#bufferedResult = state.bufferedResult;
    this.#bufferedStatus = state.bufferedStatus;
    this.#delayedPromises = state.delayedPromises;
  }

  /**
   * Creates a MastraClientWorkflowOutput from a Response with record-separated body
   * This abstracts the createWorkflowChunkStreamFromResponse logic
   */
  static fromResponse(response: Response, recordSeparator: string = '\x1E'): MastraClientWorkflowOutput {
    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let failedChunk: string | undefined = undefined;

    const chunkStream = new ReadableStream<ChunkType>({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Decode binary data to text
            const decoded = decoder.decode(value, { stream: true });

            // Split by record separator
            const chunks = decoded.split(recordSeparator);

            // Process each chunk
            for (const chunk of chunks) {
              if (chunk) {
                const newChunk: string = failedChunk ? failedChunk + chunk : chunk;
                try {
                  const parsedChunk = JSON.parse(newChunk) as ChunkType;
                  controller.enqueue(parsedChunk);
                  failedChunk = undefined;
                } catch {
                  // If JSON parsing fails, save it to combine with next chunk
                  failedChunk = newChunk;
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new MastraClientWorkflowOutput({ stream: chunkStream });
  }

  /**
   * The stream itself - since this class extends ReadableStream, you can iterate over it directly
   * This getter is provided for backward compatibility and clarity
   */
  get fullStream(): ReadableStream<ChunkType> {
    return this;
  }

  /**
   * Promise that resolves to the usage count from the workflow-finish event
   */
  get usage(): Promise<any> {
    this.#ensureConsumption();
    return this.#delayedPromises.usage.promise;
  }

  /**
   * Promise that resolves to the workflow execution result
   */
  get result(): Promise<any> {
    this.#ensureConsumption();
    return this.#delayedPromises.result.promise;
  }

  /**
   * Promise that resolves to the workflow execution status
   */
  get status(): Promise<string> {
    this.#ensureConsumption();
    return this.#delayedPromises.status.promise;
  }

  /**
   * Returns the error if one occurred during streaming
   */
  get error(): Error | undefined {
    return this.#error;
  }

  /**
   * Ensure stream consumption is triggered
   * Since this class IS a ReadableStream, we trigger consumption by getting a reader
   */
  #ensureConsumption(): void {
    if (!this.#consumptionStarted) {
      this.#consumptionStarted = true;
      // Start consuming the stream (this class itself) in the background
      void consumeStream({
        stream: this,
        onError: error => {
          this.#error = error instanceof Error ? error : new Error(String(error));
          this.#delayedPromises.status.reject(this.#error);
          this.#delayedPromises.result.reject(this.#error);
          this.#delayedPromises.usage.reject(this.#error);
        },
      });
    }
  }
}
