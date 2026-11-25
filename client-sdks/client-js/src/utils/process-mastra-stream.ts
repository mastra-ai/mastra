import type { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { createSseEventSplitter } from './sse-event-splitter';

// Cancel reason after a failed onChunk, so sources can tell the SDK's cleanup apart from a consumer detach.
// Wraps the thrown value so this works whatever onChunk throws.
class HandlerFailure extends Error {
  constructor(cause: unknown) {
    super('onChunk handler failed', { cause });
    this.name = 'HandlerFailure';
  }
}
export const isHandlerFailure = (reason: unknown) => reason instanceof HandlerFailure;

async function sharedProcessMastraStream({
  stream,
  onChunk,
  signal,
}: {
  stream: globalThis.ReadableStream<Uint8Array>;
  onChunk: (chunk: any) => void | Promise<void>;
  signal?: AbortSignal;
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const splitEvents = createSseEventSplitter();
  const abort = () => void reader.cancel();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Only complete events are emitted; this reader intentionally does not flush at EOF.
      const lines = splitEvents(decoder.decode(value, { stream: true }));

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: '

          if (data === '[DONE]') {
            return;
          }
          let json;
          try {
            json = JSON.parse(data);
          } catch (error) {
            console.error('❌ JSON parse error:', error, 'Data:', data);
            continue;
          }
          if (json) {
            await onChunk(json);
          }
        }
      }
    }
  } catch (error) {
    // Releasing the lock alone leaves the source open, so tell the producer to stop.
    // Not awaited: a cancel that never settles must not hold back the caller's error.
    if (!signal?.aborted) void reader.cancel(new HandlerFailure(error)).catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

export async function processMastraNetworkStream({
  stream,
  onChunk,
  signal,
}: {
  stream: globalThis.ReadableStream<Uint8Array>;
  onChunk: (chunk: NetworkChunkType) => void | Promise<void>;
  signal?: AbortSignal;
}) {
  return sharedProcessMastraStream({
    stream,
    onChunk,
    signal,
  });
}

export async function processMastraStream({
  stream,
  onChunk,
  signal,
}: {
  stream: globalThis.ReadableStream<Uint8Array>;
  onChunk: (chunk: ChunkType) => void | Promise<void>;
  signal?: AbortSignal;
}) {
  return sharedProcessMastraStream({
    stream,
    onChunk,
    signal,
  });
}
