import { describe, it, expect } from 'vitest';
import { findProviderById, resolveProviderModel } from '../utils';

describe('findProviderById', () => {
  const providers = [
    { id: 'openai', name: 'OpenAI', connected: true },
    { id: 'anthropic', name: 'Anthropic', connected: true },
    { id: 'acme/custom', name: 'ACME Custom', connected: true },
    { id: 'gateway1/shared-provider', name: 'Gateway 1 Shared', connected: true },
    { id: 'gateway2/shared-provider', name: 'Gateway 2 Shared', connected: false },
  ];

  describe('direct match', () => {
    it('should find provider by exact id', () => {
      const result = findProviderById(providers, 'openai');
      expect(result?.id).toBe('openai');
    });

    it('should find gateway provider by exact id', () => {
      const result = findProviderById(providers, 'acme/custom');
      expect(result?.id).toBe('acme/custom');
    });

    it('should handle .chat suffix in lookup', () => {
      const result = findProviderById(providers, 'openai.chat');
      expect(result?.id).toBe('openai');
    });
  });

  describe('gateway prefix fallback', () => {
    it('should find gateway provider when lookup uses provider without prefix', () => {
      // This is the key fix for issue #11732
      // Agent model is 'acme/custom/gpt-4o', model.provider is 'custom'
      // Registry has 'acme/custom', should find it
      const result = findProviderById(providers, 'custom');
      expect(result?.id).toBe('acme/custom');
    });

    it('should find first matching gateway provider when multiple match', () => {
      // When multiple gateways have the same provider name, find first one
      const result = findProviderById(providers, 'shared-provider');
      expect(result?.id).toBe('gateway1/shared-provider');
    });

    it('should not use fallback if provider id already contains slash', () => {
      // If looking for 'other/custom', don't try to find '*/other/custom'
      const result = findProviderById(providers, 'other/custom');
      expect(result).toBeUndefined();
    });
  });

  describe('not found cases', () => {
    it('should return undefined for non-existent provider', () => {
      const result = findProviderById(providers, 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty provider id', () => {
      const result = findProviderById(providers, '');
      expect(result).toBeUndefined();
    });

    it('should handle empty providers array', () => {
      const result = findProviderById([], 'openai');
      expect(result).toBeUndefined();
    });
  });
});

describe('resolveProviderModel', () => {
  const providers = [
    { id: 'openai', models: ['gpt-4o'] },
    { id: 'mastra', models: ['openai/gpt-5-mini'] },
    { id: 'acme/custom', models: ['custom-small'] },
    { id: 'private/ollama', models: ['gpt-oss:20b'] },
  ];

  it('moves the provider segment of a prefixed gateway model onto the provider', () => {
    expect(resolveProviderModel(providers, 'private', 'ollama/gpt-oss:20b')).toEqual({
      provider: 'private/ollama',
      model: 'gpt-oss:20b',
    });
  });

  it('keeps models whose ids contain a slash on a unified gateway', () => {
    expect(resolveProviderModel(providers, 'mastra', 'openai/gpt-5-mini')).toEqual({
      provider: 'mastra',
      model: 'openai/gpt-5-mini',
    });
  });

  it('keeps the gateway prefix fallback for providers reported without it', () => {
    expect(resolveProviderModel(providers, 'custom', 'custom-small')).toEqual({
      provider: 'acme/custom',
      model: 'custom-small',
    });
  });

  it('leaves unknown providers and models unchanged', () => {
    expect(resolveProviderModel(providers, 'other', 'vendor/model')).toEqual({
      provider: 'other',
      model: 'vendor/model',
    });
  });
});
