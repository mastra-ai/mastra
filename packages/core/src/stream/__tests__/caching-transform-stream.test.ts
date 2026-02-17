/**
 * Tests for CachingTransformStream utilities.
 *
 * These utilities provide caching for direct TransformStream-based streaming,
 * enabling resumable streams without requiring PubSub architecture.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryServerCache } from '../../cache/inmemory';
import { createCachingTransformStream, createReplayStream, withStreamCaching } from '../caching-transform-stream';

describe('createCachingTransformStream', () => {
  let cache: InMemoryServerCache;

  beforeEach(() => {
    cache = new InMemoryServerCache();
  });

  it('should pass through chunks unchanged', async () => {
    const { transform } = createCachingTransformStream({
      cache,
      cacheKey: 'test-stream',
    });

    const chunks = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const source = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const result: unknown[] = [];
    const reader = source.pipeThrough(transform).getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result.push(value);
    }

    expect(result).toEqual(chunks);
  });

  it('should cache all chunks passing through', async () => {
    const { transform, getHistory } = createCachingTransformStream({
      cache,
      cacheKey: 'cached-stream',
    });

    const chunks = [{ text: 'Hello' }, { text: 'World' }];
    const source = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    // Consume the stream
    const reader = source.pipeThrough(transform).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Wait for async cache writes
    await new Promise(resolve => setTimeout(resolve, 50));

    const history = await getHistory();
    expect(history).toEqual(chunks);
  });

  it('should support custom serialization', async () => {
    const { transform, getHistory } = createCachingTransformStream({
      cache,
      cacheKey: 'serialized-stream',
      serialize: (chunk: { value: number }) => ({ serialized: chunk.value * 2 }),
      deserialize: (cached: unknown) => {
        const c = cached as { serialized: number };
        return { value: c.serialized / 2 };
      },
    });

    const chunks = [{ value: 10 }, { value: 20 }];
    const source = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const reader = source.pipeThrough(transform).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    const history = await getHistory();
    expect(history).toEqual(chunks);
  });

  it('should get history from a specific index', async () => {
    const { transform, getHistory } = createCachingTransformStream({
      cache,
      cacheKey: 'indexed-stream',
    });

    const chunks = ['a', 'b', 'c', 'd', 'e'];
    const source = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const reader = source.pipeThrough(transform).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    const fromOffset2 = await getHistory(2);
    expect(fromOffset2).toEqual(['c', 'd', 'e']);
  });

  it('should clear cache', async () => {
    const { transform, getHistory, clearCache } = createCachingTransformStream({
      cache,
      cacheKey: 'clearable-stream',
    });

    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ data: 'test' });
        controller.close();
      },
    });

    const reader = source.pipeThrough(transform).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    let history = await getHistory();
    expect(history).toHaveLength(1);

    await clearCache();

    history = await getHistory();
    expect(history).toHaveLength(0);
  });
});

describe('createReplayStream', () => {
  let cache: InMemoryServerCache;

  beforeEach(() => {
    cache = new InMemoryServerCache();
  });

  it('should emit history first then live chunks', async () => {
    const history = [{ seq: 1 }, { seq: 2 }];
    const liveChunks = [{ seq: 3 }, { seq: 4 }];

    const liveSource = new ReadableStream({
      start(controller) {
        for (const chunk of liveChunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const stream = createReplayStream({
      history,
      liveSource,
    });

    const result: unknown[] = [];
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result.push(value);
    }

    expect(result).toEqual([{ seq: 1 }, { seq: 2 }, { seq: 3 }, { seq: 4 }]);
  });

  it('should handle empty history', async () => {
    const liveChunks = [{ data: 'live' }];

    const liveSource = new ReadableStream({
      start(controller) {
        for (const chunk of liveChunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const stream = createReplayStream({
      history: [],
      liveSource,
    });

    const result: unknown[] = [];
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result.push(value);
    }

    expect(result).toEqual([{ data: 'live' }]);
  });

  it('should cache live chunks when cache is provided', async () => {
    const history = [{ cached: true }];
    const liveChunks = [{ live: true }];

    const liveSource = new ReadableStream({
      start(controller) {
        for (const chunk of liveChunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const stream = createReplayStream({
      history,
      liveSource,
      cache,
      cacheKey: 'replay-cache',
    });

    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // Only live chunks should be cached, not history (already cached)
    const cached = await cache.listFromTo('replay-cache', 0);
    expect(cached).toEqual([{ live: true }]);
  });

  it('should support cancellation', async () => {
    let cancelled = false;

    const liveSource = new ReadableStream({
      start(controller) {
        controller.enqueue({ data: 1 });
        // Keep stream open
      },
      cancel() {
        cancelled = true;
      },
    });

    const stream = createReplayStream({
      history: [],
      liveSource,
    });

    const reader = stream.getReader();
    await reader.read(); // Read one chunk
    await reader.cancel();

    expect(cancelled).toBe(true);
  });
});

describe('withStreamCaching', () => {
  let cache: InMemoryServerCache;

  beforeEach(() => {
    cache = new InMemoryServerCache();
  });

  it('should create reusable caching transforms', async () => {
    const { pipeThrough, getHistory, clearCache } = withStreamCaching({
      cache,
      cacheKey: 'reusable-cache',
    });

    // First stream
    const source1 = new ReadableStream({
      start(controller) {
        controller.enqueue({ batch: 1 });
        controller.close();
      },
    });

    const reader1 = source1.pipeThrough(pipeThrough()).getReader();
    while (true) {
      const { done } = await reader1.read();
      if (done) break;
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    let history = await getHistory();
    expect(history).toEqual([{ batch: 1 }]);

    // Second stream adds to the same cache
    const source2 = new ReadableStream({
      start(controller) {
        controller.enqueue({ batch: 2 });
        controller.close();
      },
    });

    const reader2 = source2.pipeThrough(pipeThrough()).getReader();
    while (true) {
      const { done } = await reader2.read();
      if (done) break;
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    history = await getHistory();
    expect(history).toEqual([{ batch: 1 }, { batch: 2 }]);

    // Clear cache
    await clearCache();
    history = await getHistory();
    expect(history).toHaveLength(0);
  });

  it('should work with serialization options', async () => {
    const { pipeThrough, getHistory } = withStreamCaching({
      cache,
      cacheKey: 'serialized-reusable',
      serialize: (n: number) => `num:${n}`,
      deserialize: (s: unknown) => parseInt((s as string).split(':')[1], 10),
    });

    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(42);
        controller.enqueue(100);
        controller.close();
      },
    });

    const reader = source.pipeThrough(pipeThrough()).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    const history = await getHistory();
    expect(history).toEqual([42, 100]);
  });
});

describe('Disconnect/Reconnect Scenario', () => {
  let cache: InMemoryServerCache;

  beforeEach(() => {
    cache = new InMemoryServerCache();
  });

  it('should support full disconnect/reconnect workflow', async () => {
    const cacheKey = 'workflow-stream';

    // === SERVER-SIDE STREAM PRODUCTION ===
    // On the server, the workflow produces all chunks through the caching transform
    // The caching happens at the source, before any client reads
    const allChunks = [
      { type: 'start', runId: 'run-1' },
      { type: 'chunk', data: 'Hello' },
      { type: 'chunk', data: ' World' },
    ];

    const { transform: cachingTransform, getHistory } = createCachingTransformStream({
      cache,
      cacheKey,
    });

    const serverSource = new ReadableStream({
      start(controller) {
        for (const chunk of allChunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    // Server consumes through caching transform (caches all chunks)
    const cachedStream = serverSource.pipeThrough(cachingTransform);
    const serverReader = cachedStream.getReader();

    // Simulate server fully consuming and caching the stream
    while (true) {
      const { done } = await serverReader.read();
      if (done) break;
    }

    // Wait for cache writes
    await new Promise(resolve => setTimeout(resolve, 50));

    // === CLIENT CONNECTION 1 ===
    // Client connects and receives 2 chunks, then disconnects
    const historyBefore = await getHistory();
    const receivedByClient1: unknown[] = [];

    for (let i = 0; i < 2 && i < historyBefore.length; i++) {
      receivedByClient1.push(historyBefore[i]);
    }

    expect(receivedByClient1).toHaveLength(2);

    // === WORKFLOW CONTINUES (producing more chunks on server) ===
    // Server continues producing chunks after client disconnected
    await cache.listPush(cacheKey, { type: 'chunk', data: '!' });
    await cache.listPush(cacheKey, { type: 'finish', status: 'complete' });

    // === CLIENT RECONNECTION ===
    // Client reconnects and gets complete history via replay stream
    const fullHistory = await getHistory();

    // Create a replay stream (in real scenario, liveSource would be ongoing stream)
    const liveSource = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    const replayStream = createReplayStream({
      history: fullHistory,
      liveSource,
    });

    const receivedAfterReconnect: unknown[] = [];
    const reconnectReader = replayStream.getReader();

    while (true) {
      const { done, value } = await reconnectReader.read();
      if (done) break;
      receivedAfterReconnect.push(value);
    }

    // Should receive ALL chunks - both cached during initial stream and added later
    expect(receivedAfterReconnect).toEqual([
      { type: 'start', runId: 'run-1' },
      { type: 'chunk', data: 'Hello' },
      { type: 'chunk', data: ' World' },
      { type: 'chunk', data: '!' },
      { type: 'finish', status: 'complete' },
    ]);
  });
});
