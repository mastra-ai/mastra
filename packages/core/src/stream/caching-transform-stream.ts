import type { MastraServerCache } from '../cache/base';

/**
 * Options for creating a CachingTransformStream
 */
export interface CachingTransformStreamOptions<T> {
  /**
   * Cache instance for storing stream chunks
   */
  cache: MastraServerCache;

  /**
   * Unique key for this stream's cache entries
   */
  cacheKey: string;

  /**
   * Optional serializer for chunks before caching.
   * Defaults to identity (chunks stored as-is).
   */
  serialize?: (chunk: T) => unknown;

  /**
   * Optional deserializer for chunks from cache.
   * Defaults to identity (chunks returned as-is).
   */
  deserialize?: (cached: unknown) => T;
}

/**
 * Creates a TransformStream that caches all chunks passing through it.
 *
 * Use this for workflow streaming where you need resumable streams
 * without changing to a PubSub-based architecture.
 *
 * @example
 * ```typescript
 * const cache = mastra.getServerCache();
 * const { transform, getHistory } = createCachingTransformStream({
 *   cache,
 *   cacheKey: runId,
 * });
 *
 * // Use the transform stream
 * const cachedStream = sourceStream.pipeThrough(transform);
 *
 * // Later, get cached history for replay
 * const history = await getHistory();
 * ```
 */
export function createCachingTransformStream<T>(options: CachingTransformStreamOptions<T>): {
  /**
   * TransformStream that caches chunks as they pass through
   */
  transform: TransformStream<T, T>;

  /**
   * Get all cached chunks for this stream
   */
  getHistory: (offset?: number) => Promise<T[]>;

  /**
   * Clear cached chunks for this stream
   */
  clearCache: () => Promise<void>;
} {
  const { cache, cacheKey, serialize = (x: T) => x, deserialize = (x: unknown) => x as T } = options;

  const transform = new TransformStream<T, T>({
    transform(chunk, controller) {
      // Cache the chunk (non-blocking)
      const serialized = serialize(chunk);
      cache.listPush(cacheKey, serialized).catch(() => {
        // Silently ignore cache errors - streaming should continue
      });

      // Pass through the chunk
      controller.enqueue(chunk);
    },
  });

  const getHistory = async (offset = 0): Promise<T[]> => {
    const cached = await cache.listFromTo(cacheKey, offset);
    return cached.map(item => deserialize(item));
  };

  const clearCache = async (): Promise<void> => {
    await cache.delete(cacheKey);
  };

  return { transform, getHistory, clearCache };
}

/**
 * Creates a ReadableStream that first emits cached history, then pipes from a live source.
 *
 * Use this when a client reconnects and needs to receive missed chunks
 * before continuing with the live stream.
 *
 * @example
 * ```typescript
 * const cache = mastra.getServerCache();
 *
 * // Get cached history
 * const history = await cache.listFromTo(runId, 0);
 *
 * // Create combined stream
 * const stream = createReplayStream({
 *   history: history as ChunkType[],
 *   liveSource: workflow.stream(),
 *   cache,
 *   cacheKey: runId,
 * });
 * ```
 */
export function createReplayStream<T>(options: {
  /**
   * Cached chunks to emit first
   */
  history: T[];

  /**
   * Live stream to continue from after history
   */
  liveSource: ReadableStream<T>;

  /**
   * Optional cache for continued caching of live chunks
   */
  cache?: MastraServerCache;

  /**
   * Cache key for continued caching
   */
  cacheKey?: string;

  /**
   * Optional serializer for caching
   */
  serialize?: (chunk: T) => unknown;
}): ReadableStream<T> {
  const { history, liveSource, cache, cacheKey, serialize = (x: T) => x } = options;

  let historyIndex = 0;
  let liveReader: ReadableStreamDefaultReader<T> | null = null;
  let historyComplete = false;

  return new ReadableStream<T>({
    async pull(controller) {
      // First, emit all history chunks
      if (!historyComplete) {
        if (historyIndex < history.length) {
          controller.enqueue(history[historyIndex]);
          historyIndex++;
          return;
        }
        historyComplete = true;
        liveReader = liveSource.getReader();
      }

      // Then, read from live source
      if (liveReader) {
        try {
          const { done, value } = await liveReader.read();

          if (done) {
            controller.close();
            return;
          }

          // Cache the live chunk if caching is enabled
          if (cache && cacheKey) {
            const serialized = serialize(value);
            cache.listPush(cacheKey, serialized).catch(() => {});
          }

          controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      }
    },

    cancel() {
      if (liveReader) {
        void liveReader.cancel();
      }
    },
  });
}

/**
 * Helper to create a caching transform and get history in one call.
 *
 * This is the recommended way to add caching to workflow streams.
 *
 * @example
 * ```typescript
 * const { pipeThrough, getHistory, clearCache } = withStreamCaching({
 *   cache: mastra.getServerCache(),
 *   cacheKey: runId,
 * });
 *
 * // Apply caching to a stream
 * const cachedStream = workflow.fullStream.pipeThrough(pipeThrough());
 *
 * // On reconnect, get history and create replay stream
 * const history = await getHistory();
 * const replayStream = createReplayStream({
 *   history,
 *   liveSource: workflow.resumeStream(),
 * });
 * ```
 */
export function withStreamCaching<T>(options: CachingTransformStreamOptions<T>): {
  /**
   * Creates a new TransformStream that caches chunks.
   * Call this each time you need a new caching transform.
   */
  pipeThrough: () => TransformStream<T, T>;

  /**
   * Get cached history for this stream
   */
  getHistory: (offset?: number) => Promise<T[]>;

  /**
   * Clear the cache for this stream
   */
  clearCache: () => Promise<void>;
} {
  const { cache, cacheKey, serialize, deserialize } = options;

  return {
    pipeThrough: () => {
      const { transform } = createCachingTransformStream({ cache, cacheKey, serialize, deserialize });
      return transform;
    },

    getHistory: async (offset = 0) => {
      const deserializeFn = deserialize ?? ((x: unknown) => x as T);
      const cached = await cache.listFromTo(cacheKey, offset);
      return cached.map(item => deserializeFn(item));
    },

    clearCache: async () => {
      await cache.delete(cacheKey);
    },
  };
}
