import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { chatRoute } from '../chat-route';

// A failing model or tool must not stream server stack traces (absolute file
// paths, usernames, code layout) to the chat client through the default
// `errorText` serializer.

const STACK_MARKERS = ['"stack"', '    at ', 'file://', __filename];

function failingModel(error: unknown = new Error('upstream 529 overloaded')) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'error', error },
      ] as any),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });
}

function toolCallingModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      const parts =
        call === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookupOrder', input: '{"orderId":"o-1"}' },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Sorry, the lookup failed.' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `msg-${call}`, modelId: 'mock-model', timestamp: new Date(0) },
          ...parts,
        ] as any),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });
}

const lookupOrder = createTool({
  id: 'lookupOrder',
  description: 'Look up an order',
  inputSchema: z.object({ orderId: z.string() }),
  execute: async () => {
    throw new Error('orders database unreachable');
  },
});

type Engine = 'normal' | 'durable';

function createMastra(engine: Engine, model: MockLanguageModelV2) {
  const plain = new Agent({
    id: 'support',
    name: 'Support',
    instructions: 'Help the user.',
    model,
    tools: { lookupOrder },
  });
  const agent = engine === 'durable' ? createDurableAgent({ agent: plain }) : plain;
  return new Mastra({ agents: { support: agent }, logger: false });
}

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

/** Serves a chatRoute over a real socket, with the Hono context members the route reads. */
async function serve(route: ReturnType<typeof chatRoute>, mastra: Mastra): Promise<string> {
  if (!('handler' in route)) throw new Error('Expected chatRoute to return a route handler');
  const pathPattern = new RegExp(`^${route.path.replace(':agentId', '(?<agentId>[^/]+)')}$`);

  server = createServer(async (req: IncomingMessage, res) => {
    const url = new URL(req.url!, 'http://localhost');
    const match = pathPattern.exec(url.pathname);
    if (!match) {
      res.writeHead(404).end();
      return;
    }
    const bodyText = await new Promise<string>(resolve => {
      let data = '';
      req.on('data', chunk => (data += chunk));
      req.on('end', () => resolve(data));
    });
    const raw = new Request(url, { method: req.method, headers: req.headers as HeadersInit, body: bodyText });
    const context = {
      req: {
        raw,
        json: async () => JSON.parse(bodyText),
        param: (name: string) => match.groups?.[name],
        query: (name: string) => url.searchParams.get(name) ?? undefined,
      },
      get: (key: string) => (key === 'mastra' ? mastra : undefined),
    };
    const response = (await route.handler(context as never, async () => {})) as Response;
    res.writeHead(response.status, Object.fromEntries(response.headers));
    Readable.fromWeb(response.body as any).pipe(res);
  });

  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

async function postChat(baseUrl: string): Promise<{ raw: string; events: any[] }> {
  const response = await fetch(`${baseUrl}/chat/support`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }] }),
  });
  expect(response.status).toBe(200);
  const raw = await response.text();
  const events = raw
    .split('\n\n')
    .map(frame => frame.trim())
    .filter(frame => frame.startsWith('data: ') && frame !== 'data: [DONE]')
    .map(frame => JSON.parse(frame.slice('data: '.length)));
  return { raw, events };
}

function expectNoStackTrace(text: string) {
  for (const marker of STACK_MARKERS) {
    expect(text).not.toContain(marker);
  }
}

describe.each<Engine>(['normal', 'durable'])('chatRoute default error serialization over HTTP, %s agent', engine => {
  it('a model that fails mid-stream sends the client its name and message, not the server stack', async () => {
    const mastra = createMastra(engine, failingModel());
    const baseUrl = await serve(chatRoute({ path: '/chat/:agentId' }), mastra);

    const { raw, events } = await postChat(baseUrl);

    expect(events.filter(e => e.type === 'text-delta').map(e => e.delta)).toEqual(['Hello']);
    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(JSON.parse(errorEvent.errorText)).toEqual({ name: 'Error', message: 'upstream 529 overloaded' });
    expectNoStackTrace(raw);
  });

  it.each([
    ['Anthropic', { type: 'overloaded_error', message: 'Overloaded' }, '"type":"overloaded_error"'],
    ['Google', { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' }, '"status":"UNAVAILABLE"'],
  ])('a %s error body keeps its provider error type', async (_provider, body, expectedField) => {
    const mastra = createMastra(engine, failingModel(body));
    const baseUrl = await serve(chatRoute({ path: '/chat/:agentId' }), mastra);

    const { raw, events } = await postChat(baseUrl);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent.errorText).toContain(body.message);
    expect(errorEvent.errorText).toContain(expectedField);
    expectNoStackTrace(raw);
  });

  it('a tool that throws sends the client its error message, not the server stack', async () => {
    const mastra = createMastra(engine, toolCallingModel());
    const baseUrl = await serve(chatRoute({ path: '/chat/:agentId' }), mastra);

    const { raw, events } = await postChat(baseUrl);

    const toolError = events.find(e => e.type === 'tool-output-error');
    expect(toolError).toBeDefined();
    expect(toolError.errorText).toContain('orders database unreachable');
    expectNoStackTrace(raw);
  });

  it('a custom onError still receives the full error, stack included', async () => {
    const received: unknown[] = [];
    const mastra = createMastra(engine, failingModel());
    const baseUrl = await serve(
      chatRoute({
        path: '/chat/:agentId',
        onError: error => {
          received.push(error);
          return 'custom';
        },
      }),
      mastra,
    );

    const { events } = await postChat(baseUrl);

    expect(events.find(e => e.type === 'error')?.errorText).toBe('custom');
    // The durable engine hands over its serialized { name, message, stack } shape
    // rather than an Error instance; either way the stack reaches onError intact.
    const error = received[0] as { message: string; stack: string };
    expect(error.message).toBe('upstream 529 overloaded');
    expect(error.stack).toContain('    at ');
  });
});
