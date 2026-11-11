import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ModelRouterEmbeddingModel } from './embedding-router.js';

describe('registry embedding provider URLs', () => {
  let server: Server;
  let url: string;
  const requests: { path: string; authorization: string | undefined; body: unknown }[] = [];
  const previousUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
  const previousToken = process.env.NEON_AI_GATEWAY_TOKEN;

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      requests.push({ path: request.url ?? '', authorization: request.headers.authorization, body: JSON.parse(body) });
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
      );
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.NEON_AI_GATEWAY_BASE_URL;
    else process.env.NEON_AI_GATEWAY_BASE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.NEON_AI_GATEWAY_TOKEN;
    else process.env.NEON_AI_GATEWAY_TOKEN = previousToken;
    requests.length = 0;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
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
