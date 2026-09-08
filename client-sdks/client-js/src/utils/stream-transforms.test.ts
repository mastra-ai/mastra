import { describe, expect, it } from 'vitest';
import { createRecordSeparatorJsonTransform, createSseJsonTransform } from './stream-transforms';

const encoder = new TextEncoder();

function bytes(value: string): ArrayBuffer {
  const encoded = encoder.encode(value);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
}

async function readAll<T>(transform: TransformStream<ArrayBuffer, T>, chunks: ArrayBuffer[]): Promise<T[]> {
  const stream = new ReadableStream<ArrayBuffer>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  }).pipeThrough(transform);

  const reader = stream.getReader();
  const records: T[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) return records;
    records.push(value);
  }
}

describe('createRecordSeparatorJsonTransform', () => {
  it('preserves a UTF-8 code point split across chunks', async () => {
    const encoded = encoder.encode('{"message":"mañana"}\x1E');
    const splitAt = encoded.indexOf(0xc3) + 1;
    const chunks = [encoded.slice(0, splitAt).buffer as ArrayBuffer, encoded.slice(splitAt).buffer as ArrayBuffer];

    await expect(readAll(createRecordSeparatorJsonTransform(), chunks)).resolves.toEqual([{ message: 'mañana' }]);
  });

  it('waits for a separator delivered in a later write', async () => {
    await expect(readAll(createRecordSeparatorJsonTransform(), [bytes('{"id":1}'), bytes('\x1E')])).resolves.toEqual([
      { id: 1 },
    ]);
  });

  it('parses multiple records delivered in one chunk', async () => {
    await expect(readAll(createRecordSeparatorJsonTransform(), [bytes('{"id":1}\x1E{"id":2}\x1E')])).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it('does not parse JSON primitives until their separator arrives', async () => {
    await expect(
      readAll(createRecordSeparatorJsonTransform<number>(), [bytes('12'), bytes('34\x1E')]),
    ).resolves.toEqual([1234]);
  });

  it('rejects malformed terminated records instead of combining them with later records', async () => {
    await expect(
      readAll(createRecordSeparatorJsonTransform(), [bytes('{"bad":}\x1E{"valid":true}\x1E')]),
    ).rejects.toThrow(SyntaxError);
  });

  it('parses a valid final record without a separator', async () => {
    await expect(readAll(createRecordSeparatorJsonTransform(), [bytes('{"final":true}')])).resolves.toEqual([
      { final: true },
    ]);
  });

  it.each(['{"bad":', '{"unterminated"'])('rejects malformed or incomplete EOF data: %s', async record => {
    await expect(readAll(createRecordSeparatorJsonTransform(), [bytes(record)])).rejects.toThrow(SyntaxError);
  });
});

describe('createSseJsonTransform', () => {
  it('parses CRLF frames, ignores comments, and preserves split UTF-8 payloads', async () => {
    const encoded = encoder.encode(': keepalive\r\ndata: {"message":"mañana"}\r\n\r\n');
    const splitAt = encoded.indexOf(0xc3) + 1;
    const chunks = [encoded.slice(0, splitAt).buffer as ArrayBuffer, encoded.slice(splitAt).buffer as ArrayBuffer];

    await expect(readAll(createSseJsonTransform(), chunks)).resolves.toEqual([{ message: 'mañana' }]);
  });

  it('joins multiple data fields and rejects malformed complete payloads', async () => {
    await expect(
      readAll(createSseJsonTransform(), [bytes('event: task\ndata: {"id":\ndata: 1}\n\n')]),
    ).resolves.toEqual([{ id: 1 }]);
    await expect(readAll(createSseJsonTransform(), [bytes('data: {"bad":}\n\n')])).rejects.toThrow(SyntaxError);
  });

  it('ignores the SSE data: [DONE] terminator instead of JSON.parse-ing it', async () => {
    await expect(readAll(createSseJsonTransform(), [bytes('data: {"id":1}\n\ndata: [DONE]\n\n')])).resolves.toEqual([
      { id: 1 },
    ]);
  });
});
