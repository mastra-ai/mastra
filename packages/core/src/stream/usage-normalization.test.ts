import { describe, expect, it } from 'vitest';
import { normalizeLanguageModelUsage } from './usage-normalization';

describe('normalizeLanguageModelUsage', () => {
  it('normalizes canonical flat usage', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 170,
      reasoningTokens: 20,
      cachedInputTokens: 15,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test' },
    };

    expect(normalizeLanguageModelUsage(usage)).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 170,
      reasoningTokens: 20,
      cachedInputTokens: 15,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test' },
    });
  });

  it('normalizes legacy v4 prompt/completion usage', () => {
    const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };

    expect(normalizeLanguageModelUsage(usage)).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
      cacheCreationInputTokens: undefined,
      raw: usage,
    });
  });

  it('normalizes AI SDK v6 nested usage', () => {
    const usage = {
      inputTokens: {
        total: 100,
        cacheRead: 25,
        cacheWrite: 5,
      },
      outputTokens: {
        total: 50,
        reasoning: 30,
      },
    };

    expect(normalizeLanguageModelUsage(usage)).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      reasoningTokens: 30,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: usage,
    });
  });

  it('normalizes OpenAI-style snake_case usage', () => {
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 190,
      prompt_tokens_details: { cached_tokens: 25 },
      completion_tokens_details: { reasoning_tokens: 40 },
    };

    expect(normalizeLanguageModelUsage(usage)).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 190,
      reasoningTokens: 40,
      cachedInputTokens: 25,
      cacheCreationInputTokens: undefined,
      raw: usage,
    });
  });

  it('normalizes Gemini usageMetadata fields', () => {
    const usage = {
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
        thoughtsTokenCount: 30,
        totalTokenCount: 180,
      },
    };

    expect(normalizeLanguageModelUsage(usage)).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 180,
      reasoningTokens: 30,
      cachedInputTokens: undefined,
      cacheCreationInputTokens: undefined,
      raw: usage,
    });
  });

  it('prefers canonical top-level fields over legacy and provider fallbacks', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 175,
      reasoningTokens: 25,
      cachedInputTokens: 12,
      cacheCreationInputTokens: 6,
      promptTokens: 999,
      completionTokens: 888,
      total_tokens: 777,
      outputTokenDetails: { reasoningTokens: 666 },
      prompt_tokens_details: { cached_tokens: 555 },
      cache_creation_input_tokens: 444,
    };

    expect(normalizeLanguageModelUsage(usage)).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 175,
      reasoningTokens: 25,
      cachedInputTokens: 12,
      cacheCreationInputTokens: 6,
      raw: usage,
    });
  });

  it('preserves provider total over recomputed totals', () => {
    expect(normalizeLanguageModelUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 250 })).toMatchObject({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 250,
    });
  });

  it('falls back to input plus output when total is omitted', () => {
    expect(normalizeLanguageModelUsage({ inputTokens: 100, outputTokens: 50 })).toMatchObject({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
  });

  it('preserves explicit raw for canonical usage', () => {
    const raw = { provider: 'raw-provider' };

    expect(normalizeLanguageModelUsage({ inputTokens: 100, outputTokens: 50, raw })).toMatchObject({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      raw,
    });
  });

  it('returns empty usage for missing input', () => {
    expect(normalizeLanguageModelUsage(undefined)).toEqual({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
      cacheCreationInputTokens: undefined,
      raw: undefined,
    });
  });

  it('does not coerce unknown object usage totals to zero', () => {
    expect(normalizeLanguageModelUsage({})).toEqual({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
      cacheCreationInputTokens: undefined,
      raw: undefined,
    });
  });
});
