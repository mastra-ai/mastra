import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ModelRouterEmbeddingModel } from './embedding-router.js';

const EMBEDDING_RESPONSE = {
  data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
  usage: { prompt_tokens: 1, total_tokens: 1 },
};

let server: Server;
let url: string;
const requests: { path: string; authorization: string | undefined; body: unknown }[] = [];

beforeAll(async () => {
  server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ path: request.url ?? '', authorization: request.headers.authorization, body: JSON.parse(body) });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(EMBEDDING_RESPONSE));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  requests.length = 0;
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe('registry embedding provider URLs', () => {
  const previousUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
  const previousToken = process.env.NEON_AI_GATEWAY_TOKEN;

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.NEON_AI_GATEWAY_BASE_URL;
    else process.env.NEON_AI_GATEWAY_BASE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.NEON_AI_GATEWAY_TOKEN;
    else process.env.NEON_AI_GATEWAY_TOKEN = previousToken;
  });

  it('embeds through a registry URL resolved from the environment (#29629)', async () => {
    process.env.NEON_AI_GATEWAY_BASE_URL = url;
    process.env.NEON_AI_GATEWAY_TOKEN = 'test-token';

    const model = new ModelRouterEmbeddingModel('neon/qwen3-embedding-0-6b');
    const result = await model.doEmbed({ values: ['hello'] });

    expect(result.embeddings).toEqual([[0.1, 0.2]]);
    expect(requests).toEqual([
      {
        path: '/v1/embeddings',
        authorization: 'Bearer test-token',
        body: { model: 'qwen3-embedding-0-6b', input: ['hello'], encoding_format: 'float' },
      },
    ]);
  });

  it('reports the missing URL variable rather than calling an invalid URL (#29629)', () => {
    delete process.env.NEON_AI_GATEWAY_BASE_URL;
    process.env.NEON_AI_GATEWAY_TOKEN = 'test-token';

    expect(() => new ModelRouterEmbeddingModel('neon/qwen3-embedding-0-6b')).toThrow(
      'Missing environment variable NEON_AI_GATEWAY_BASE_URL required to build provider URL',
    );
  });
});

