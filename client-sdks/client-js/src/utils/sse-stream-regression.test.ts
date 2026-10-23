import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';
import { processMastraNetworkStream, processMastraStream } from './process-mastra-stream';

const event = (text: string) => ({ type: 'text-delta', payload: { id: '1', text } });
const sse = (text: string) => `data: ${JSON.stringify(event(text))}`;
const bytesStream = (wire: string, size: number) => {
  const bytes = new TextEncoder().encode(wire);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + size));
      offset = Math.min(bytes.length, offset + size);
    },
  });
};

// Measure delimiter searches rather than wall-clock time (#28188). Keep the real
// string operations: only their input lengths are observed, never their results mocked.
const countScannedText = () => {
  let scanned = 0;
  const split = String.prototype.split;
  const indexOf = String.prototype.indexOf;
  const includes = String.prototype.includes;
  const spies = [
    vi.spyOn(String.prototype, 'split').mockImplementation(function (this: string, separator, limit) {
      if (separator === '\n\n') scanned += this.length;
      return split.call(this, separator, limit);
    }),
    vi.spyOn(String.prototype, 'indexOf').mockImplementation(function (this: string, search, position = 0) {
      const found = indexOf.call(this, search, position);
      if (search === '\n\n') scanned += (found < 0 ? this.length : found + 2) - position;
      return found;
    }),
    vi.spyOn(String.prototype, 'includes').mockImplementation(function (this: string, search, position = 0) {
      if (search === '\n\n') scanned += this.length - position;
      return includes.call(this, search, position);
    }),
  ];
  return { get scanned() { return scanned; }, restore: () => spies.forEach(spy => spy.mockRestore()) };
};

for (const process of [processMastraStream, processMastraNetworkStream]) {
  describe(process.name, () => {
    it('bounds delimiter scans for a large fragmented event (#28188)', async () => {
      const wire = `${sse('x'.repeat(128 * 1024))}\n\ndata: [DONE]\n\n`;
      const counter = countScannedText();
      const chunks: unknown[] = [];
      try {
        await process({ stream: bytesStream(wire, 128), onChunk: chunk => { chunks.push(chunk); } });
      } finally {
        counter.restore();
      }
      expect(chunks).toEqual([event('x'.repeat(128 * 1024))]);
      expect(counter.scanned).toBeLessThanOrEqual(wire.length * 4);
    });

    it.each([1, 3, 4096])('preserves UTF-8, delimiters, DONE and unflushed EOF with %i-byte reads', async size => {
      const chunks: unknown[] = [];
      await process({
        stream: bytesStream(`${sse('hé🙂')}\n\n${sse('next')}\n\ndata: [DONE]\n\n${sse('ignored')}\n\n`, size),
        onChunk: chunk => { chunks.push(chunk); },
      });
      expect(chunks).toEqual([event('hé🙂'), event('next')]);
      const tail: unknown[] = [];
      await process({ stream: bytesStream(sse('unterminated'), size), onChunk: chunk => { tail.push(chunk); } });
      expect(tail).toEqual([]);
    });

    it('cancels an unfinished event and releases the reader', async () => {
      const abort = new AbortController();
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new TextEncoder().encode('data: {')); },
        cancel() { cancelled = true; },
      });
      const chunks: unknown[] = [];
      const processing = process({ stream, signal: abort.signal, onChunk: chunk => { chunks.push(chunk); } });
      abort.abort();
      await processing;
      expect(cancelled).toBe(true);
      expect(stream.locked).toBe(false);
      expect(chunks).toEqual([]);
    });
  });
}

describe('MastraClient agent.stream SSE readers', () => {
  let wire = '';
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.end(wire);
  });
  let baseUrl: string;
  beforeAll(async () => {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP server');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it('bounds scanning through agent.stream and processDataStream (#28188)', async () => {
    wire = `${sse('x'.repeat(2 * 1024 * 1024))}\n\ndata: [DONE]\n\n`;
    const counter = countScannedText();
    const chunks: unknown[] = [];
    try {
      const result = await new MastraClient({ baseUrl, retries: 0 }).getAgent('a').stream('hi');
      await result.processDataStream({ onChunk: async chunk => { chunks.push(chunk); } });
    } finally {
      counter.restore();
    }
    expect(chunks).toEqual([event('x'.repeat(2 * 1024 * 1024))]);
    // Three readers consume the wire. Allow constant overhead, never a factor
    // proportional to the number of HTTP reads.
    expect(counter.scanned).toBeLessThanOrEqual(wire.length * 8);
  });

  it('flushes an unterminated final event on the returned stream and removes DONE', async () => {
    wire = `${sse('hé🙂')}\n\ndata: [DONE]\n\n${sse('final')}`;
    const result = await new MastraClient({ baseUrl, retries: 0 }).getAgent('a').stream('hi');
    const chunks: unknown[] = [];
    await result.processDataStream({ onChunk: async chunk => { chunks.push(chunk); } });
    expect(chunks).toEqual([event('hé🙂'), event('final')]);
  });
});
