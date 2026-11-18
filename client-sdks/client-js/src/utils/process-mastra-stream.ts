import type { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { createSseEventSplitter } from './sse-event-splitter';

async function sharedProcessMastraStream({
  stream,
  onChunk,
  signal,
  stopSource,
}: {
  stream: globalThis.ReadableStream<Uint8Array>;
  onChunk: (chunk: any) => void | Promise<void>;
  signal?: AbortSignal;
  /**
   * Stops whatever feeds `stream` when `onChunk` fails. Pass this when `stream` is not
   * the caller's own to cancel: cancelling a stream the caller owns has side effects
   * beyond stopping the producer (#30788 review). Defaults to cancelling `stream`.
   */
  stopSource?: (reason: unknown) => void;
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
    // A consumer that stopped reading must tell the producer to stop too: releasing
    // the lock leaves the response open and the server keeps generating (#30788).
    // Stopping the source must never delay the caller's error: a caller can hold a
    // clone of the response, and cancelling through that stream stays pending while
    // its sibling is open, which would hang the caller and hold the reader lock.
    // When the signal aborted, the abort handler already stopped the source.
    if (!signal?.aborted) {
      if (stopSource) {
        try {
          stopSource(error);
        } catch {
          // The handler's error is what the caller needs to see.
        }
      } else {
        // An already-errored stream rejects cancel with its stored error, and that is
        // not the error the caller is waiting for.
        void reader.cancel(error).catch(() => {});
      }
    }
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
  stopSource,
}: {
  stream: globalThis.ReadableStream<Uint8Array>;
  onChunk: (chunk: NetworkChunkType) => void | Promise<void>;
  signal?: AbortSignal;
  stopSource?: (reason: unknown) => void;
}) {
  return sharedProcessMastraStream({
    stream,
    onChunk,
    signal,
    stopSource,
  });
}

export async function processMastraStream({
  stream,
  onChunk,
  signal,
  stopSource,
}: {
  stream: globalThis.ReadableStream<Uint8Array>;
  onChunk: (chunk: ChunkType) => void | Promise<void>;
  signal?: AbortSignal;
  stopSource?: (reason: unknown) => void;
}) {
  return sharedProcessMastraStream({
    stream,
    onChunk,
    signal,
    stopSource,
  });
}
