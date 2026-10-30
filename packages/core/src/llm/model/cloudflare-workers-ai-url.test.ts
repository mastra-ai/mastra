import { LLMock } from '@copilotkit/aimock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent/index.js';

const MODEL_ID = '@cf/meta/llama-3.1-8b-instruct';

describe('Cloudflare Workers AI URL interpolation', () => {
  let mock: LLMock;
  let destinations: string[];
  let requestNumber = 0;

  beforeEach(async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'account-123');
    const apiKey = `workers-ai-test-token-${++requestNumber}`;
    vi.stubEnv('CLOUDFLARE_API_KEY', apiKey);
    vi.stubEnv('CLOUDFLARE_WORKERS_AI_BASE_URL', '');
    destinations = [];
    // Enforce the key at the HTTP boundary; the journal intentionally redacts it.
    mock = new LLMock({ port: 0, auth: { apiKeys: [apiKey] } });
    mock.on({ endpoint: 'chat' }, { content: 'Hello from Workers AI.' });
    await mock.start();

    // Replace only the paid endpoint. The native provider still serializes the
    // request, sends it over HTTP and decodes the real JSON/SSE response.
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const request = new Request(input, init);
      const destination = new URL(request.url);
      if (destination.origin !== 'https://api.cloudflare.com' && destination.origin !== mock.url) {
        throw new Error(`Unexpected provider destination: ${destination.origin}`);
      }
      destinations.push(request.url);
      return realFetch(new Request(`${mock.url}/v1/chat/completions`, request));
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await mock?.stop();
  });

  describe.each(['generate', 'stream'] as const)('%s', method => {
    it.each(['account URL', 'custom base URL'] as const)(
      'authenticates at the %s and returns the model response',
      async route => {
        const baseURL =
          route === 'account URL'
            ? 'https://api.cloudflare.com/client/v4/accounts/account-123/ai/v1'
            : `${mock.url}/workers-proxy/v1`;
        if (route === 'custom base URL') {
          // A configured proxy must also work without a Cloudflare account ID.
          vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', undefined);
          vi.stubEnv('CLOUDFLARE_WORKERS_AI_BASE_URL', baseURL);
        }
        const agent = new Agent({
          id: 'cf-worker-agent',
          name: 'CF Worker Agent',
          instructions: 'Be brief.',
          model: `cloudflare-workers-ai/${MODEL_ID}`,
        });

        const result =
          method === 'generate' ? await agent.generate('hello') : await (await agent.stream('hello')).getFullOutput();

        expect(result.text).toBe('Hello from Workers AI.');
        expect(result.finishReason).toBe('stop');
        expect(destinations).toEqual([`${baseURL}/chat/completions`]);
        const requests = mock.getRequests();
        expect(requests).toHaveLength(1);
        expect(requests[0]).toMatchObject({
          method: 'POST',
          headers: {
            'user-agent': expect.stringMatching(/^mastra/),
            'content-type': 'application/json',
          },
          body: {
            model: MODEL_ID,
            messages: expect.arrayContaining([{ role: 'user', content: 'hello' }]),
            ...(method === 'stream' ? { stream: true } : {}),
          },
        });
      },
    );
  });
});
