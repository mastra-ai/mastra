import type { LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../agent/message-list';
import { ModelRouterLanguageModel } from './router';

const tools: LanguageModelV2CallOptions['tools'] = [
  { type: 'function', name: 'lookup', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
];
const usage = {
  prompt_tokens: 10,
  completion_tokens: 8,
  total_tokens: 18,
  completion_tokens_details: { reasoning_tokens: 3 },
};

async function collect(stream: ReadableStream<LanguageModelV2StreamPart>) {
  const reader = stream.getReader();
  const parts: LanguageModelV2StreamPart[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) return parts;
    parts.push(value);
  }
}

function history() {
  const list = new MessageList();
  list.addSystem('Use tools to answer the user.');
  list.add(
    [
      { role: 'user', content: 'Look it up' },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Prior thinking', providerOptions: { anthropic: { signature: 'signature' } } },
          { type: 'tool-call', toolCallId: 'call_old', toolName: 'lookup', input: { query: 'old' } },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_old',
            toolName: 'lookup',
            output: { type: 'text', value: 'Found it' },
          },
        ],
      },
      { role: 'assistant', content: 'Previous answer without reasoning' },
      { role: 'user', content: 'Continue' },
    ],
    'memory',
  );
  return list;
}

describe('DeepSeek router history compatibility', () => {
  const requests: unknown[] = [];

  beforeEach(() => {
    requests.length = 0;
    vi.stubEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        requests.push(body);
        if (!body.stream) {
          return Response.json({
            id: 'response-1',
            model: 'deepseek-flash',
            created: 0,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Answer', reasoning_content: 'New thinking' },
                finish_reason: 'stop',
              },
            ],
            usage,
          });
        }
        const deltas = [
          { reasoning_content: 'New ', tool_calls: [] },
          { reasoning_content: 'thinking', tool_calls: [] },
          {
            tool_calls: [
              { index: 0, id: 'call_new', type: 'function', function: { name: 'lookup', arguments: '{"query":' } },
            ],
          },
          { tool_calls: [{ index: 0, function: { arguments: '"new"}' } }] },
        ];
        const chunks = [
          ...deltas.map(delta => ({
            id: 'response-1',
            model: 'deepseek-flash',
            created: 0,
            choices: [{ index: 0, delta, finish_reason: null }],
          })),
          { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage },
        ];
        return new Response(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(['doGenerate', 'doStream'] as const)(
    '%s preserves prior reasoning and backfills reasoning-less turns',
    async method => {
      const router = new ModelRouterLanguageModel({ id: 'deepseek/deepseek-flash', apiKey: 'test-key' });
      const list = history();
      const before = JSON.stringify(list.get.all.db());
      const result = await router[method]({ prompt: await list.get.all.aiV5.llmPrompt(), tools });
      const parts = await collect(result.stream);

      expect(requests[0]).toMatchObject({
        model: 'deepseek-flash',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: 'Use tools to answer the user.' }),
          expect.objectContaining({ role: 'assistant', reasoning_content: 'Prior thinking' }),
          expect.objectContaining({
            role: 'assistant',
            reasoning_content: expect.any(String),
            tool_calls: expect.any(Array),
          }),
          expect.objectContaining({
            role: 'assistant',
            content: 'Previous answer without reasoning',
            reasoning_content: '',
          }),
        ]),
      });
      expect(JSON.stringify(list.get.all.db())).toBe(before);
      const reasoning = parts
        .filter(part => part.type === 'reasoning-delta')
        .map(part => part.delta)
        .join('');
      expect(reasoning).toBe('New thinking');
      expect(parts.filter(part => part.type === 'reasoning-start')).toHaveLength(1);
      expect(parts.filter(part => part.type === 'reasoning-end')).toHaveLength(1);
      expect(parts).toContainEqual(
        expect.objectContaining({
          type: 'finish',
          usage: expect.objectContaining({
            inputTokens: expect.objectContaining({ total: 10 }),
            outputTokens: expect.objectContaining({ total: 8, reasoning: 3 }),
          }),
        }),
      );

      if (method === 'doStream') {
        expect(parts).toContainEqual(
          expect.objectContaining({
            type: 'tool-call',
            toolCallId: 'call_new',
            toolName: 'lookup',
            input: '{"query":"new"}',
          }),
        );
      }

      list.add(
        {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: reasoning },
            { type: 'text', text: 'Answer' },
          ],
        },
        'response',
      );
      const restored = new MessageList();
      restored.add(
        list.get.all.db().map(message => ({ ...JSON.parse(JSON.stringify(message)), createdAt: message.createdAt })),
        'memory',
      );
      restored.add({ role: 'user', content: 'One more question' }, 'input');
      await collect((await router[method]({ prompt: await restored.get.all.aiV5.llmPrompt(), tools })).stream);
      expect(requests[1]).toMatchObject({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'assistant', content: 'Answer', reasoning_content: 'New thinking' }),
        ]),
      });
    },
  );

  it.each([
    ['adaptive', 'medium', 'enabled', 'high'],
    ['enabled', 'xhigh', 'enabled', 'max'],
    ['disabled', 'low', 'disabled', undefined],
  ] as const)(
    'normalizes thinking %s and reasoning effort %s',
    async (type, reasoningEffort, expectedType, expectedEffort) => {
      const router = new ModelRouterLanguageModel({ id: 'deepseek/deepseek-flash', apiKey: 'test-key' });
      const result = await router.doGenerate({
        prompt: await history().get.all.aiV5.llmPrompt(),
        providerOptions: { deepseek: { thinking: { type }, reasoningEffort } },
      });
      await collect(result.stream);
      expect(requests[0]).toMatchObject({ thinking: { type: expectedType } });
      if (expectedEffort) expect(requests[0]).toHaveProperty('reasoning_effort', expectedEffort);
      else expect(requests[0]).not.toHaveProperty('reasoning_effort');
    },
  );

  it('converts legacy tool-result image data at the router boundary', async () => {
    const router = new ModelRouterLanguageModel({ id: 'deepseek/deepseek-flash', apiKey: 'test-key' });
    const result = await router.doGenerate({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'image_call',
              toolName: 'lookup',
              output: {
                type: 'content',
                value: [{ type: 'media', data: 'iVBORw0KGgo=', mediaType: 'image/png' }],
              },
            },
          ],
        },
      ],
    });
    await collect(result.stream);
    expect(requests[0]).toMatchObject({
      messages: [
        { role: 'tool', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } }] },
      ],
    });
  });
});
