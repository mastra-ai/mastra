import type { ReadableStream } from 'stream/web';

export async function processMastraStream({
  stream,
  onChunk,
}: {
  stream: ReadableStream<Uint8Array>;
  onChunk: (chunk: any) => Promise<void>;
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
          console.log(line, 'LINEEEEE');
          const data = line.slice(6); // Remove 'data: '

          if (data === '[DONE]') {
            console.log('🏁 Stream finished');
            return;
          }

          try {
            const json = JSON.parse(data);
            console.log('📦 Parsed chunk:', json);
            await onChunk(json);
          } catch (error) {
            console.error('❌ JSON parse error:', error, 'Data:', data);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
