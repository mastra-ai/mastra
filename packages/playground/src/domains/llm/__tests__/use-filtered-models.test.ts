import { describe, it, expect } from 'vitest';
import { providerMatches } from '../hooks/use-filtered-models';

describe('providerMatches', () => {
  describe('direct match', () => {
    it('should match exact provider id', () => {
      expect(providerMatches('openai', 'openai')).toBe(true);
    });

    it('should match gateway provider by exact id', () => {
      expect(providerMatches('acme/custom', 'acme/custom')).toBe(true);
    });

    it('should handle .chat suffix in target', () => {
      expect(providerMatches('openai', 'openai.chat')).toBe(true);
    });

    it('should not match different providers', () => {
      expect(providerMatches('openai', 'anthropic')).toBe(false);
    });
  });

  describe('gateway prefix fallback (issue #11732)', () => {
    it('should match gateway provider when target lacks prefix', () => {
      // This is the key fix for issue #11732
      // Model provider is 'acme/custom' (from registry)
      // Target is 'custom' (from model.provider extraction)
      // Should match
      expect(providerMatches('acme/custom', 'custom')).toBe(true);
    });

    it('should match with different gateway prefixes', () => {
      expect(providerMatches('gateway1/provider', 'provider')).toBe(true);
      expect(providerMatches('my-gateway/my-provider', 'my-provider')).toBe(true);
    });

    it('should not match when target already has slash', () => {
      // If target is 'other/custom', don't match 'acme/custom'
      expect(providerMatches('acme/custom', 'other/custom')).toBe(false);
    });

    it('should not match when provider part differs', () => {
      // 'acme/custom' should not match 'other-provider'
      expect(providerMatches('acme/custom', 'other-provider')).toBe(false);
    });

    it('should handle .chat suffix with gateway fallback', () => {
      expect(providerMatches('acme/custom', 'custom.chat')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(providerMatches('', '')).toBe(true);
      expect(providerMatches('openai', '')).toBe(false);
      expect(providerMatches('', 'openai')).toBe(false);
    });

    it('should handle providers with multiple slashes', () => {
      // Only gateway/provider format (2 parts) triggers fallback
      expect(providerMatches('a/b/c', 'c')).toBe(false);
    });
  });
});
