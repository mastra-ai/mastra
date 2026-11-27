import { describe, expect, it } from 'vitest';
import { anthropicThinkingOptions } from './claude-max.js';
import { thinkingProviderOptions } from './thinking-provider-options.js';

describe('thinkingProviderOptions', () => {
  it('sends nothing when thinking is unset or off', () => {
    expect(thinkingProviderOptions('openai/gpt-5.1', undefined)).toBeUndefined();
    expect(thinkingProviderOptions('openai/gpt-5.1', 'off')).toBeUndefined();
  });

  it('asks OpenAI for a reasoning effort', () => {
    expect(thinkingProviderOptions('openai/gpt-5.1', 'high')).toEqual({ openai: { reasoningEffort: 'high' } });
  });

  it('matches the Anthropic adapter for the same model and level', () => {
    expect(thinkingProviderOptions('anthropic/claude-sonnet-4-5', 'medium')).toEqual({
      anthropic: anthropicThinkingOptions('claude-sonnet-4-5', 'medium'),
    });
    expect(anthropicThinkingOptions('claude-sonnet-4-5', 'medium')).toBeDefined();
  });

  it('asks Gemini for a thinking config', () => {
    expect(thinkingProviderOptions('google/gemini-2.5-pro', 'high')).toMatchObject({
      google: { thinkingConfig: expect.any(Object) },
    });
  });

  it('reads through the Mastra gateway prefix', () => {
    expect(thinkingProviderOptions('mastra/openai/gpt-5.1', 'low')).toEqual({ openai: { reasoningEffort: 'low' } });
  });
});
