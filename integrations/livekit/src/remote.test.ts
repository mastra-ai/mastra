import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ReadableStream } from 'node:stream/web';
import { APIConnectionError, APIStatusError, APITimeoutError, llm } from '@livekit/agents';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VoiceTurnContext } from './bridge';
import { createRemoteAgentReplyGenerator, readMastraSSE } from './remote';

// ---------------------------------------------------------------------------
// Fake Mastra server (node:http) — records requests, streams recorded chunks.
// ---------------------------------------------------------------------------

interface Recorded {
  headers: http.IncomingHttpHeaders;
  body: string;
  json: Record<string, any> | undefined;
}
interface FakeServer {
  url: string;
  state: { requests: Recorded[]; aborted: boolean };
  close: () => Promise<void>;
}
type Handler = (args: {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  recorded: Recorded;
}) => void | Promise<void>;

const servers: FakeServer[] = [];

function startFakeServer(handler: Handler): Promise<FakeServer> {
  const state: FakeServer['state'] = { requests: [], aborted: false };
  const server = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      let json: Record<string, any> | undefined;
      try {
        json = body ? JSON.parse(body) : undefined;
      } catch {
        json = undefined;
      }
      const recorded: Recorded = { headers: req.headers, body, json };
      state.requests.push(recorded);
      res.on('close', () => {
        if (!res.writableEnded) state.aborted = true;
      });
      void Promise.resolve(handler({ req, res, recorded })).catch(error => {
        // Surface handler bugs instead of leaving the request hanging with no clue why: destroying
        // the response makes the client's fetch reject immediately, and the log pinpoints the cause.
        console.error('[remote.test] fake server handler threw', error);
        if (!res.writableEnded) res.destroy(error instanceof Error ? error : new Error(String(error)));
      });
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const fake: FakeServer = {
        url: `http://127.0.0.1:${port}`,
        state,
        close: () => new Promise<void>(r => server.close(() => r())),
      };
      servers.push(fake);
      resolve(fake);
    });
  });
}

function openSSE(res: http.ServerResponse) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
}
function writeChunk(res: http.ServerResponse, chunk: unknown) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}
function endSSE(res: http.ServerResponse, { done = true }: { done?: boolean } = {}) {
  if (done) res.write('data: [DONE]\n\n');
  res.end();
}
/** Responds with a full SSE stream: 200, each chunk framed, then `[DONE]`. */
function respondWithChunks(chunks: unknown[]): Handler {
  return ({ res }) => {
    openSSE(res);
    for (const chunk of chunks) writeChunk(res, chunk);
    endSSE(res);
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => s.close()));
});

// ---------------------------------------------------------------------------
// Test helpers.
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<VoiceTurnContext> = {}): VoiceTurnContext {
  return {
    messages: [{ role: 'user', content: 'Hello', id: 'u1' }],
    chatCtx: llm.ChatContext.empty(),
    memory: false,
    ...overrides,
  } as VoiceTurnContext;
}

async function readAll(stream: ReadableStream<string>): Promise<string[]> {
  const reader = stream.getReader();
  const out: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

function streamFromStringChunks(chunks: string[]): globalThis.ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new globalThis.ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(encoder.encode(chunks[i++]!));
      else controller.close();
    },
  });
}

// ===========================================================================
// SSE reader framing
// ===========================================================================

describe('readMastraSSE', () => {
  async function collect(stream: globalThis.ReadableStream<Uint8Array>, signal = new AbortController().signal) {
    const out: unknown[] = [];
    for await (const chunk of readMastraSSE(stream, signal)) out.push(chunk);
    return out;
  }

  it('reassembles a data: line split across chunk boundaries mid-JSON', async () => {
    const stream = streamFromStringChunks(['data: {"type":"text-delta","payl', 'oad":{"text":"hi"}}\n\n']);
    expect(await collect(stream)).toEqual([{ type: 'text-delta', payload: { text: 'hi' } }]);
  });

  it('yields multiple events delivered in one chunk', async () => {
    const stream = streamFromStringChunks([
      'data: {"type":"text-delta","payload":{"text":"a"}}\n\ndata: {"type":"text-delta","payload":{"text":"b"}}\n\n',
    ]);
    expect(await collect(stream)).toEqual([
      { type: 'text-delta', payload: { text: 'a' } },
      { type: 'text-delta', payload: { text: 'b' } },
    ]);
  });

  it('stops at the [DONE] terminator and ignores anything after it', async () => {
    const stream = streamFromStringChunks([
      'data: {"type":"text-delta","payload":{"text":"a"}}\n\n',
      'data: [DONE]\n\n',
      'data: {"type":"text-delta","payload":{"text":"never"}}\n\n',
    ]);
    expect(await collect(stream)).toEqual([{ type: 'text-delta', payload: { text: 'a' } }]);
  });

  it('tolerates a garbage (non-JSON) data line', async () => {
    const stream = streamFromStringChunks([
      'data: not json at all\n\n',
      'data: {"type":"text-delta","payload":{"text":"ok"}}\n\n',
    ]);
    expect(await collect(stream)).toEqual([{ type: 'text-delta', payload: { text: 'ok' } }]);
  });

  it('returns promptly when the signal aborts mid-stream', async () => {
    const encoder = new TextEncoder();
    let sent = false;
    // Emits one frame, then leaves the stream pending until the reader is cancelled.
    const stream = new globalThis.ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true;
          controller.enqueue(encoder.encode('data: {"type":"text-delta","payload":{"text":"hi"}}\n\n'));
        }
      },
    });
    const ac = new AbortController();
    const gen = readMastraSSE(stream, ac.signal);
    expect((await gen.next()).value).toEqual({ type: 'text-delta', payload: { text: 'hi' } });
    ac.abort();
    expect((await gen.next()).done).toBe(true);
  });
});

