import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn((_opts: Record<string, unknown>) => {
    return (modelId: string) => ({ __provider: 'anthropic', modelId });
  }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((_opts: Record<string, unknown>) => {
    const openai = ((modelId: string) => ({ __provider: 'openai', modelId })) as unknown as {
      responses: (modelId: string) => Record<string, unknown>;
    };
    openai.responses = (modelId: string) => ({ __provider: 'openai', modelId });
    return openai;
  }),
}));

vi.mock('ai', () => ({
  wrapLanguageModel: vi.fn(({ model }: { model: Record<string, unknown> }) => ({
    ...model,
    __wrapped: true,
  })),
}));

describe('provider base URL env support', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      VITEST: 'true',
    };
    delete process.env.OPENAI_BASE_URL;
    delete process.env.ANTHROPIC_BASE_URL;
  });

  it('passes OPENAI_BASE_URL to the OpenAI Codex provider in test mode', async () => {
    process.env.OPENAI_BASE_URL = 'https://proxy.example.com/openai/v1';

    const { openaiCodexProvider } = await import('../openai-codex.js');

    openaiCodexProvider('gpt-5.3-codex');

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://proxy.example.com/openai/v1',
    });
  });

  it('passes ANTHROPIC_BASE_URL to the Claude Max provider in test mode', async () => {
    process.env.ANTHROPIC_BASE_URL = 'https://proxy.example.com/anthropic';

    const { opencodeClaudeMaxProvider } = await import('../claude-max.js');

    opencodeClaudeMaxProvider('claude-sonnet-4-20250514');

    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://proxy.example.com/anthropic',
    });
  });
});
