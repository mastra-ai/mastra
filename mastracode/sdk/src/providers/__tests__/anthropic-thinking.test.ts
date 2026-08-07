import { describe, expect, it } from 'vitest';
import { createAnthropicThinkingMiddleware } from '../claude-max.js';

type Params = {
  temperature?: number;
  topP?: number;
  topK?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
};

async function transform(
  middleware: NonNullable<ReturnType<typeof createAnthropicThinkingMiddleware>>,
  params: Params,
) {
  return (await middleware.transformParams!({
    type: 'stream',
    params: params as any,
    model: {} as any,
  })) as Params;
}

describe('createAnthropicThinkingMiddleware', () => {
  it('returns undefined when thinking level is off or unset', () => {
    expect(createAnthropicThinkingMiddleware('claude-sonnet-5', 'off')).toBeUndefined();
    expect(createAnthropicThinkingMiddleware('claude-sonnet-5', undefined)).toBeUndefined();
  });

  it('returns undefined for models without thinking support', () => {
    expect(createAnthropicThinkingMiddleware('claude-3-5-sonnet-20241022', 'high')).toBeUndefined();
    expect(createAnthropicThinkingMiddleware('claude-3-haiku-20240307', 'max')).toBeUndefined();
  });

  it('maps levels to adaptive thinking + effort on current-generation models', async () => {
    const middleware = createAnthropicThinkingMiddleware('claude-fable-5', 'max');
    expect(middleware).toBeDefined();

    const result = await transform(middleware!, {});
    expect(result.providerOptions?.anthropic).toEqual({
      thinking: { type: 'adaptive', display: 'summarized' },
      effort: 'max',
    });
  });

  it('clamps xhigh to high on adaptive models that do not support xhigh effort', async () => {
    const middleware = createAnthropicThinkingMiddleware('claude-sonnet-4-6', 'xhigh');
    const result = await transform(middleware!, {});
    expect(result.providerOptions?.anthropic).toMatchObject({ effort: 'high' });
  });

  it('preserves xhigh on models that support it', async () => {
    const middleware = createAnthropicThinkingMiddleware('claude-fable-5', 'xhigh');
    const result = await transform(middleware!, {});
    expect(result.providerOptions?.anthropic).toMatchObject({ effort: 'xhigh' });
  });

  it('maps levels to budget tokens on budget-era models', async () => {
    const middleware = createAnthropicThinkingMiddleware('claude-opus-4-1-20250805', 'high');
    const result = await transform(middleware!, {});
    expect(result.providerOptions?.anthropic).toEqual({
      thinking: { type: 'enabled', budgetTokens: 16384 },
    });
  });

  it('uses budget thinking for claude-3-7', async () => {
    const middleware = createAnthropicThinkingMiddleware('claude-3-7-sonnet-20250219', 'low');
    const result = await transform(middleware!, {});
    expect(result.providerOptions?.anthropic).toEqual({
      thinking: { type: 'enabled', budgetTokens: 4096 },
    });
  });

  it('strips sampling parameters when enabling thinking', async () => {
    const middleware = createAnthropicThinkingMiddleware('claude-sonnet-5', 'medium');
    const result = await transform(middleware!, { temperature: 0.7, topP: 0.9, topK: 40 });
    expect(result.temperature).toBeUndefined();
    expect(result.topP).toBeUndefined();
    expect(result.topK).toBeUndefined();
  });

  it('does not override explicit per-request thinking configuration', async () => {
    const middleware = createAnthropicThinkingMiddleware('claude-sonnet-5', 'high');
    const explicit = { anthropic: { thinking: { type: 'disabled' } } };
    const result = await transform(middleware!, { temperature: 0.5, providerOptions: explicit });
    expect(result.providerOptions).toEqual(explicit);
    expect(result.temperature).toBe(0.5);
  });

  it('preserves unrelated provider options', async () => {
    const middleware = createAnthropicThinkingMiddleware('claude-sonnet-5', 'low');
    const result = await transform(middleware!, {
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } }, openai: { store: false } },
    });
    expect(result.providerOptions?.openai).toEqual({ store: false });
    expect(result.providerOptions?.anthropic).toMatchObject({
      cacheControl: { type: 'ephemeral' },
      effort: 'low',
    });
  });
});