// ===========================================================================
// chunk loop, request shaping, hooks
// ===========================================================================

describe('createRemoteAgentReplyGenerator — streaming', () => {
  it('accumulates text deltas into the spoken stream', async () => {
    const server = await startFakeServer(
      respondWithChunks([
        { type: 'text-delta', payload: { text: 'Hello ' } },
        { type: 'text-delta', payload: { text: 'world' } },
      ]),
    );
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 0 });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    expect(await readAll(stream)).toEqual(['Hello ', 'world']);
  });

  it('returns null without a request when there are no messages', async () => {
    const server = await startFakeServer(respondWithChunks([]));
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test' });
    expect(await gen(makeCtx({ messages: [] }))).toBeNull();
    expect(server.state.requests).toHaveLength(0);
  });

  it('speaks tool feedback (with a trailing space) and fires onToolCall in order', async () => {
    const server = await startFakeServer(
      respondWithChunks([
        { type: 'tool-call', payload: { toolCallId: 'c1', toolName: 'lookup', args: { q: 'x' } } },
        { type: 'tool-call', payload: { toolCallId: 'c2', toolName: 'book', args: { id: 7 } } },
        { type: 'text-delta', payload: { text: 'Done.' } },
      ]),
    );
    const onToolCall = vi.fn();
    const toolFeedback = vi.fn(() => 'One moment.');
    const gen = createRemoteAgentReplyGenerator({
      baseUrl: server.url,
      agentId: 'test',
      retries: 0,
      onToolCall,
      toolFeedback,
    });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    expect(await readAll(stream)).toEqual(['One moment. ', 'One moment. ', 'Done.']);
    expect(onToolCall.mock.calls.map(c => c[0])).toEqual([
      { toolCallId: 'c1', toolName: 'lookup', args: { q: 'x' } },
      { toolCallId: 'c2', toolName: 'book', args: { id: 7 } },
    ]);
  });

  it('surfaces an error chunk as a stream error and does not retry after the first chunk', async () => {
    const server = await startFakeServer(
      respondWithChunks([
        { type: 'text-delta', payload: { text: 'partial' } },
        { type: 'error', payload: { error: 'boom' } },
      ]),
    );
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 2 });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    await expect(readAll(stream)).rejects.toThrow('boom');
    expect(server.state.requests).toHaveLength(1);
  });

  it('sends messages (with ids), memory, and requestContext in the body', async () => {
    const server = await startFakeServer(respondWithChunks([{ type: 'text-delta', payload: { text: 'ok' } }]));
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'callCenter', retries: 0 });
    const stream = (await gen(
      makeCtx({
        messages: [
          { role: 'assistant', content: 'earlier', id: 'a1' },
          { role: 'user', content: 'new question', id: 'u2' },
        ],
        memory: { thread: 'thread-1', resource: 'user-1' },
        requestContext: new RequestContext([['tenant', 'acme']]),
      }),
    )) as ReadableStream<string>;
    await readAll(stream);

    const body = server.state.requests[0]!.json!;
    expect(body.messages).toEqual([
      { role: 'assistant', content: 'earlier', id: 'a1' },
      { role: 'user', content: 'new question', id: 'u2' },
    ]);
    expect(body.memory).toEqual({ thread: 'thread-1', resource: 'user-1' });
    expect(body.requestContext).toEqual({ tenant: 'acme' });
  });

  it('defaults memory.resource to the thread id and omits memory when disabled', async () => {
    const server = await startFakeServer(respondWithChunks([{ type: 'text-delta', payload: { text: 'ok' } }]));
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 0 });
    await readAll((await gen(makeCtx({ memory: { thread: 't-only' } }))) as ReadableStream<string>);
    await readAll((await gen(makeCtx({ memory: false }))) as ReadableStream<string>);

    expect(server.state.requests[0]!.json!.memory).toEqual({ thread: 't-only', resource: 't-only' });
    expect('memory' in server.state.requests[1]!.json!).toBe(false);
  });

  it('sends static headers and a resolved async header function', async () => {
    const server = await startFakeServer(respondWithChunks([{ type: 'text-delta', payload: { text: 'ok' } }]));
    const staticGen = createRemoteAgentReplyGenerator({
      baseUrl: server.url,
      agentId: 'test',
      retries: 0,
      headers: { authorization: 'Bearer static' },
    });
    await readAll((await staticGen(makeCtx())) as ReadableStream<string>);
    expect(server.state.requests[0]!.headers.authorization).toBe('Bearer static');

    const asyncGen = createRemoteAgentReplyGenerator({
      baseUrl: server.url,
      agentId: 'test',
      retries: 0,
      headers: async () => ({ authorization: 'Bearer fresh' }),
    });
    await readAll((await asyncGen(makeCtx())) as ReadableStream<string>);
    expect(server.state.requests[1]!.headers.authorization).toBe('Bearer fresh');
  });
});

