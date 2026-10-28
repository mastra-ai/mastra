import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider-v7';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MASTRA_USER_AGENT } from './constants.js';
import { ModelsDevGateway } from './models-dev.js';
import { createPerplexityGatewayModel } from './perplexity.js';

const source = {
  id: 7,
  title: 'Release notes',
  url: 'https://example.com/release',
  snippet: 'Verified source',
  source: 'web',
};
const response = {
  id: 'resp-agent',
  created_at: 1_790_000_000,
  model: 'openai/gpt-5.5',
  object: 'response',
  status: 'completed',
  output: [
    {
      type: 'message',
      id: 'message-1',
      content: [
        { type: 'output_text', text: 'Verified answer.', annotations: [{ url: source.url, title: source.title }] },
      ],
    },
    { type: 'search_results', results: [source] },
  ],
  usage: {
    input_tokens: 10,
    output_tokens: 4,
    total_tokens: 14,
    output_tokens_details: { reasoning_tokens: 2 },
    tool_calls_details: { web_search: { invocation: 1 } },
    cost: { input_cost: 0.01, output_cost: 0.02, total_cost: 0.03, currency: 'USD' },
  },
};
const prompt: LanguageModelV4CallOptions['prompt'] = [
  { role: 'user', content: [{ type: 'text', text: 'Find the release notes.' }] },
];

async function call(
  model: LanguageModelV4,
  method: 'generate' | 'stream',
  options: LanguageModelV4CallOptions = { prompt },
) {
  if (method === 'generate') {
    const result = await model.doGenerate(options);
    return {
      text: result.content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join(''),
      sources: result.content.filter(part => part.type === 'source'),
      usage: result.usage,
      finishReason: result.finishReason,
      providerMetadata: result.providerMetadata,
    };
  }
  const result = await model.doStream(options);
  const parts: LanguageModelV4StreamPart[] = [];
  for await (const part of result.stream) parts.push(part);
  expect(parts.filter(part => part.type === 'error')).toEqual([]);
  const finish = parts.find(part => part.type === 'finish');
  return {
    text: parts
      .filter(part => part.type === 'text-delta')
      .map(part => part.delta)
      .join(''),
    sources: parts.filter(part => part.type === 'source'),
    usage: finish?.usage,
    finishReason: finish?.finishReason,
    providerMetadata: finish?.providerMetadata,
  };
}

