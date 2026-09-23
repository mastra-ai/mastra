import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { detectProtocolEra, peekFirstLine } from '../protocol-era';

describe('detectProtocolEra', () => {
  it('routes a legacy initialize handshake to the 1.x server', () => {
    // Captured from Cursor 3.11.13 and Codex CLI 0.153.3.
    const cursor =
      '{"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{"tools":true},"clientInfo":{"name":"Cursor","version":"1.0.0"}},"jsonrpc":"2.0","id":0}';
    expect(detectProtocolEra(cursor)).toBe('legacy');
  });

  it('routes anything else to the 2026-07-28 server', () => {
    expect(detectProtocolEra('{"jsonrpc":"2.0","id":0,"method":"server/discover","params":{}}')).toBe('2026-07-28');
    expect(detectProtocolEra('{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')).toBe('2026-07-28');
    expect(detectProtocolEra('not json')).toBe('2026-07-28');
    expect(detectProtocolEra('')).toBe('2026-07-28');
    expect(detectProtocolEra(undefined)).toBe('2026-07-28');
  });
});

describe('peekFirstLine', () => {
  async function drain(stream: PassThrough): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  it('returns the first line and leaves the whole stream intact for the transport', async () => {
    const stream = new PassThrough();
    const payload = '{"method":"initialize"}\n{"method":"tools/list"}\n';
    stream.write(payload.slice(0, 10));
    stream.write(payload.slice(10));
    stream.end();

    const first = await peekFirstLine(stream);

    expect(first).toBe('{"method":"initialize"}');
    // Every byte, including the peeked line, is still readable afterwards.
    await expect(drain(stream)).resolves.toBe(payload);
  });

  it('resolves undefined when the stream ends before a newline', async () => {
    const stream = new PassThrough();
    stream.end('{"method":"initialize"}');

    await expect(peekFirstLine(stream)).resolves.toBeUndefined();
  });
});