// ===========================================================================
// usage side channel
// ===========================================================================

describe('createRemoteAgentReplyGenerator — usage', () => {
  it('maps finish-chunk usage to ctx.onUsage (once) and the turn result', async () => {
    const server = await startFakeServer(
      respondWithChunks([
        { type: 'text-delta', payload: { text: 'hi' } },
        {
          type: 'finish',
          payload: { output: { usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, cachedInputTokens: 5 } } },
        },
      ]),
    );
    const onUsage = vi.fn();
    const onTurnComplete = vi.fn();
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 0, onTurnComplete });
    const stream = (await gen(makeCtx({ onUsage }))) as ReadableStream<string>;
    // Usage never reaches the spoken stream.
    expect(await readAll(stream)).toEqual(['hi']);

    const expected = { promptTokens: 10, completionTokens: 20, promptCachedTokens: 5, totalTokens: 30 };
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(expected);
    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    expect(onTurnComplete.mock.calls[0]![0].result.usage).toEqual(expected);
  });
});

// ===========================================================================
// onTurnComplete + barge-in
// ===========================================================================

describe('createRemoteAgentReplyGenerator — onTurnComplete + barge-in', () => {
  it('fires onTurnComplete once with interrupted:false on completion', async () => {
    const server = await startFakeServer(
      respondWithChunks([
        { type: 'text-delta', payload: { text: 'all ' } },
        { type: 'tool-call', payload: { toolCallId: 'c1', toolName: 'lookup', args: {} } },
        { type: 'text-delta', payload: { text: 'done' } },
      ]),
    );
    const onTurnComplete = vi.fn();
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 0, onTurnComplete });
    await readAll((await gen(makeCtx())) as ReadableStream<string>);

    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    const result = onTurnComplete.mock.calls[0]![0].result;
    expect(result.text).toBe('all done');
    expect(result.toolCalls).toEqual([{ toolCallId: 'c1', toolName: 'lookup', args: {} }]);
    expect(result.interrupted).toBe(false);
  });

  it('aborts the in-flight request and fires onTurnComplete once with interrupted:true on cancel', async () => {
    const server = await startFakeServer(({ res }) => {
      // Send one frame, then hold the connection open so cancel tears down a live request.
      openSSE(res);
      writeChunk(res, { type: 'text-delta', payload: { text: 'Hello ' } });
    });
    const onTurnComplete = vi.fn();
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 0, onTurnComplete });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    const reader = stream.getReader();
    expect((await reader.read()).value).toBe('Hello ');
    await reader.cancel();

    await vi.waitFor(() => expect(server.state.aborted).toBe(true));
    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    expect(onTurnComplete.mock.calls[0]![0].result).toMatchObject({ text: 'Hello ', interrupted: true });
  });
});

// ===========================================================================
// error typing, retry, timeout
// ===========================================================================

