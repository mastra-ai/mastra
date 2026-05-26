import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ChunkType, NetworkChunkType } from '@mastra/core/stream';

/**
 * Stable error id used to distinguish errors thrown by a caller-supplied
 * `onChunk` callback from transport errors. Consumers that wrap
 * `processMastraStream` (e.g. the thread subscription reconnect loop) can
 * check `error.id === CLIENT_JS_ONCHUNK_CALLBACK_ERROR_ID` to decide whether
 * to retry the stream.
 */
export const CLIENT_JS_ONCHUNK_CALLBACK_ERROR_ID = 'CLIENT_JS_ONCHUNK_CALLBACK_THREW' as const;

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
  let buffer = '';
  const abort = () => void reader.cancel();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
            try {
              await onChunk(json);
            } catch (cause) {
              throw new MastraError(
                {
                  id: CLIENT_JS_ONCHUNK_CALLBACK_ERROR_ID,
                  domain: ErrorDomain.MASTRA,
                  category: ErrorCategory.USER,
                  text: 'onChunk callback threw while processing a stream chunk',
                  details: {
                    chunkType: typeof json === 'object' && json && 'type' in json ? String(json.type) : 'unknown',
                  },
                },
                cause,
              );
            }
          }
        }
      }
    }
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
