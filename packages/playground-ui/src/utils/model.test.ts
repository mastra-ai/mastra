import { describe, expect, it } from 'vitest';
import { compareModelReleaseDates, formatModelName, formatProviderName, resolveModel } from './model';

describe('compareModelReleaseDates', () => {
  describe('when release dates are available', () => {
    it('orders newer releases before older releases', () => {
      expect(compareModelReleaseDates('2025-08-07', '2024-05-13')).toBeLessThan(0);
      expect(compareModelReleaseDates('2024-05-13', '2025-08-07')).toBeGreaterThan(0);
    });

    it('leaves same-day releases tied for the caller to order by name', () => {
      expect(compareModelReleaseDates('2025-08-07', '2025-08-07')).toBe(0);
    });
  });

  describe('when dates are missing or invalid', () => {
    it.each([undefined, '', 'unknown'])('puts %s after a dated model', date => {
      expect(compareModelReleaseDates(date, '2025-08-07')).toBeGreaterThan(0);
      expect(compareModelReleaseDates('2025-08-07', date)).toBeLessThan(0);
    });

    it('leaves undated models tied for the caller to order by name', () => {
      expect(compareModelReleaseDates(undefined, 'unknown')).toBe(0);
    });
  });
});

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
    ['amazon-bedrock/anthropic.claude-sonnet-4-5', 'Claude Sonnet 4.5'],
    ['us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'Claude Sonnet 4.5'],
    ['amazon-bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0', 'Claude 3.5 Sonnet'],
    ['amazon.nova-pro-v1:0', 'Nova Pro'],
    ['meta.llama3-1-70b-instruct-v1:0', 'Llama 3.1 70B Instruct'],
    ['meta.llama3-3-70b-instruct-v1:0', 'Llama 3.3 70B Instruct'],
    ['meta.llama4-scout-17b-instruct-v1:0', 'Llama4 Scout 17B Instruct'],
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
