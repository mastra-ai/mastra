import type { ChunkType, NetworkChunkType } from '@mastra/core/stream';

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
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || ''; // Keep incomplete frame in buffer

      for (const frame of frames) {
        // An SSE frame may carry other fields (`id:`, `event:`, `retry:`) and comment
        // lines alongside its `data:` lines, so scan the frame line by line rather than
        // assuming it starts with `data:` — otherwise the whole chunk is silently dropped.
        const dataLines: string[] = [];
        for (const line of frame.split(/\r\n|\n|\r/)) {
          if (!line.startsWith('data:')) continue;
          const value = line.slice('data:'.length);
          dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
        }

        if (dataLines.length === 0) continue;

        const data = dataLines.join('\n');
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