describe('createRemoteAgentReplyGenerator — error typing', () => {
  async function expectError(server: FakeServer, retries: number) {
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    try {
      await readAll(stream);
      throw new Error('expected the stream to reject');
    } catch (error) {
      return error;
    }
  }

  it('throws a non-retryable APIStatusError on a 4xx', async () => {
    const server = await startFakeServer(({ res }) => {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad request' }));
    });
    const error = await expectError(server, 2);
    expect(error).toBeInstanceOf(APIStatusError);
    expect((error as APIStatusError).statusCode).toBe(400);
    expect((error as APIStatusError).retryable).toBe(false);
    // A non-retryable status is never retried.
    expect(server.state.requests).toHaveLength(1);
  });

  it('keeps 429 retryable', async () => {
    const server = await startFakeServer(({ res }) => {
      res.writeHead(429);
      res.end();
    });
    const error = await expectError(server, 0);
    expect(error).toBeInstanceOf(APIStatusError);
    expect((error as APIStatusError).retryable).toBe(true);
  });

  it('retries a retryable 5xx up to `retries` times, then throws', async () => {
    const server = await startFakeServer(({ res }) => {
      res.writeHead(503);
      res.end();
    });
    const error = await expectError(server, 2);
    expect(error).toBeInstanceOf(APIStatusError);
    expect((error as APIStatusError).retryable).toBe(true);
    // initial attempt + 2 retries
    expect(server.state.requests).toHaveLength(3);
  });

  it('wraps a network failure as a retryable APIConnectionError', async () => {
    const gen = createRemoteAgentReplyGenerator({
      baseUrl: 'http://127.0.0.1:9',
      agentId: 'test',
      retries: 0,
      fetch: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof globalThis.fetch,
    });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    await expect(readAll(stream)).rejects.toBeInstanceOf(APIConnectionError);
  });
});

describe('createRemoteAgentReplyGenerator — first-token timeout', () => {
  it('throws APITimeoutError when the server accepts but never writes', async () => {
    const server = await startFakeServer(({ res }) => {
      // Accept the connection and hang: never write a byte.
      openSSE(res);
    });
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 0, timeoutMs: 80 });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    await expect(readAll(stream)).rejects.toBeInstanceOf(APITimeoutError);
  });

  it('does not time out when the first byte arrives within the budget', async () => {
    const server = await startFakeServer(respondWithChunks([{ type: 'text-delta', payload: { text: 'quick' } }]));
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 0, timeoutMs: 500 });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    expect(await readAll(stream)).toEqual(['quick']);
  });

  it('still times out when the server stalls after lifecycle metadata (watchdog survives step-start)', async () => {
    const server = await startFakeServer(({ res }) => {
      openSSE(res);
      // Lifecycle metadata is not model output; the watchdog must stay armed through it.
      writeChunk(res, { type: 'step-start', payload: {} });
    });
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 1, timeoutMs: 80 });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    const error = await readAll(stream).catch(e => e);
    expect(error).toBeInstanceOf(APITimeoutError);
    // The server committed to this generation at its first chunk — the timeout must not replay it.
    expect((error as APITimeoutError).retryable).toBe(false);
    expect(server.state.requests).toHaveLength(1);
  });

  it('recovers on a retry after the watchdog aborts the first attempt (fresh AbortController per attempt)', async () => {
    let requestCount = 0;
    const server = await startFakeServer(({ res }) => {
      requestCount++;
      if (requestCount === 1) {
        // Accept and hang forever so the watchdog fires and aborts this attempt.
        openSSE(res);
        return;
      }
      // The retry must not inherit an already-aborted signal from the first attempt.
      openSSE(res);
      writeChunk(res, { type: 'text-delta', payload: { text: 'recovered' } });
      endSSE(res);
    });
    const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 1, timeoutMs: 50 });
    const stream = (await gen(makeCtx())) as ReadableStream<string>;
    expect(await readAll(stream)).toEqual(['recovered']);
    expect(server.state.requests).toHaveLength(2);
  });
});

// ===========================================================================
// HITL chunks fail fast
// ===========================================================================

describe('createRemoteAgentReplyGenerator — HITL chunks fail loudly', () => {
  for (const type of ['tool-call-approval', 'tool-call-suspended'] as const) {
    it(`throws a descriptive error on a ${type} chunk without hanging`, async () => {
      const server = await startFakeServer(
        respondWithChunks([{ type, payload: { toolCallId: 'c1', toolName: 'risky', args: {}, resumeSchema: '{}' } }]),
      );
      const gen = createRemoteAgentReplyGenerator({ baseUrl: server.url, agentId: 'test', retries: 2 });
      const stream = (await gen(makeCtx())) as ReadableStream<string>;
      await expect(readAll(stream)).rejects.toThrow(/human-in-the-loop/i);
      // The failure happens after the first chunk, so it is not retried.
      expect(server.state.requests).toHaveLength(1);
    });
  }
});