describe('DeepInfra embedding routing (#31618)', () => {
  const DEEPINFRA_ID = 'deepinfra/Qwen/Qwen3-Embedding-8B';
  const DEEPINFRA_MODEL = 'Qwen/Qwen3-Embedding-8B';
  const DEEPINFRA_URL = 'https://api.deepinfra.com/v1/openai';

  const previousApiKey = process.env.DEEPINFRA_API_KEY;

  afterEach(() => {
    if (previousApiKey === undefined) delete process.env.DEEPINFRA_API_KEY;
    else process.env.DEEPINFRA_API_KEY = previousApiKey;
  });

  // Stubs the global fetch so no external request is possible and records the
  // outbound request shape. `vi.unstubAllGlobals` in the file-level afterEach
  // restores it across the core unit project's `isolate: false` runs.
  function stubFetch() {
    const calls: { url: string; authorization: string | undefined; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const headers = new Headers(init?.headers);
        calls.push({
          url: requestUrl,
          authorization: headers.get('authorization') ?? undefined,
          body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
        });
        return new Response(JSON.stringify(EMBEDDING_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    return calls;
  }

  it('constructs a namespaced model and adapts the embedding response', async () => {
    process.env.DEEPINFRA_API_KEY = 'test-deepinfra-key';
    stubFetch();

    const model = new ModelRouterEmbeddingModel(DEEPINFRA_ID);

    expect(model.provider).toBe('deepinfra');
    expect(model.modelId).toBe(DEEPINFRA_MODEL);

    const result = await model.doEmbed({ values: ['hello'] });
    expect(result.embeddings).toEqual([[0.1, 0.2]]);
  });

  it('posts to the DeepInfra default endpoint with the full namespaced model id', async () => {
    process.env.DEEPINFRA_API_KEY = 'test-deepinfra-key';
    const calls = stubFetch();

    const model = new ModelRouterEmbeddingModel(DEEPINFRA_ID);
    await model.doEmbed({ values: ['hello'] });

    expect(calls).toEqual([
      {
        url: `${DEEPINFRA_URL}/embeddings`,
        authorization: 'Bearer test-deepinfra-key',
        body: { model: DEEPINFRA_MODEL, input: ['hello'], encoding_format: 'float' },
      },
    ]);
  });

  it('accepts the id-object config form without an explicit URL', async () => {
    const calls = stubFetch();

    const model = new ModelRouterEmbeddingModel({ id: DEEPINFRA_ID, apiKey: 'explicit-key' });
    expect(model.provider).toBe('deepinfra');
    expect(model.modelId).toBe(DEEPINFRA_MODEL);

    await model.doEmbed({ values: ['hello'] });
    expect(calls).toEqual([
      {
        url: `${DEEPINFRA_URL}/embeddings`,
        authorization: 'Bearer explicit-key',
        body: { model: DEEPINFRA_MODEL, input: ['hello'], encoding_format: 'float' },
      },
    ]);
  });

  it('accepts the providerId/modelId config form without an explicit URL', async () => {
    const calls = stubFetch();

    const model = new ModelRouterEmbeddingModel({
      providerId: 'deepinfra',
      modelId: DEEPINFRA_MODEL,
      apiKey: 'explicit-key',
    });
    expect(model.provider).toBe('deepinfra');
    expect(model.modelId).toBe(DEEPINFRA_MODEL);

    await model.doEmbed({ values: ['hello'] });
    expect(calls).toEqual([
      {
        url: `${DEEPINFRA_URL}/embeddings`,
        authorization: 'Bearer explicit-key',
        body: { model: DEEPINFRA_MODEL, input: ['hello'], encoding_format: 'float' },
      },
    ]);
  });

  it('lets an explicit URL win over the default DeepInfra endpoint', async () => {
    const model = new ModelRouterEmbeddingModel({ id: DEEPINFRA_ID, apiKey: 'explicit-token', url });
    await model.doEmbed({ values: ['hello'] });

    expect(requests).toEqual([
      {
        path: '/embeddings',
        authorization: 'Bearer explicit-token',
        body: { model: DEEPINFRA_MODEL, input: ['hello'], encoding_format: 'float' },
      },
    ]);
  });
});

describe('embedding model id parsing', () => {
  const previousGatewayKey = process.env.MASTRA_GATEWAY_API_KEY;

  afterEach(() => {
    if (previousGatewayKey === undefined) delete process.env.MASTRA_GATEWAY_API_KEY;
    else process.env.MASTRA_GATEWAY_API_KEY = previousGatewayKey;
  });

  it('rejects an empty string', () => {
    expect(() => new ModelRouterEmbeddingModel('')).toThrow('Invalid model string format: ""');
  });

  it('rejects a missing provider segment', () => {
    expect(() => new ModelRouterEmbeddingModel('/model')).toThrow('Invalid model string format: "/model"');
  });

  it('rejects a missing model segment', () => {
    expect(() => new ModelRouterEmbeddingModel('openai/')).toThrow('Invalid model string format: "openai/"');
  });

  it('rejects a bare provider id with no separator', () => {
    expect(() => new ModelRouterEmbeddingModel('invalid-format')).toThrow(
      'Invalid model string format: "invalid-format". Expected format: "provider/model"',
    );
  });

  it('rejects a malformed id-object config', () => {
    expect(() => new ModelRouterEmbeddingModel({ id: 'deepinfra/' })).toThrow(
      'Invalid model string format: "deepinfra/"',
    );
  });

  it('reports an unknown provider', () => {
    expect(() => new ModelRouterEmbeddingModel('unknown-provider/some-model')).toThrow(
      'Unknown provider: unknown-provider',
    );
  });

  it('parses Mastra Gateway ids with a namespaced model', () => {
    process.env.MASTRA_GATEWAY_API_KEY = 'test-gateway-key';

    const model = new ModelRouterEmbeddingModel('mastra/deepinfra/Qwen/Qwen3-Embedding-8B');
    expect(model.provider).toBe('mastra');
    expect(model.modelId).toBe('deepinfra/Qwen/Qwen3-Embedding-8B');
  });
});
