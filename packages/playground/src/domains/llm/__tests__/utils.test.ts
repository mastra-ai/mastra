import { describe, it, expect } from 'vitest';
import { findProviderById } from '../utils';

describe('findProviderById', () => {
  const providers = [
    { id: 'openai', name: 'OpenAI', connected: true },
    { id: 'anthropic', name: 'Anthropic', connected: true },
    { id: 'acme/custom', name: 'ACME Custom', connected: true },
    { id: 'gateway1/shared-provider', name: 'Gateway 1 Shared', connected: true },
    { id: 'gateway2/shared-provider', name: 'Gateway 2 Shared', connected: false },
  ];

  describe('direct match', () => {
    it.each([
      ['should find provider by exact id', 'openai', 'openai'],
      ['should find gateway provider by exact id', 'acme/custom', 'acme/custom'],
      ['should handle .chat suffix in lookup', 'openai.chat', 'openai'],
    ] as const)('%s', (_title, input, expected) => {
      const result = findProviderById(providers, input);
      expect(result?.id).toBe(expected);
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
