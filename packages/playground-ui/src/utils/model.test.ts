import { describe, expect, it } from 'vitest';
import { formatModelName, formatProviderName, resolveModel } from './model';

describe('resolveModel', () => {
  it('splits the provider from the model and names both', () => {
    expect(resolveModel('anthropic/claude-sonnet-4.5')).toEqual({
      provider: 'anthropic',
      providerName: 'Anthropic',
      model: 'claude-sonnet-4.5',
      modelName: 'Claude Sonnet 4.5',
    });
  });

  it('keeps the rest of a gateway path as the model', () => {
    expect(resolveModel('openrouter/anthropic/claude-3.5-sonnet')).toMatchObject({
      provider: 'openrouter',
      providerName: 'OpenRouter',
      model: 'anthropic/claude-3.5-sonnet',
      modelName: 'Claude 3.5 Sonnet',
    });
  });

  it('drops provider API suffixes and normalizes case', () => {
    expect(resolveModel('OpenAI.responses/gpt-5-mini')).toMatchObject({ provider: 'openai', model: 'gpt-5-mini' });
  });

  it('returns only the model when there is no provider', () => {
    expect(resolveModel('gpt-4o')).toEqual({ model: 'gpt-4o', modelName: 'GPT-4o' });
    expect(resolveModel('/gpt-4o')).toEqual({ model: '/gpt-4o', modelName: 'GPT-4o' });
    expect(resolveModel('  gpt-4o  ')).toEqual({ model: 'gpt-4o', modelName: 'GPT-4o' });
  });
});

describe('formatModelName', () => {
  it.each([
    ['claude-sonnet-4.5', 'Claude Sonnet 4.5'],
    ['claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5'],
    ['claude-opus-4-1', 'Claude Opus 4.1'],
    ['gpt-5-mini', 'GPT-5 Mini'],
    ['gpt-4o-2024-08-06', 'GPT-4o'],
    ['gpt-oss-120b', 'GPT-OSS 120B'],
    ['o3-mini', 'o3 Mini'],
    ['gemini-2.5-flash-preview-09-2025', 'Gemini 2.5 Flash Preview'],
    ['llama-3.1-70b-instruct', 'Llama 3.1 70B Instruct'],
    ['deepseek-chat', 'DeepSeek Chat'],
    ['grok-4-fast', 'Grok 4 Fast'],
  ])('%s reads as %s', (model, name) => {
    expect(formatModelName(model)).toBe(name);
  });
});

describe('formatProviderName', () => {
  it('uses the registry name for known providers and title-cases the rest', () => {
    expect(formatProviderName('xai')).toBe('xAI');
    expect(formatProviderName('fireworks-ai')).toBe('Fireworks AI');
    expect(formatProviderName('acme-labs')).toBe('Acme Labs');
  });
});
