import type { ThreadSignalChunk } from './types';

function parseEventBlock(block: string): ThreadSignalChunk | 'done' | undefined {
  const data = block
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n');
  if (!data) return undefined;
  if (data === '[DONE]') return 'done';
  return JSON.parse(data) as ThreadSignalChunk;
}

export async function processThreadSignalStream(options: {
  stream: ReadableStream<Uint8Array>;
  onChunk: (chunk: ThreadSignalChunk) => void | Promise<void>;
  signal?: AbortSignal;
}): Promise<void> {
  const reader = options.stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const abort = () => void reader.cancel();

  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (options.signal?.aborted) return;
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        if (options.signal?.aborted) return;
        const event = parseEventBlock(block);
        if (event === 'done') return;
        if (event) await options.onChunk(event);
      }
      if (done) break;
    }

    if (options.signal?.aborted) return;
    const finalEvent = parseEventBlock(buffer);
    if (finalEvent && finalEvent !== 'done') await options.onChunk(finalEvent);
  } finally {
    options.signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
