/**
 * Unit tests for the islo SSE consumer.
 *
 * The wire format is verified against the live api.islo.dev `/exec/stream`
 * endpoint and recorded here as fixtures so the parser can evolve without
 * round-tripping to the API.
 */

import { describe, expect, it } from 'vitest';

import { consumeIsloStream } from './sse';

function streamFromString(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c));
      }
      controller.close();
    },
  });
}

describe('consumeIsloStream', () => {
  it('routes stdout, stderr, and exit events', async () => {
    const body = [
      ': keepalive',
      'event: stdout',
      'data: hello',
      'data: ',
      '',
      'event: stderr',
      'data: warn-line',
      '',
      'event: exit',
      'data: 7',
      '',
    ].join('\n');

    let out = '';
    let err = '';
    const result = await consumeIsloStream(streamFromString(body), {
      onStdout: (d) => {
        out += d;
      },
      onStderr: (d) => {
        err += d;
      },
    });

    expect(result.exitCode).toBe(7);
    expect(result.sawExit).toBe(true);
    // Multi-data lines join with '\n', so two lines `hello` + `` produce `hello\n`.
    expect(out).toBe('hello\n');
    expect(err).toBe('warn-line');
  });

  it('handles a chunked body where SSE events span chunk boundaries', async () => {
    const body =
      'event: stdout\ndata: line-1\n\nevent: stdout\ndata: line-2\n\nevent: exit\ndata: 0\n\n';
    const split = [body.slice(0, 12), body.slice(12, 30), body.slice(30)];

    const collected: string[] = [];
    const result = await consumeIsloStream(streamFromChunks(split), {
      onStdout: (d) => collected.push(d),
    });

    expect(result.exitCode).toBe(0);
    expect(result.sawExit).toBe(true);
    expect(collected).toEqual(['line-1', 'line-2']);
  });

  it('treats unknown event types as no-ops without throwing', async () => {
    const body = 'event: heartbeat\ndata: tick\n\nevent: stdout\ndata: ok\n\nevent: exit\ndata: 0\n\n';
    let out = '';
    const result = await consumeIsloStream(streamFromString(body), {
      onStdout: (d) => {
        out += d;
      },
    });
    expect(out).toBe('ok');
    expect(result.exitCode).toBe(0);
    expect(result.sawExit).toBe(true);
  });

  it('handles CRLF line endings', async () => {
    const body = 'event: stdout\r\ndata: hi\r\n\r\nevent: exit\r\ndata: 1\r\n\r\n';
    let out = '';
    const result = await consumeIsloStream(streamFromString(body), {
      onStdout: (d) => {
        out += d;
      },
    });
    expect(out).toBe('hi');
    expect(result.exitCode).toBe(1);
    expect(result.sawExit).toBe(true);
  });

  it('handles a final stdout event without a trailing blank line', async () => {
    const body = 'event: stdout\ndata: trailing\n';
    let out = '';
    const result = await consumeIsloStream(streamFromString(body), {
      onStdout: (d) => {
        out += d;
      },
    });
    expect(out).toBe('trailing');
    expect(result.exitCode).toBeNull();
    expect(result.sawExit).toBe(false);
  });

  it('does not treat a missing exit event as success', async () => {
    const result = await consumeIsloStream(streamFromString('event: stdout\ndata: ok\n\n'));

    expect(result.exitCode).toBeNull();
    expect(result.sawExit).toBe(false);
  });

  it('does not treat a malformed exit event as success', async () => {
    const result = await consumeIsloStream(streamFromString('event: exit\ndata: not-a-number\n\n'));

    expect(result.exitCode).toBeNull();
    expect(result.sawExit).toBe(false);
  });
});
