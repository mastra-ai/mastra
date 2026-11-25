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
  body: string;
}

interface Endpoint {
  /** Base URL to save on a custom provider. */
  url: string;
  origin: string;
  requests: ReceivedRequest[];
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
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const request = { method: req.method ?? '', path: req.url ?? '', headers: req.headers, body };
      requests.push(request);
      respond(request, res);
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const endpoint: Endpoint = {
    url: `${origin}/v1`,
    origin,
    requests,
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
function json(status: number, body: unknown, headers: Record<string, string> = {}): Respond {
  return (_, res) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
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

/** A streamed chat completion that says `content` and stops. */
function chatStream(content: string): Respond {
  const chunk = (delta: unknown, finishReason: string | null) =>
    `data: ${JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'model-x',
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`;
  return (_, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(`${chunk({ role: 'assistant', content }, null)}${chunk({}, 'stop')}data: [DONE]\n\n`);
  };
}

describe('listing the models of a custom endpoint', () => {
  it.each([
    ['OpenAI', { object: 'list', data: [{ id: 'b-model' }, { id: ' a-model ' }, { id: 'b-model' }] }],
    ['a models list with ids', { models: [{ id: 'b-model' }, { id: 'a-model' }] }],
    ['Ollama', { models: [{ name: 'b-model' }, { name: 'a-model' }] }],
    ['a plain array of ids', ['b-model', 'a-model']],
    ['a plain array of objects', [{ id: 'b-model' }, { id: 'a-model' }]],
  ])('reads the %s list shape', async (_, body) => {
    const endpoint = await startEndpoint(json(200, body));

    const result = await listCustomProviderModels({ url: `${endpoint.url}/` });

    expect(result).toMatchObject({ ok: true, models: ['a-model', 'b-model'] });
    expect(endpoint.requests.map(request => `${request.method} ${request.path}`)).toEqual(['GET /v1/models']);
  });

  it('reports a 200 that is not a model list', async () => {
    const endpoint = await startEndpoint(
      text(200, '<html><title>Welcome</title><p>Router admin</p></html>', 'text/html'),
    );

    const result = await listCustomProviderModels({ url: endpoint.url });

    expect(result).toMatchObject({
      ok: false,
      failure: { kind: 'invalid_response', message: `The response from ${endpoint.url}/models is not a model list` },
    });
  });

  it('sends the key in x-api-key and no Authorization header with the x-api-key scheme', async () => {
    const endpoint = await startEndpoint(json(200, { data: [] }));

    await listCustomProviderModels({ url: endpoint.url, apiKey: 'gw-key', authScheme: 'x-api-key' });

    expect(endpoint.requests[0]!.headers['x-api-key']).toBe('gw-key');
    expect(endpoint.requests[0]!.headers.authorization).toBeUndefined();
  });

  it('sends the custom headers, with the auth header winning over a custom one of the same name', async () => {
    const endpoint = await startEndpoint(json(200, { data: [] }));

    await listCustomProviderModels({
      url: endpoint.url,
      apiKey: 'real-key',
      headers: [
        { name: 'X-Org-Id', value: 'org-1', secret: false },
        { name: 'User-Agent', value: 'acme/1.0' },
        { name: 'authorization', value: 'Bearer stolen' },
      ],
    });

    expect(endpoint.requests[0]!.headers).toMatchObject({
      'x-org-id': 'org-1',
      'user-agent': 'acme/1.0',
      authorization: 'Bearer real-key',
    });
  });

  it('shows the status and the page title and text of a 403 HTML page', async () => {
    const page = `<!DOCTYPE html><html><head><title>403 Forbidden</title><style>body{color:red}</style></head>
      <body><h1>Access denied</h1>
      <p>Your IP is not on the allow list &amp; was blocked.</p><script>track()</script></body></html>`;
    const endpoint = await startEndpoint(text(403, page, 'text/html; charset=utf-8'));

    const result = await listCustomProviderModels({ url: endpoint.url });

    expect(result).toMatchObject({
      ok: false,
      failure: {
        kind: 'http',
        status: 403,
        message: `HTTP 403 Forbidden from ${endpoint.url}/models`,
        detail: '403 Forbidden: Access denied Your IP is not on the allow list & was blocked.',
      },
    });
  });

  // The page is parsed synchronously, where the timeout cannot stop it.
  it.each([
    ['script tags', '<script'.repeat(150_000)],
    ['comments', '<!--'.repeat(250_000)],
    ['title tags', '<title>'.repeat(150_000)],
  ])(
    'reads a 1 MB error page of unclosed %s',
    async (_, page) => {
      const endpoint = await startEndpoint(text(500, `<html><h1>Broken</h1>${page}`, 'text/html'));

      const result = await listCustomProviderModels({ url: endpoint.url });

      expect(result).toMatchObject({ ok: false, failure: { kind: 'http', status: 500, detail: 'Broken' } });
    },
    3000,
  );

  // The TUI prints `detail`, so an endpoint must not reach the terminal with escape sequences.
  it.each([
    ['decoded from entities', '<html><title>Denied&#0;&#27;[2J</title></html>', 'text/html', 'Denied [2J'],
    [
      'sent raw',
      'Denied\u001b]52;c;cGF5bG9hZA==\u0007 and \u001b[2J cleared',
      'text/plain',
      'Denied ]52;c;cGF5bG9hZA== and [2J cleared',
    ],
  ])('shows no control characters %s', async (_, body, contentType, detail) => {
    const endpoint = await startEndpoint(text(403, body, contentType));

    const result = await listCustomProviderModels({ url: endpoint.url });

    expect(result).toMatchObject({ ok: false, failure: { status: 403, detail } });
  });

  // Replacing a value this short would mangle ordinary text, so the excerpt is dropped instead.
  it('drops the detail when it contains a secret too short to redact, and keeps the status', async () => {
    const endpoint = await startEndpoint(json(401, { error: { message: 'Unknown tenant pin 7q9' } }));

    const result = await listCustomProviderModels({
      url: endpoint.url,
      headers: [{ name: 'X-Tenant-Pin', value: '7q9', secret: true }],
    });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'http', status: 401 } });
    expect(result.ok ? 'ok' : result.failure.detail).toBeUndefined();
  });

  // JSON escapes and HTML entities spell the tab out, so only the decoded text shows the secret.
  it.each([
    ['a JSON error', json(401, { error: { message: 'bad token tenant\ttoken-1' } })],
    ['an HTML page', text(401, '<html><title>bad token tenant&#9;token-1</title></html>', 'text/html')],
  ])('redacts a secret with a tab that %s spells out', async (_, respond) => {
    const endpoint = await startEndpoint(respond);

    const result = await listCustomProviderModels({
      url: endpoint.url,
      headers: [{ name: 'X-Tenant', value: 'tenant\ttoken-1', secret: true }],
    });

    expect(result).toMatchObject({ ok: false, failure: { status: 401, detail: 'bad token [redacted]' } });
  });

  // The body is cut and its whitespace collapsed before the final redaction.
  it('redacts a key that sits across the read limit or is echoed with its spacing collapsed', async () => {
    const key = 'sk-SUPERSECRETVALUE1234';
    const spacedHeader = 'tenant  two-space secret';
    const endpoint = await startEndpoint((request, res) => {
      res.writeHead(400, { 'content-type': 'application/json' });
      const message =
        request.headers['x-probe'] === 'far' ? `a${' '.repeat(32_760)}${key}` : `bad ${request.headers['x-tenant']}`;
      res.end(JSON.stringify({ error: { message } }));
    });

    const far = await listCustomProviderModels({
      url: endpoint.url,
      apiKey: key,
      headers: [{ name: 'X-Probe', value: 'far', secret: false }],
    });
    const spaced = await listCustomProviderModels({
      url: endpoint.url,
      headers: [{ name: 'X-Tenant', value: spacedHeader, secret: true }],
    });

    // The read limit may cut the marker itself, never the key.
    expect(far.ok ? '' : far.failure.detail).toMatch(/^a \[redact/);
    expect(far.ok ? '' : far.failure.detail).not.toContain('sk-');
    expect(spaced).toMatchObject({ ok: false, failure: { detail: 'bad [redacted]' } });
  });

  it('keeps numeric entities outside Unicode as written', async () => {
    const endpoint = await startEndpoint(
      text(403, '<html><title>&#9999999999; &#x110000; &#65;</title></html>', 'text/html'),
    );

    const result = await listCustomProviderModels({ url: endpoint.url });

    expect(result).toMatchObject({
      ok: false,
      failure: { kind: 'http', status: 403, detail: '&#9999999999; &#x110000; A' },
    });
  });

  it('shows the error message of a JSON error body', async () => {
    const endpoint = await startEndpoint(
      json(401, { error: { message: 'Incorrect API key provided.', type: 'invalid_request_error' } }),
    );

    const result = await listCustomProviderModels({ url: endpoint.url, apiKey: 'wrong' });

    expect(result).toMatchObject({
      ok: false,
      failure: { kind: 'http', status: 401, detail: 'Incorrect API key provided.' },
    });
  });

  it('redacts the key and secret header values the endpoint echoes back, and keeps plain values', async () => {
    const endpoint = await startEndpoint((request, res) => {
      res.writeHead(400, { 'content-type': 'text/plain' });
      res.end(`Rejected headers: ${JSON.stringify(request.headers)}`);
    });

    const result = await listCustomProviderModels({
      url: endpoint.url,
      apiKey: 'sk-live-key',
      headers: [
        { name: 'X-Tenant-Token', value: 'tenant-secret', secret: true },
        { name: 'X-Saved-Token', value: 'saved-secret' },
        { name: 'X-Org-Id', value: 'org-plain', secret: false },
      ],
    });

    expect(result.ok).toBe(false);
    const detail = result.ok ? '' : (result.failure.detail ?? '');
    expect(detail).toContain('org-plain');
    expect(detail).toContain('[redacted]');
    for (const secret of ['sk-live-key', 'tenant-secret', 'saved-secret']) expect(detail).not.toContain(secret);
  });

  it('keeps only a JSON error message with summaryDetailOnly', async () => {
    const plain = await startEndpoint(text(500, 'stack trace from the internal host 10.0.0.5', 'text/plain'));
    const jsonError = await startEndpoint(json(500, { error: 'model server is down' }));

    const plainResult = await listCustomProviderModels({ url: plain.url }, { summaryDetailOnly: true });
    const jsonResult = await listCustomProviderModels({ url: jsonError.url }, { summaryDetailOnly: true });

    expect(plainResult).toMatchObject({ ok: false, failure: { kind: 'http', status: 500 } });
    expect(plainResult.ok ? undefined : plainResult.failure.detail).toBeUndefined();
    expect(jsonResult).toMatchObject({ ok: false, failure: { status: 500, detail: 'model server is down' } });
  });

  // The server makes this call too: a redirect could send it somewhere the
  // saved URL was never allowed to point, such as a cloud metadata address.
  it('refuses a redirect and does not call its target', async () => {
    const target = await startEndpoint(json(200, { data: [{ id: 'model-x' }] }));
    const endpoint = await startEndpoint((request, res) => {
      res.writeHead(307, { location: `${target.origin}${request.path}` });
      res.end();
    });

    const result = await listCustomProviderModels({ url: endpoint.url, apiKey: 'acme-secret' });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'redirect' } });
    expect(endpoint.requests).toHaveLength(1);
    expect(target.requests).toEqual([]);
  });

  it('times out on an endpoint that never answers', async () => {
    const endpoint = await startEndpoint(() => {});

    const result = await listCustomProviderModels({ url: endpoint.url }, { timeoutMs: 200 });

    expect(result).toMatchObject({
      ok: false,
      failure: { kind: 'timeout', message: `No answer from ${endpoint.url}/models within 0.2 s` },
    });
  });

  it.each([-1, 0, 2500.5, Number.NaN, 2 ** 40])('still answers with a timeoutMs of %s', async timeoutMs => {
    const endpoint = await startEndpoint(json(200, { data: [{ id: 'model-x' }] }));

    const list = await listCustomProviderModels({ url: endpoint.url }, { timeoutMs });
    const reply = await testCustomProviderModel(
      { providerId: 'acme', connection: { url: endpoint.url }, modelId: 'model-x' },
      { timeoutMs },
    );

    expect(list).toMatchObject({ ok: true, models: ['model-x'] });
    // The endpoint answers chat calls with a model list, so the test message fails, as a result and not a throw.
    expect(reply).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } });
  });

  it.each([
    ['stalls', () => {}],
    ['drops the connection', (res: ServerResponse) => setTimeout(() => res.socket?.destroy(), 20)],
  ])('keeps the 403 status when the error body %s', async (_, afterHeaders) => {
    const endpoint = await startEndpoint((_, res) => {
      res.writeHead(403, { 'content-type': 'text/plain', 'content-length': '1000' });
      res.write('Forbid');
      afterHeaders(res);
    });

    const result = await listCustomProviderModels({ url: endpoint.url }, { timeoutMs: 300 });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'http', status: 403 } });
  });

  it('reports a refused connection as a network failure', async () => {
    const closed = await startEndpoint(() => {});
    await closed.close();

    const result = await listCustomProviderModels({ url: closed.url });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'network' } });
    expect(result.ok ? '' : result.failure.message).toMatch(
      new RegExp(`^Could not reach ${closed.url}/models: .*ECONNREFUSED`),
    );
  });
});

