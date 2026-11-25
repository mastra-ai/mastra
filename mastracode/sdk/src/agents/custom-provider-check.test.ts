/**
 * Connection and model checks against custom OpenAI-compatible endpoints.
 *
 * Local HTTP servers stand in for the endpoints, so the assertions are on what
 * crossed the wire and on what a user is shown when the endpoint fails.
 */

import { createServer } from 'node:http';
import type { IncomingHttpHeaders, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createCustomProviderChatModel,
  listCustomProviderModels,
  testCustomProviderModel,
} from './custom-provider-check.js';
import type { CustomProviderConnection } from './custom-provider-check.js';

interface ReceivedRequest {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
}

interface Endpoint {
  /** Base URL to save on a custom provider. */
  url: string;
  origin: string;
  requests: ReceivedRequest[];
  /** Resolves when the client has closed the connection of the latest request. */
  closed: Promise<void>;
  close(): Promise<void>;
}

type Respond = (request: ReceivedRequest, res: ServerResponse) => void;

const endpoints: Endpoint[] = [];

afterEach(async () => {
  await Promise.all(endpoints.splice(0).map(endpoint => endpoint.close()));
});

/** An endpoint that records every request and answers through `respond`. */
async function startEndpoint(respond: Respond): Promise<Endpoint> {
  const requests: ReceivedRequest[] = [];
  let markClosed!: () => void;
  const closed = new Promise<void>(resolve => (markClosed = resolve));
  const server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      const request = { method: req.method ?? '', path: req.url ?? '', headers: req.headers };
      requests.push(request);
      res.on('close', markClosed);
      respond(request, res);
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const endpoint: Endpoint = {
    url: `${origin}/v1`,
    origin,
    requests,
    closed,
    close: () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
  endpoints.push(endpoint);
  return endpoint;
}

/** A response with a JSON body. */
function json(status: number, body: unknown): Respond {
  return (_, res) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
}

/** A response with a text body of the given content type. */
function text(status: number, body: string, contentType: string): Respond {
  return (_, res) => {
    res.writeHead(status, { 'content-type': contentType });
    res.end(body);
  };
}

/** One server-sent chat completion chunk carrying `delta`. */
function chunk(delta: unknown, finishReason: string | null = null): string {
  const body = { id: 'c', object: 'chat.completion.chunk', created: 0, model: 'model-x' };
  return `data: ${JSON.stringify({ ...body, choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`;
}

/** A streamed chat completion that says `content` and stops. */
function chatStream(content: string): Respond {
  return (_, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(`${chunk({ role: 'assistant', content })}${chunk({}, 'stop')}data: [DONE]\n\n`);
  };
}

/** Run the model test against `model-x` on `connection`. */
const testModel = (connection: CustomProviderConnection) =>
  testCustomProviderModel({ providerId: 'acme', connection, modelId: 'model-x' });

describe('listing the models of a custom endpoint', () => {
  const hostile = ['gpt\u001b]52;c;cm0gLXJmIH4K\u0007', '\u001b[2J\u001b[Hx', `m${'x'.repeat(256)}`];

  it.each<[string, unknown, string[] | 'invalid']>([
    ['OpenAI', { data: [{ id: 'b-model' }, { id: ' a-model ' }, { id: 'b-model' }] }, ['a-model', 'b-model']],
    ['Ollama', { models: [{ name: 'b-model' }, { name: 'a-model' }] }, ['a-model', 'b-model']],
    ['a plain array', ['b-model', { id: 'a-model' }], ['a-model', 'b-model']],
    // The TUI prints and saves ids, so an id with a control character is dropped, never cleaned.
    ['hostile ids mixed with a clean one', { data: [{ id: 'model-x' }, ...hostile.map(id => ({ id }))] }, ['model-x']],
    ['only hostile ids', { data: hostile.map(id => ({ id })) }, 'invalid'],
    ['a page that is not a list', { status: 'ok' }, 'invalid'],
  ])('reads %s', async (_, body, expected) => {
    const endpoint = await startEndpoint(json(200, body));

    const result = await listCustomProviderModels({ url: `${endpoint.url}/` });

    if (expected === 'invalid') expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } });
    else expect(result).toMatchObject({ ok: true, models: expected });
    expect(endpoint.requests.map(request => `${request.method} ${request.path}`)).toEqual(['GET /v1/models']);
  });

  it.each<[string, () => Promise<string>, Record<string, unknown>]>([
    [
      'a JSON error',
      async () => (await startEndpoint(json(401, { error: { message: 'Incorrect API key provided.' } }))).url,
      { kind: 'http', status: 401, detail: 'Incorrect API key provided.' },
    ],
    [
      'an HTML error page',
      async () =>
        (
          await startEndpoint(
            text(403, '<html><head><title>403 Forbidden</title></head><h1>Access denied</h1></html>', 'text/html'),
          )
        ).url,
      { kind: 'http', status: 403, detail: '403 Forbidden: Access denied' },
    ],
    [
      'a refused connection',
      async () => {
        const closed = await startEndpoint(() => {});
        await closed.close();
        return closed.url;
      },
      { kind: 'network' },
    ],
    ['an endpoint that never answers', async () => (await startEndpoint(() => {})).url, { kind: 'timeout' }],
  ])('reports %s', async (_, start, failure) => {
    const url = await start();

    const result = await listCustomProviderModels({ url }, { timeoutMs: 300 });

    expect(result).toMatchObject({ ok: false, failure });
  });

  it('names the status and the URL called in the failure message', async () => {
    const endpoint = await startEndpoint(json(403, {}));

    const result = await listCustomProviderModels({ url: endpoint.url });

    expect(result.ok ? '' : result.failure.message).toBe(`HTTP 403 Forbidden from ${endpoint.url}/models`);
  });

  // The page is parsed synchronously, where the timeout cannot stop it.
  it('reads a 1 MB error page of unclosed tags', async () => {
    const endpoint = await startEndpoint(text(500, `<html><h1>Broken</h1>${'<script'.repeat(150_000)}`, 'text/html'));

    const result = await listCustomProviderModels({ url: endpoint.url });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'http', status: 500, detail: 'Broken' } });
  }, 3000);
});

