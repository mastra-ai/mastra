import { describe, expect, it } from 'vitest';

import { resolveActivationTTL } from '../activation-ttl';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('resolveActivationTTL', () => {
  it('keeps explicit numeric TTLs unchanged', () => {
    expect(resolveActivationTTL(30_000)).toBe(30_000);
    expect(resolveActivationTTL(undefined)).toBeUndefined();
  });

  it('resolves auto to a short TTL for unknown providers', () => {
    expect(resolveActivationTTL('auto')).toBe(5 * MINUTE);
    expect(resolveActivationTTL('auto', { provider: 'unknown', modelId: 'model' })).toBe(5 * MINUTE);
  });

  it('uses OpenAI prompt cache retention provider options before model heuristics', () => {
    expect(
      resolveActivationTTL('auto', {
        provider: 'openai',
        modelId: 'gpt-5-mini',
        providerOptions: { openai: { promptCacheRetention: '24h' } },
      }),
    ).toBe(HOUR);

    expect(
      resolveActivationTTL('auto', {
        provider: 'openai',
        modelId: 'gpt-5.5',
        providerOptions: { openai: { promptCacheRetention: 'in_memory' } },
      }),
    ).toBe(5 * MINUTE);
  });

  it('matches OpenAI short-retention model prefixes with variants', () => {
    expect(resolveActivationTTL('auto', { provider: 'openai', modelId: 'gpt-4.1' })).toBe(5 * MINUTE);
    expect(resolveActivationTTL('auto', { provider: 'openai', modelId: 'gpt-5-mini' })).toBe(5 * MINUTE);
    expect(resolveActivationTTL('auto', { provider: 'openai', modelId: 'gpt-5.1-codex' })).toBe(5 * MINUTE);
    expect(resolveActivationTTL('auto', { provider: 'openai', modelId: 'gpt-5.4-pro' })).toBe(5 * MINUTE);
  });

  it('uses extended TTL for OpenAI future/default-24h models', () => {
    expect(resolveActivationTTL('auto', { provider: 'openai', modelId: 'gpt-5.5' })).toBe(HOUR);
    expect(resolveActivationTTL('auto', { provider: 'openai', modelId: 'gpt-6' })).toBe(HOUR);
  });

  it('resolves auto TTLs for priority providers', () => {
    expect(resolveActivationTTL('auto', { provider: 'anthropic', modelId: 'claude-sonnet-4.5' })).toBe(5 * MINUTE);
    expect(resolveActivationTTL('auto', { provider: 'google', modelId: 'gemini-2.5-pro' })).toBe(24 * HOUR);
    expect(resolveActivationTTL('auto', { provider: 'gemini', modelId: 'gemini-3-pro-preview' })).toBe(24 * HOUR);
    expect(resolveActivationTTL('auto', { provider: 'deepseek', modelId: 'deepseek-v4-pro' })).toBe(HOUR);
    expect(resolveActivationTTL('auto', { provider: 'groq', modelId: 'openai/gpt-oss-120b' })).toBe(2 * HOUR);
    expect(resolveActivationTTL('auto', { provider: 'xai', modelId: 'grok-code-fast-1' })).toBe(5 * MINUTE);
    expect(resolveActivationTTL('auto', { provider: 'openrouter', modelId: 'openai/gpt-5.5' })).toBe(5 * MINUTE);
  });
});