describe('sending a test message to a custom endpoint model', () => {
  /** Run the model test against `model-x` on `connection` with default options. */
  const testModel = (connection: CustomProviderConnection) =>
    testCustomProviderModel({ providerId: 'acme', connection, modelId: 'model-x' });

  it('returns the reply, sending the custom headers and the x-api-key scheme', async () => {
    const endpoint = await startEndpoint(chatStream('Yes'));

    const result = await testModel({
      url: endpoint.url,
      apiKey: 'gw-key',
      authScheme: 'x-api-key',
      headers: [{ name: 'X-Org-Id', value: 'org-1' }],
    });

    expect(result).toMatchObject({ ok: true, reply: 'Yes', finishReason: 'stop' });
    const [request] = endpoint.requests;
    expect(`${request!.method} ${request!.path}`).toBe('POST /v1/chat/completions');
    expect(request!.headers).toMatchObject({ 'x-api-key': 'gw-key', 'x-org-id': 'org-1' });
    expect(request!.headers.authorization).toBeUndefined();
    expect(JSON.parse(request!.body)).toMatchObject({ model: 'model-x', stream: true });
  });

  it('passes when the model answers with no text', async () => {
    const endpoint = await startEndpoint(chatStream(''));

    const result = await testModel({ url: endpoint.url });

    expect(result).toMatchObject({ ok: true, reply: '', finishReason: 'stop' });
  });

  it('reports a 503 at once and asks only once', async () => {
    const endpoint = await startEndpoint(json(503, { error: { message: 'Model is loading' } }));

    const result = await testModel({ url: endpoint.url });

    expect(result).toMatchObject({
      ok: false,
      failure: {
        kind: 'http',
        status: 503,
        message: `HTTP 503 Service Unavailable from ${endpoint.url}/chat/completions`,
        detail: 'Model is loading',
      },
    });
    expect(endpoint.requests).toHaveLength(1);
  });

  it('does not wait out a 429 retry-after and asks only once', async () => {
    const endpoint = await startEndpoint(json(429, { error: { message: 'Rate limited' } }, { 'retry-after': '1' }));

    const result = await testModel({ url: endpoint.url });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'http', status: 429, detail: 'Rate limited' } });
    expect(endpoint.requests).toHaveLength(1);
  });

  it('redacts a secret header value the endpoint echoes in its error', async () => {
    const endpoint = await startEndpoint((request, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Unknown token ${request.headers['x-tenant-token']}` } }));
    });

    const result = await testModel({
      url: endpoint.url,
      headers: [{ name: 'X-Tenant-Token', value: 'tenant-secret', secret: true }],
    });

    expect(result).toMatchObject({ ok: false, failure: { status: 401, detail: 'Unknown token [redacted]' } });
  });

  it('keeps the text of a stream that is not OpenAI-compatible out of the message', async () => {
    const garbage = `RAWBODYTEXT ${'x'.repeat(3000)}`;
    const endpoint = await startEndpoint(text(200, `data: ${garbage}\n\n`, 'text/event-stream'));

    const full = await testModel({ url: endpoint.url });
    const summary = await testCustomProviderModel(
      { providerId: 'acme', connection: { url: endpoint.url }, modelId: 'model-x' },
      { summaryDetailOnly: true },
    );

    const message = `The answer from ${endpoint.url}/chat/completions is not an OpenAI-compatible stream`;
    expect(full).toMatchObject({ ok: false, failure: { kind: 'invalid_response', message } });
    expect(full.ok ? '' : full.failure.detail).toMatch(/^RAWBODYTEXT x+$/);
    expect(full.ok ? '' : full.failure.detail).toHaveLength(1000);
    expect(summary).toEqual({
      ok: false,
      failure: { kind: 'invalid_response', message },
      latencyMs: expect.any(Number),
    });
  });

  it.each([
    ['an error object', { error: { message: 'quota exceeded', type: 'insufficient_quota' } }],
    ['a plain string error', { error: 'quota exceeded' }],
  ])('shows the message of an error chunk with %s, also with summaryDetailOnly', async (_, chunk) => {
    const endpoint = await startEndpoint(text(200, `data: ${JSON.stringify(chunk)}\n\n`, 'text/event-stream'));

    const result = await testCustomProviderModel(
      { providerId: 'acme', connection: { url: endpoint.url }, modelId: 'model-x' },
      { summaryDetailOnly: true },
    );

    expect(result).toMatchObject({
      ok: false,
      failure: {
        kind: 'invalid_response',
        message: `The answer from ${endpoint.url}/chat/completions is not an OpenAI-compatible stream`,
        detail: 'quota exceeded',
      },
    });
  });

  it('refuses a redirect', async () => {
    const target = await startEndpoint(chatStream('Yes'));
    const endpoint = await startEndpoint((request, res) => {
      res.writeHead(307, { location: `${target.origin}${request.path}` });
      res.end();
    });

    const result = await testModel({ url: endpoint.url });

    expect(result).toMatchObject({ ok: false, failure: { kind: 'redirect' } });
    expect(target.requests).toEqual([]);
  });
});

describe('the headers of a custom endpoint chat call', () => {
  /** Make one chat call the way a session does and return the headers the endpoint received. */
  async function sendWith(
    connection: Omit<CustomProviderConnection, 'url'>,
    requestHeaders: Record<string, string>,
  ): Promise<IncomingHttpHeaders> {
    const endpoint = await startEndpoint(
      json(200, {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 0,
        model: 'model-x',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      }),
    );
    const model = createCustomProviderChatModel({
      providerId: 'acme',
      connection: { url: endpoint.url, ...connection },
      modelId: 'model-x',
      requestHeaders,
    });
    await model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] });
    return endpoint.requests[0]!.headers;
  }

  it('lets a custom header replace the Mastra thread header', async () => {
    const headers = await sendWith(
      { headers: [{ name: 'X-Thread-Id', value: 'custom-thread' }] },
      {
        'x-thread-id': 'mastra-thread',
        'x-resource-id': 'mastra-resource',
      },
    );

    expect(headers['x-thread-id']).toBe('custom-thread');
    expect(headers['x-resource-id']).toBe('mastra-resource');
  });

  it('never lets a custom header replace the auth header', async () => {
    const headers = await sendWith(
      { apiKey: 'real-key', headers: [{ name: 'Authorization', value: 'Bearer stolen' }] },
      { authorization: 'Bearer from-request' },
    );

    expect(headers.authorization).toBe('Bearer real-key');
  });
});
