import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent/index.js';
import { RequestContext } from '../../request-context';

type ReceivedRequest = {
  path: string | undefined;
  headers: IncomingHttpHeaders;
  body: { model: string; stream?: boolean; messages: Array<{ role: string; content: string }> };
};

// Keep the router and native OpenRouter adapter real. Forward only the paid API
// boundary to a socket server so these assertions cover the serialized request.
describe.each(['generate', 'stream'] as const)('OpenRouter %s requests', method => {
  let server: Server;
  let received: ReceivedRequest[];
  let destinations: string[];

  beforeEach(async () => {
    received = [];
    destinations = [];
    vi.stubEnv('OPENROUTER_API_KEY', 'environment-key');
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body: ReceivedRequest['body'] = JSON.parse(Buffer.concat(chunks).toString());
      received.push({ path: request.url, headers: request.headers, body });
      const metadata = { id: 'reply', created: 1, model: body.model };
      if (body.stream) {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.end(
          [
            {
              ...metadata,
              choices: [
                { index: 0, delta: { role: 'assistant', content: 'Hello from OpenRouter!' }, finish_reason: null },
              ],
            },
            { ...metadata, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
          ]
            .map(chunk => `data: ${JSON.stringify(chunk)}\n\n`)
            .join('') + 'data: [DONE]\n\n',
        );
      } else {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            ...metadata,
            choices: [
              { index: 0, message: { role: 'assistant', content: 'Hello from OpenRouter!' }, finish_reason: 'stop' },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        );
      }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('HTTP fixture did not bind a port');
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const request = new Request(input, init);
      const destination = new URL(request.url);
      if (destination.origin !== 'https://openrouter.ai') {
        throw new Error(`Unexpected provider URL: ${destination.origin}`);
      }
      destinations.push(request.url);
      return realFetch(new Request(`http://127.0.0.1:${address.port}${destination.pathname}`, request));
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    server?.closeAllConnections();
    if (server)
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  async function ask(agent: Agent, requestContext?: RequestContext) {
    const result =
      method === 'generate'
        ? await agent.generate('test', { maxSteps: 1, requestContext })
        : await (await agent.stream('test', { maxSteps: 1, requestContext })).getFullOutput();
    expect(result.text).toBe('Hello from OpenRouter!');
    expect(result.finishReason).toBe('stop');
  }

  const cases = [
    {
      name: 'a routed model ID carries attribution and custom headers',
      model: {
        id: 'openrouter/anthropic/claude-3-5-sonnet-20241022' as const,
        headers: {
          'HTTP-Referer': 'https://my-service.example/',
          'X-Title': 'My application',
          'X-Custom-Header': 'custom-value',
          'X-User-ID': 'user-123',
        },
      },
      expectedModel: 'anthropic/claude-3-5-sonnet-20241022',
      expectedHeaders: {
        'http-referer': 'https://my-service.example/',
        'x-title': 'My application',
        'x-custom-header': 'custom-value',
        'x-user-id': 'user-123',
      },
    },
    {
      name: 'providerId/modelId configuration preserves the provider model name',
      model: {
        providerId: 'openrouter/openai',
        modelId: 'gpt-4o',
        headers: { 'HTTP-Referer': 'https://myapp.example/', 'X-Title': 'MyApp' },
      },
      expectedModel: 'openai/gpt-4o',
      expectedHeaders: { 'http-referer': 'https://myapp.example/', 'x-title': 'MyApp' },
    },
    {
      name: 'a model string works without application headers',
      model: 'openrouter/anthropic/claude-3-5-sonnet-20241022' as const,
      expectedModel: 'anthropic/claude-3-5-sonnet-20241022',
      expectedHeaders: {},
    },
    {
      name: 'an explicit API key overrides the environment key',
      model: {
        id: 'openrouter/meta-llama/llama-3.1-8b-instruct' as const,
        apiKey: 'custom-key',
        headers: { 'X-Title': 'Custom key app' },
      },
      expectedModel: 'meta-llama/llama-3.1-8b-instruct',
      expectedHeaders: { 'x-title': 'Custom key app', authorization: 'Bearer custom-key' },
    },
  ];

  it.each(cases)('$name', async ({ model, expectedModel, expectedHeaders }) => {
    const agent = new Agent({
      id: 'openrouter-headers',
      name: 'OpenRouter headers',
      instructions: 'Be helpful.',
      model,
    });
    await ask(agent);

    expect(destinations).toEqual(['https://openrouter.ai/api/v1/chat/completions']);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      path: '/api/v1/chat/completions',
      headers: {
        authorization: 'Bearer environment-key',
        'user-agent': expect.stringMatching(/^mastra/),
        ...expectedHeaders,
      },
      body: { model: expectedModel, messages: expect.arrayContaining([{ role: 'user', content: 'test' }]) },
    });
    if (typeof model === 'string') {
      expect(received[0]!.headers).not.toHaveProperty('http-referer');
      expect(received[0]!.headers).not.toHaveProperty('x-title');
    }
  });

  it('uses an explicit key with attribution when no environment key is set', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const agent = new Agent({
      id: 'custom-key-only',
      name: 'Custom key only',
      instructions: 'Be helpful.',
      model: {
        id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
        apiKey: 'no-env-key',
        headers: { 'HTTP-Referer': 'https://custom.example/', 'X-Title': 'Custom application' },
      },
    });
    await ask(agent);
    expect(received).toHaveLength(1);
    expect(received[0]!.headers).toMatchObject({
      authorization: 'Bearer no-env-key',
      'http-referer': 'https://custom.example/',
      'x-title': 'Custom application',
    });
  });

  it('keeps caller credentials and headers separate across repeated cached requests', async () => {
    const createAgent = (id: string, apiKey: string, title: string) =>
      new Agent({
        id,
        name: id,
        instructions: 'Be helpful.',
        model: { id: 'openrouter/anthropic/claude-3-5-sonnet-20241022', apiKey, headers: { 'X-Title': title } },
      });
    const first = createAgent('first', 'first-key', 'First application');
    const same = createAgent('same-configuration', 'first-key', 'First application');
    const otherHeaders = createAgent('other-headers', 'first-key', 'Second application');
    const otherKey = createAgent('other-key', 'second-key', 'First application');
    for (const agent of [first, same, otherHeaders, otherKey, first]) await ask(agent);
    expect(received.map(({ headers }) => [headers.authorization, headers['x-title']])).toEqual([
      ['Bearer first-key', 'First application'],
      ['Bearer first-key', 'First application'],
      ['Bearer first-key', 'Second application'],
      ['Bearer second-key', 'First application'],
      ['Bearer first-key', 'First application'],
    ]);
  });

  it('resolves dynamic headers for each caller rather than reusing another caller’s configuration', async () => {
    const agent = new Agent({
      id: 'dynamic-headers',
      name: 'Dynamic headers',
      instructions: 'Be helpful.',
      model: ({ requestContext }) => ({
        id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
        headers: { 'X-Title': String(requestContext.get('application')) },
      }),
    });
    for (const application of ['First application', 'Second application', 'First application']) {
      const requestContext = new RequestContext();
      requestContext.set('application', application);
      await ask(agent, requestContext);
    }
    expect(received.map(({ headers }) => headers['x-title'])).toEqual([
      'First application',
      'Second application',
      'First application',
    ]);
  });
});