// The server makes these calls too: a redirect could send them somewhere the
// saved URL was never allowed to point, such as a cloud metadata address.
it('refuses a redirect on the model list and on the test message', async () => {
  const target = await startEndpoint(json(200, { data: [{ id: 'model-x' }] }));
  const endpoint = await startEndpoint((request, res) => {
    res.writeHead(307, { location: `${target.origin}${request.path}` });
    res.end();
  });

  const list = await listCustomProviderModels({ url: endpoint.url, apiKey: 'acme-secret' });
  const reply = await testModel({ url: endpoint.url, apiKey: 'acme-secret' });

  expect(list).toMatchObject({ ok: false, failure: { kind: 'redirect' } });
  expect(reply).toMatchObject({ ok: false, failure: { kind: 'redirect' } });
  expect(target.requests).toEqual([]);
});

// A caller may run a check with a saved key it is not allowed to read, and
// endpoints echo request headers in errors, completions and lists.
describe('secrets echoed by the endpoint', () => {
  const key = 'sk-echoed-key';
  const tenant = 'tenant\tsecret';
  const connection = (url: string): CustomProviderConnection => ({
    url,
    apiKey: key,
    headers: [
      { name: 'X-Tenant', value: tenant },
      { name: 'X-Org', value: 'org-plain', secret: false },
    ],
  });
  const echo = (request: ReceivedRequest) =>
    `${request.headers.authorization} ${request.headers['x-tenant']} ${request.headers['x-org']}`;

  it.each<[string, Respond, (url: string) => Promise<unknown>]>([
    [
      'an error page, entity-encoded',
      (request, res) =>
        text(401, `<html><title>${echo(request).replace('\t', '&#9;')}</title></html>`, 'text/html')(request, res),
      url => listCustomProviderModels(connection(url)),
    ],
    [
      'a model id',
      (request, res) => json(200, { data: [{ id: 'model-x' }, { id: `echo-${echo(request)}` }] })(request, res),
      url => listCustomProviderModels(connection(url)),
    ],
    ['a reply', (request, res) => chatStream(echo(request))(request, res), url => testModel(connection(url))],
    [
      'a chat error',
      (request, res) => json(401, { error: { message: `bad token ${echo(request)}` } })(request, res),
      url => testModel(connection(url)),
    ],
  ])('keeps the key and secret header values out of %s', async (_, respond, check) => {
    const endpoint = await startEndpoint(respond);

    const shown = JSON.stringify(await check(endpoint.url));

    expect(shown).not.toContain('sk-echoed');
    expect(shown).not.toMatch(/tenant(\\t| )secret/);
    // Plain header values are not secret, so a working redaction keeps them.
    expect(shown).toMatch(/org-plain|model-x/);
  });
});

