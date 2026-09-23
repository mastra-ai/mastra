import { describe, expect, it } from 'vitest';

import { readSSE } from './readSSE';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function framesOf(chunks: string[]) {
  const frames: { event: string; data: string }[] = [];
  await readSSE(streamOf(chunks), (event, data) => frames.push({ event, data }));
  return frames;
}

describe('readSSE', () => {
  it('reads a frame split across reads, whatever the line ending', async () => {
    expect(await framesOf(['event: feed\ndata: {"a":1}', '\n\n'])).toEqual([{ event: 'feed', data: '{"a":1}' }]);
    expect(await framesOf(['event: feed\r\ndata: {"a":1}\r\n\r\n'])).toEqual([{ event: 'feed', data: '{"a":1}' }]);
  });

  it('keeps a CRLF frame whole when the read boundary lands between \\r and \\n', async () => {
    expect(await framesOf(['event: feed\r', '\ndata: {"a":1}\r\n\r\n'])).toEqual([{ event: 'feed', data: '{"a":1}' }]);
  });

  it('reads a CR-only frame that closes on the last byte of the stream', async () => {
    expect(await framesOf(['event: feed\rdata: {"a":1}\r\r'])).toEqual([{ event: 'feed', data: '{"a":1}' }]);
  });

  it('defaults the event name and drops a frame carrying no data', async () => {
    expect(await framesOf(['data: hello\n\n', ': ping\n\n'])).toEqual([{ event: 'message', data: 'hello' }]);
  });
});
