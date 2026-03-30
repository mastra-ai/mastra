import { describe, it, expect } from 'vitest';
import {
  createAnthropicThinkingMiddleware,
  THINKING_LEVEL_TO_ANTHROPIC_THINKING,
} from '../claude-max.js';
import type { ThinkingLevel } from '../openai-codex.js';

describe('THINKING_LEVEL_TO_ANTHROPIC_THINKING', () => {
  it('maps "off" to undefined', () => {
    expect(THINKING_LEVEL_TO_ANTHROPIC_THINKING.off).toBeUndefined();
  });

  it('maps "low" to enabled with budgetTokens 4096', () => {
    expect(THINKING_LEVEL_TO_ANTHROPIC_THINKING.low).toEqual({ type: 'enabled', budgetTokens: 4096 });
  });

  it('maps "medium" to enabled with budgetTokens 16384', () => {
    expect(THINKING_LEVEL_TO_ANTHROPIC_THINKING.medium).toEqual({ type: 'enabled', budgetTokens: 16384 });
  });

  it('maps "high" to enabled with budgetTokens 65536', () => {
    expect(THINKING_LEVEL_TO_ANTHROPIC_THINKING.high).toEqual({ type: 'enabled', budgetTokens: 65536 });
  });

  it('maps "xhigh" to enabled without budgetTokens (unlimited)', () => {
    expect(THINKING_LEVEL_TO_ANTHROPIC_THINKING.xhigh).toEqual({ type: 'enabled' });
  });
});

describe('createAnthropicThinkingMiddleware', () => {
  it('returns undefined for "off"', () => {
    expect(createAnthropicThinkingMiddleware('off')).toBeUndefined();
  });

  it.each(['low', 'medium', 'high', 'xhigh'] as ThinkingLevel[])('returns middleware for "%s"', (level) => {
    const middleware = createAnthropicThinkingMiddleware(level);
    expect(middleware).toBeDefined();
    expect(middleware!.specificationVersion).toBe('v3');
    expect(middleware!.transformParams).toBeInstanceOf(Function);
  });

  it('injects thinking config into providerOptions.anthropic', async () => {
    const middleware = createAnthropicThinkingMiddleware('high')!;
    const params = {
      prompt: [],
      providerOptions: {},
    } as any;

    const result = await middleware.transformParams!({ params, type: 'generate' as any });

    expect(result.providerOptions.anthropic).toEqual({
      thinking: { type: 'enabled', budgetTokens: 65536 },
    });
  });

  it('preserves existing anthropic provider options', async () => {
    const middleware = createAnthropicThinkingMiddleware('medium')!;
    const params = {
      prompt: [],
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    } as any;

    const result = await middleware.transformParams!({ params, type: 'generate' as any });

    expect(result.providerOptions.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
      thinking: { type: 'enabled', budgetTokens: 16384 },
    });
  });

  it('preserves other provider options', async () => {
    const middleware = createAnthropicThinkingMiddleware('low')!;
    const params = {
      prompt: [],
      providerOptions: {
        openai: { reasoningEffort: 'high' },
      },
    } as any;

    const result = await middleware.transformParams!({ params, type: 'generate' as any });

    expect(result.providerOptions.openai).toEqual({ reasoningEffort: 'high' });
    expect(result.providerOptions.anthropic).toEqual({
      thinking: { type: 'enabled', budgetTokens: 4096 },
    });
  });

  it('sets no budgetTokens for "xhigh" (maximum depth)', async () => {
    const middleware = createAnthropicThinkingMiddleware('xhigh')!;
    const params = {
      prompt: [],
      providerOptions: {},
    } as any;

    const result = await middleware.transformParams!({ params, type: 'generate' as any });

    expect(result.providerOptions.anthropic.thinking).toEqual({ type: 'enabled' });
    expect(result.providerOptions.anthropic.thinking).not.toHaveProperty('budgetTokens');
  });
});