describe('sending a test message to a custom endpoint model', () => {
  it('returns the reply from the chat completions route', async () => {
    const endpoint = await startEndpoint(chatStream('Yes'));

    const result = await testModel({ url: endpoint.url });

    expect(result).toMatchObject({ ok: true, reply: 'Yes', finishReason: 'stop' });
    expect(endpoint.requests.map(request => `${request.method} ${request.path}`)).toEqual([
      'POST /v1/chat/completions',
    ]);
  });

  it('reports a 503 at once and asks only once', async () => {
    const endpoint = await startEndpoint(json(503, { error: { message: 'Model is loading' } }));

    const result = await testModel({ url: endpoint.url });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'http', status: 503, detail: 'Model is loading' } });
    expect(endpoint.requests).toHaveLength(1);
  });

  it('reports an answer that is not an OpenAI-compatible stream', async () => {
    const endpoint = await startEndpoint(text(200, 'data: not json\n\n', 'text/event-stream'));

    const result = await testModel({ url: endpoint.url });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } });
  });

  // Deltas without reply text never reach the reply budget, so only the byte cap stops them.
  it('stops reading an endless stream without text and closes the connection', async () => {
    const endpoint = await startEndpoint((_, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const pump = () => {
        if (res.destroyed) return;
        res.write(chunk({ reasoning_content: 'r'.repeat(1000) }));
        setImmediate(pump);
      };
      pump();
    });

    const result = await testModel({ url: endpoint.url });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } });
    await endpoint.closed;
  }, 5000);
});

describe('the auth header of a custom endpoint chat call', () => {
  it.each([
    ['bearer', 'authorization', 'Bearer real-key'],
    ['x-api-key', 'x-api-key', 'real-key'],
  ] as const)('cannot be replaced with the %s scheme', async (authScheme, header, expected) => {
    const endpoint = await startEndpoint(
      json(200, {
        id: 'c',
        object: 'chat.completion',
        created: 0,
        model: 'model-x',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      }),
    );
    const model = createCustomProviderChatModel({
      providerId: 'acme',
      connection: {
        url: endpoint.url,
        apiKey: 'real-key',
        authScheme,
        headers: [
          { name: header.toUpperCase(), value: 'stolen' },
          { name: 'X-Thread-Id', value: 'custom-thread' },
        ],
      },
      modelId: 'model-x',
      requestHeaders: { [header]: 'from-request', 'x-thread-id': 'mastra-thread' },
    });

    await model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] });

    expect(endpoint.requests[0]!.headers[header]).toBe(expected);
    // A custom header may replace a Mastra request header, just never the auth header.
    expect(endpoint.requests[0]!.headers['x-thread-id']).toBe('custom-thread');
  });
});
