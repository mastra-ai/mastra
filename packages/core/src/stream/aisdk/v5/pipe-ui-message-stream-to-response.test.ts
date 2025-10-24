import { ReadableStream } from 'stream/web';
import { describe, it, expect } from 'vitest';
import { pipeUIMessageStreamToResponse } from './pipe-ui-message-stream-to-response';

function createMockServerResponse() {
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let code = 200;
  let message = 'OK';
  let ended = false;

  const res: any = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = String(v);
    },
    get headers() {
      return headers;
    },
    write(chunk: any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    },
    end() {
      ended = true;
    },
    flushHeaders() {},
    set statusCode(v: number) {
      code = v;
    },
    get statusCode() {
      return code;
    },
    set statusMessage(v: string) {
      message = v;
    },
    get statusMessage() {
      return message;
    },
    async waitForEnd() {
      const start = Date.now();
      while (!ended && Date.now() - start < 1500) await new Promise(r => setTimeout(r, 5));
      if (!ended) throw new Error('response did not end');
    },
    getDecodedChunks() {
      return chunks.map(b => b.toString('utf8'));
    },
  };
  return res;
}

function arrayToStream<T>(parts: T[]): ReadableStream<unknown> {
  return new ReadableStream<unknown>({
    start(controller) {
      for (const p of parts) controller.enqueue(p);
      controller.close();
    },
  });
}

describe('pipeUIMessageStreamToResponse', () => {
  it('writes SSE with correct headers and chunks', async () => {
    const res = createMockServerResponse();

    pipeUIMessageStreamToResponse({
      response: res as any,
      status: 200,
      statusText: 'OK',
      headers: { 'Custom-Header': 'test' },
      stream: arrayToStream([
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', delta: 'hello' },
        { type: 'text-end', id: '1' },
      ]),
    });

    await res.waitForEnd();

    expect(res.statusCode).toBe(200);
    expect(res.statusMessage).toBe('OK');

    // Vercel-equivalent header set
    expect(res.headers).toMatchObject({
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'x-vercel-ai-ui-message-stream': 'v1',
      'custom-header': 'test',
    });

    // Output lines mirror Vercel's tests
    const out = res.getDecodedChunks();
    expect(out).toEqual([
      'data: {"type":"text-start","id":"1"}\n\n',
      'data: {"type":"text-delta","id":"1","delta":"hello"}\n\n',
      'data: {"type":"text-end","id":"1"}\n\n',
      'data: [DONE]\n\n',
    ]);
  });

  it('emits an error chunk and then closes', async () => {
    const res = createMockServerResponse();

    const errStream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'error', errorText: 'Custom error message' });
        controller.close();
      },
    });

    pipeUIMessageStreamToResponse({ response: res as any, stream: errStream, status: 200 });

    await res.waitForEnd();

    const out = res.getDecodedChunks();
    expect(out).toEqual(['data: {"type":"error","errorText":"Custom error message"}\n\n', 'data: [DONE]\n\n']);
  });

  it('uses default status 200 when not provided', async () => {
    const res = createMockServerResponse();

    pipeUIMessageStreamToResponse({
      response: res as any,
      stream: arrayToStream([{ type: 'text-delta', id: '1', delta: 'test' }]),
    });

    await res.waitForEnd();

    expect(res.statusCode).toBe(200);
  });

  it('merges custom headers with default SSE headers', async () => {
    const res = createMockServerResponse();

    pipeUIMessageStreamToResponse({
      response: res as any,
      stream: arrayToStream([{ type: 'text-delta', id: '1', delta: 'test' }]),
      headers: {
        'X-Custom-1': 'value1',
        'X-Custom-2': 'value2',
      },
    });

    await res.waitForEnd();

    expect(res.headers).toMatchObject({
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'x-vercel-ai-ui-message-stream': 'v1',
      'x-custom-1': 'value1',
      'x-custom-2': 'value2',
    });
  });

  it('always ends with [DONE] marker', async () => {
    const res = createMockServerResponse();

    pipeUIMessageStreamToResponse({
      response: res as any,
      stream: arrayToStream([
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', delta: 'chunk1' },
        { type: 'text-delta', id: '1', delta: 'chunk2' },
      ]),
    });

    await res.waitForEnd();

    const out = res.getDecodedChunks();
    expect(out[out.length - 1]).toBe('data: [DONE]\n\n');
  });

  it('handles empty stream', async () => {
    const res = createMockServerResponse();

    pipeUIMessageStreamToResponse({
      response: res as any,
      stream: arrayToStream([]),
    });

    await res.waitForEnd();

    const out = res.getDecodedChunks();
    expect(out).toEqual(['data: [DONE]\n\n']);
  });

  it('formats complex objects correctly in SSE', async () => {
    const res = createMockServerResponse();

    const complexObject = {
      type: 'tool-call',
      toolCallId: 'call_123',
      toolName: 'search',
      input: { query: 'test', limit: 10 },
    };

    pipeUIMessageStreamToResponse({
      response: res as any,
      stream: arrayToStream([complexObject]),
    });

    await res.waitForEnd();

    const out = res.getDecodedChunks();
    expect(out[0]).toBe(`data: ${JSON.stringify(complexObject)}\n\n`);
  });

  it('calls consumeSseStream with teed stream when provided', async () => {
    const res = createMockServerResponse();
    const consumedChunks: string[] = [];

    pipeUIMessageStreamToResponse({
      response: res as any,
      stream: arrayToStream([
        { type: 'text-delta', id: '1', delta: 'test1' },
        { type: 'text-delta', id: '1', delta: 'test2' },
      ]),
      consumeSseStream: async ({ stream }) => {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            consumedChunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
      },
    });

    await res.waitForEnd();

    // Give consumeSseStream time to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify both the response and consumeSseStream received the data
    const responseChunks = res.getDecodedChunks();
    expect(responseChunks.length).toBe(3); // 2 data chunks + [DONE]
    expect(consumedChunks.length).toBe(3); // Same chunks
  });
});
