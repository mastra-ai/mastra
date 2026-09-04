import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAnthropicTools } from '../../providers/anthropic.js';

const TOKEN = 'fake-test-token';

const EXPECTED_TOOLS = ['anthropic_create_message', 'anthropic_count_tokens', 'anthropic_list_models'];

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createAnthropicTools>[0]) {
  return createAnthropicTools({
    connectionId: 'c_an1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createAnthropicTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createAnthropicTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createAnthropicTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createAnthropicTools({ allowTools: ['anthropic_list_models'] });
    expect(Object.keys(tools)).toEqual(['anthropic_list_models']);
    expect(() => createAnthropicTools({ allowTools: ['anthropic_nope'] })).toThrow(/anthropic_nope/);
  });

  it('POSTs create_message with the anthropic-version header and joins text blocks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: 'msg-1',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-5',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'Ada' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 12, output_tokens: 7 },
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'anthropic_create_message').execute(
      {
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'user', content: 'Say hello to Ada' }],
        maxTokens: 256,
        system: 'Be brief.',
      },
      {} as never,
    );
    expect(result).toEqual({
      id: 'msg-1',
      model: 'claude-sonnet-4-5',
      stopReason: 'end_turn',
      text: 'Hello Ada',
      inputTokens: 12,
      outputTokens: 7,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_an1/proxy/v1/messages');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      system: 'Be brief.',
    });
  });

  it('counts tokens via count_tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ input_tokens: 42 }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'anthropic_count_tokens').execute(
      { model: 'claude-sonnet-4-5', messages: [{ role: 'user', content: 'Hi' }] },
      {} as never,
    );
    expect(result).toEqual({ inputTokens: 42 });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_an1/proxy/v1/messages/count_tokens');
  });

  it('lists models with hasMore cursor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: 'claude-sonnet-4-5',
            type: 'model',
            display_name: 'Claude Sonnet 4.5',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        has_more: true,
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'anthropic_list_models').execute({ afterId: 'claude-opus-4-1' }, {} as never);
    expect(result).toEqual({
      models: [{ id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', createdAt: '2026-01-01T00:00:00Z' }],
      hasMore: true,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_an1/proxy/v1/models?after_id=claude-opus-4-1');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('falls back to MASTRA_ANTHROPIC_CONNECTION_ID and errors when unresolvable', async () => {
    vi.stubEnv('MASTRA_ANTHROPIC_CONNECTION_ID', 'c_envan');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [], has_more: false }));
    const tools = createAnthropicTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'anthropic_list_models').execute({}, {} as never);
    expect(fetchMock.mock.calls[0]![0]).toContain('/v2/connections/c_envan/proxy/');

    vi.stubEnv('MASTRA_ANTHROPIC_CONNECTION_ID', '');
    const tools2 = createAnthropicTools({ client: { accessToken: TOKEN, baseUrl: 'https://example.test' } });
    await expect(tool(tools2, 'anthropic_list_models').execute({}, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
  });
});