describe('Perplexity Agent API migration', () => {
  let server: Server;
  let baseURL: string;
  let requests: Array<{ path: string; body: Record<string, unknown>; headers: IncomingHttpHeaders }>;

  beforeEach(async () => {
    requests = [];
    server = createServer(async (request, reply) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      requests.push({ path: request.url!, body, headers: request.headers });
      if (body.stream) {
        reply.writeHead(200, { 'content-type': 'text/event-stream' });
        const events = [
          { type: 'response.reasoning.started', sequence_number: 1, thought: 'Checking the source.' },
          { type: 'response.reasoning.search_results', results: [source] },
          { type: 'response.reasoning.stopped' },
          { type: 'response.output_text.delta', item_id: 'message-1', delta: 'Verified answer.' },
          { type: 'response.completed', response },
        ];
        for (const event of events) reply.write(`data: ${JSON.stringify(event)}\n\n`);
        reply.end();
      } else {
        reply.writeHead(200, { 'content-type': 'application/json' });
        reply.end(JSON.stringify(response));
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/proxy`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  const model = (id = 'low') =>
    createPerplexityGatewayModel(id, {
      apiKey: 'perplexity-test-key',
      baseURL,
      headers: { 'X-Pplx-Integration': 'mastra-test', 'X-Proxy-Tenant': 'tenant-a' },
    });

  describe.each(['generate', 'stream'] as const)('%s', method => {
    it.each(['perplexity', 'perplexity-agent', 'perplexity-proxy'])(
      'routes %s through the native Agent API with the configured proxy root',
      async providerId => {
        const gateway = new ModelsDevGateway({
          [providerId]: {
            name: providerId,
            apiKeyEnvVar: 'PERPLEXITY_API_KEY',
            gateway: 'models.dev',
            models: ['openai/gpt-5.5'],
            url: baseURL,
            npm: '@ai-sdk/perplexity',
          },
        });
        const resolved = await gateway.resolveLanguageModel({
          providerId,
          modelId: 'openai/gpt-5.5',
          apiKey: 'gateway-tenant-key',
        });
        if (resolved.specificationVersion !== 'v4') throw new Error('The gateway must use an AI SDK v7 provider');
        const result = await call(resolved, method);
        expect(result.text).toBe('Verified answer.');
        expect(result.sources[0]).toMatchObject({ id: '7', url: source.url });
        expect(requests[0]!.path).toBe('/proxy/v1/agent');
        expect(requests[0]!.body).toMatchObject({ model: 'openai/gpt-5.5' });
        expect(requests[0]!.headers).toMatchObject({
          authorization: 'Bearer gateway-tenant-key',
          'x-pplx-integration': MASTRA_USER_AGENT,
        });
      },
    );

    it.each([undefined, 'X-Pplx-Integration', 'x-pplx-integration', 'X-PPLX-INTEGRATION'])(
      'preserves one integration attribution value when caller header casing is %s',
      async header => {
        await call(
          createPerplexityGatewayModel('low', {
            apiKey: 'perplexity-test-key',
            baseURL,
            headers: header ? { [header]: 'custom-integration' } : undefined,
          }),
          method,
        );
        expect(requests[0]!.headers['x-pplx-integration']).toBe(header ? 'custom-integration' : MASTRA_USER_AGENT);
      },
    );

    it.each(['fast', 'low', 'medium', 'high', 'xhigh', 'perplexity/sonar', 'openai/gpt-5.5'])(
      'sends %s to the Agent API and preserves citations, usage and proxy authentication',
      async id => {
        const result = await call(model(id), method);
        expect(result.text).toBe('Verified answer.');
        expect(result.sources).toHaveLength(1);
        expect(result.sources[0]).toMatchObject({ id: '7', url: source.url, title: source.title });
        expect(result.finishReason).toMatchObject({ unified: 'stop', raw: 'completed' });
        expect(result.usage).toMatchObject({ inputTokens: { total: 10 }, outputTokens: { total: 4, reasoning: 2 } });
        expect(result.providerMetadata).toMatchObject({
          perplexity: { usage: { numSearchQueries: 1 }, cost: { totalCost: 0.03 } },
        });
        expect(requests).toHaveLength(1);
        expect(requests[0]!.path).toBe('/proxy/v1/agent');
        expect(requests[0]!.headers).toMatchObject({
          authorization: 'Bearer perplexity-test-key',
          'x-pplx-integration': 'mastra-test',
          'x-proxy-tenant': 'tenant-a',
        });
        expect(requests[0]!.body).toMatchObject(id.includes('/') ? { model: id } : { preset: id });
      },
    );

    it('moves legacy reasoning and search settings into Agent fields while keeping explicit native options', async () => {
      const options: LanguageModelV4CallOptions = {
        prompt,
        providerOptions: {
          perplexity: {
            reasoning_effort: 'low',
            reasoning: { effort: 'high' },
            search_domain_filter: ['legacy.example'],
            search_recency_filter: 'week',
            search_after_date_filter: '10/01/2026',
            num_search_results: 5,
            web_search_options: { search_context_size: 'low', user_location: { country: 'FR' } },
            previous_response_id: 'previous-agent-response',
            tools: [
              { type: 'fetch_url', max_urls: 1 },
              {
                type: 'web_search',
                search_context_size: 'high',
                max_results: 3,
                filters: { search_domain_filter: ['native.example'] },
              },
            ],
          },
        },
      };
      const before = structuredClone(options);
      await call(model(), method, options);
      expect(options).toEqual(before);
      expect(requests[0]!.body).toMatchObject({
        preset: 'low',
        previous_response_id: 'previous-agent-response',
        reasoning: { effort: 'high' },
        tools: [
          { type: 'fetch_url', max_urls: 1 },
          {
            type: 'web_search',
            search_context_size: 'high',
            max_results: 3,
            user_location: { country: 'FR' },
            filters: {
              search_domain_filter: ['native.example'],
              search_recency_filter: 'week',
              search_after_date_filter: '10/01/2026',
            },
          },
        ],
      });
      for (const key of [
        'reasoning_effort',
        'search_domain_filter',
        'search_recency_filter',
        'search_after_date_filter',
        'num_search_results',
        'web_search_options',
      ]) {
        expect(requests[0]!.body).not.toHaveProperty(key);
      }
    });

    it('adds a web search tool when migrating legacy filters and keeps other native tools', async () => {
      await call(model('perplexity/sonar'), method, {
        prompt,
        providerOptions: {
          perplexity: {
            search_domain_filter: ['example.com'],
            reasoning_effort: 'medium',
            tools: [{ type: 'fetch_url' }],
          },
        },
      });
      expect(requests[0]!.body).toMatchObject({
        model: 'perplexity/sonar',
        reasoning: { effort: 'medium' },
        tools: [{ type: 'fetch_url' }, { type: 'web_search', filters: { search_domain_filter: ['example.com'] } }],
      });
    });

    it('disables search on an explicit direct model without disabling other native tools', async () => {
      await call(model('perplexity/sonar'), method, {
        prompt,
        providerOptions: { perplexity: { disable_search: true, tools: [{ type: 'fetch_url' }] } },
      });
      expect(requests[0]!.body).toMatchObject({ model: 'perplexity/sonar', tools: [{ type: 'fetch_url' }] });
      expect(requests[0]!.body).not.toHaveProperty('disable_search');
      expect(requests[0]!.body).not.toHaveProperty('max_tool_calls');
    });

    it('keeps the caller’s explicit decision to disable every preset tool', async () => {
      await call(model('low'), method, {
        prompt,
        providerOptions: { perplexity: { disable_search: true, max_tool_calls: 0 } },
      });
      expect(requests[0]!.body).toMatchObject({ preset: 'low', max_tool_calls: 0 });
      expect(requests[0]!.body).not.toHaveProperty('disable_search');
    });

    it('continues accepting image inputs while rejecting unsupported document formats', async () => {
      await call(model('low'), method, {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'file', mediaType: 'image/png', data: { type: 'data', data: 'iVBORw0KGgo=' } }],
          },
        ],
      });
      expect(requests[0]!.body).toMatchObject({
        input: [
          {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=' }],
          },
        ],
      });
    });

    it.each(['tool', 'assistant'] as const)(
      'preserves %s tool images, captions and function history using adjacent Agent image input',
      async role => {
        const options: LanguageModelV4CallOptions = {
          prompt: [
            ...prompt,
            {
              role: 'assistant',
              content: [{ type: 'tool-call', toolCallId: 'read-1', toolName: 'read_file', input: {} }],
            },
            {
              role,
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'read-1',
                  toolName: 'read_file',
                  providerOptions: { perplexity: { thoughtSignature: 'history-signature' } },
                  output: {
                    type: 'content',
                    value: [
                      { type: 'text', text: 'First caption.\n' },
                      {
                        type: 'file',
                        filename: 'first.png',
                        mediaType: 'image/png',
                        data: { type: 'data', data: 'iVBORw0KGgo=' },
                      },
                      { type: 'text', text: 'Second caption.' },
                      {
                        type: 'file',
                        mediaType: 'image/jpeg',
                        data: { type: 'url', url: new URL('https://example.com/second.jpg') },
                      },
                    ],
                  },
                },
              ],
            },
            { role: 'user', content: [{ type: 'text', text: 'Compare the pictures.' }] },
          ],
        };
        const original = JSON.stringify(options);
        await call(model('openai/gpt-5.5'), method, options);
        expect(JSON.stringify(options)).toBe(original);
        expect(requests[0]!.body.input).toEqual([
          { type: 'message', role: 'user', content: 'Find the release notes.' },
          { type: 'function_call', call_id: 'read-1', name: 'read_file', arguments: '{}' },
          {
            type: 'function_call_output',
            call_id: 'read-1',
            name: 'read_file',
            output: 'First caption.\nSecond caption.',
            thought_signature: 'history-signature',
          },
          {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: 'Images from tool read_file (read-1):' },
              { type: 'input_text', text: 'First caption.\n' },
              { type: 'input_text', text: 'Image: first.png' },
              { type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=' },
              { type: 'input_text', text: 'Second caption.' },
              { type: 'input_image', image_url: 'https://example.com/second.jpg' },
            ],
          },
          { type: 'message', role: 'user', content: 'Compare the pictures.' },
        ]);
      },
    );

    it.each(['application/pdf', 'video/mp4'])(
      'rejects unsupported %s in tool results before making a request',
      async mediaType => {
        await expect(
          call(model(), method, {
            prompt: [
              {
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'read_file',
                    toolCallId: 'read-1',
                    output: {
                      type: 'content',
                      value: [{ type: 'file', mediaType, data: { type: 'data', data: 'AA==' } }],
                    },
                  },
                ],
              },
            ],
          }),
        ).rejects.toThrow(/Send extracted text/);
        expect(requests).toEqual([]);
      },
    );

    it('keeps parallel function outputs together before image inputs and preserves plain JSON tools', async () => {
      await call(model('openai/gpt-5.5'), method, {
        prompt: [
          ...prompt,
          {
            role: 'assistant',
            content: [
              { type: 'tool-call', toolCallId: 'image-1', toolName: 'read_image', input: {} },
              { type: 'tool-call', toolCallId: 'info-1', toolName: 'read_info', input: {} },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'image-1',
                toolName: 'read_image',
                output: {
                  type: 'content',
                  value: [{ type: 'file', mediaType: 'image/png', data: { type: 'data', data: 'iVBORw0KGgo=' } }],
                },
              },
              {
                type: 'tool-result',
                toolCallId: 'info-1',
                toolName: 'read_info',
                output: { type: 'json', value: { width: 1 } },
              },
            ],
          },
        ],
      });
      expect(requests[0]!.body.input).toMatchObject([
        { type: 'message', role: 'user' },
        { type: 'function_call', call_id: 'image-1' },
        { type: 'function_call', call_id: 'info-1' },
        { type: 'function_call_output', call_id: 'image-1', output: '' },
        { type: 'function_call_output', call_id: 'info-1', output: '{"width":1}' },
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: 'Images from tool read_image (image-1):' },
            { type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=' },
          ],
        },
      ]);
    });

    it('reports an invalid explicit native tool list instead of replacing it during search migration', async () => {
      await expect(
        call(model('low'), method, {
          prompt,
          providerOptions: { perplexity: { tools: 'invalid', search_domain_filter: ['example.com'] } },
        }),
      ).rejects.toThrow(/Invalid legacy Perplexity options/);
      expect(requests).toEqual([]);
    });

    it('accepts disabled legacy result features without sending unsupported Agent fields', async () => {
      await call(model(), method, {
        prompt,
        providerOptions: {
          perplexity: {
            return_images: false,
            return_videos: false,
            return_related_questions: false,
            search_language_filter: [],
          },
        },
      });
      expect(requests[0]!.body).toMatchObject({ preset: 'low' });
      for (const key of ['return_images', 'return_videos', 'return_related_questions', 'search_language_filter']) {
        expect(requests[0]!.body).not.toHaveProperty(key);
      }
    });

    it.each([
      { return_images: true },
      { return_related_questions: true },
      { search_language_filter: ['en'] },
      { stream_mode: 'full' },
      { disable_search: true },
    ])('rejects unsupported Sonar settings before making a request: %j', async settings => {
      await expect(call(model(), method, { prompt, providerOptions: { perplexity: settings } })).rejects.toThrow(
        /Perplexity Agent API/,
      );
      expect(requests).toEqual([]);
    });

    it.each(['application/pdf', 'video/mp4'])(
      'rejects unsupported %s input instead of dropping the file',
      async mediaType => {
        await expect(
          call(model(), method, {
            prompt: [{ role: 'user', content: [{ type: 'file', mediaType, data: { type: 'data', data: 'AA==' } }] }],
          }),
        ).rejects.toThrow(/Send extracted text/);
        expect(requests).toEqual([]);
      },
    );
  });

  it.each(['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'])(
    'requires an explicit Agent API model choice for retired %s instead of silently changing cost or model',
    id => {
      expect(() => model(id)).toThrow(/not an equivalent alias; model, tools, cost and latency can change/);
      expect(requests).toEqual([]);
    },
  );
});
