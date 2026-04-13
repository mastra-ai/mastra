import { describe, it, expect } from 'vitest';
import { cleanProviderId, findProviderById } from '../utils';

describe('cleanProviderId', () => {
  it('should remove .chat suffix', () => {
    expect(cleanProviderId('openai.chat')).toBe('openai');
  });

  it('should remove .messages suffix', () => {
    expect(cleanProviderId('anthropic.messages')).toBe('anthropic');
  });

  it('should remove .responses suffix', () => {
    expect(cleanProviderId('openai.responses')).toBe('openai');
  });

  it('should return unchanged if no dot suffix', () => {
    expect(cleanProviderId('openai')).toBe('openai');
  });

  it('should return unchanged for gateway/provider format', () => {
    expect(cleanProviderId('acme/custom')).toBe('acme/custom');
  });
});

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
