import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/openai-compatible-v5', async () => {
  return {
    createOpenAICompatible: vi.fn(),
  };
});

const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible-v5');
const { Agent } = await import('../../agent');

describe('Cloudflare AI Gateway URL interpolation', () => {
  const chatModel = vi.fn(
    () =>
      new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'ok' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'ok' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      }),
  );

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-123';
    process.env.CLOUDFLARE_GATEWAY_ID = 'gateway-123';
    process.env.CLOUDFLARE_API_TOKEN = 'token-123';

    vi.mocked(createOpenAICompatible).mockReturnValue({
      chatModel,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_GATEWAY_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
  });

  it('passes an interpolated baseURL to the provider during agent.stream()', async () => {
    const agent = new Agent({
      id: 'cf-ai-gateway-agent',
      name: 'CF AI Gateway Agent',
      instructions: 'Be brief.',
      model: 'cloudflare-ai-gateway/anthropic/claude-3-5-haiku',
    });

    const result = await agent.stream('hello');
    await result.text;

    expect(createOpenAICompatible).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createOpenAICompatible).mock.calls[0]?.[0]).toMatchObject({
      baseURL: 'https://gateway.ai.cloudflare.com/v1/account-123/gateway-123/compat',
      apiKey: 'token-123',
    });
    // The compat endpoint expects `{provider}/{model}` as the model name
    expect(chatModel).toHaveBeenCalledWith('anthropic/claude-3-5-haiku');
  });
});
