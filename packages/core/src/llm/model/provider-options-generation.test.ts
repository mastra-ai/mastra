import { describe, it, expect } from 'vitest';
import { generateProviderOptionsSection } from '../../../scripts/generate-provider-options-docs';

describe('Provider Options Documentation Generation', () => {
  describe('Anthropic Provider Options', () => {
    it('should generate documentation with Anthropic-specific properties', () => {
      const markdown = generateProviderOptionsSection('anthropic');

      expect(markdown).toBeTruthy();
      expect(markdown).toContain('## Provider Options');
      expect(markdown).toContain('Anthropic supports the following provider-specific options');
      expect(markdown).toContain('providerOptions');

      // Check for known Anthropic-specific properties
      expect(markdown).toContain('thinking');
      expect(markdown).toContain('sendReasoning');
    });
  });

  describe('xAI Provider Options', () => {
    it('should generate documentation with xAI-specific properties', () => {
      const markdown = generateProviderOptionsSection('xai');

      expect(markdown).toBeTruthy();
      expect(markdown).toContain('## Provider Options');
      expect(markdown).toContain('xAI supports the following provider-specific options');

      // Check for known xAI-specific properties
      expect(markdown).toContain('reasoningEffort');
    });
  });

  describe('Google Provider Options', () => {
    it('should generate documentation with Google-specific properties', () => {
      const markdown = generateProviderOptionsSection('google');

      expect(markdown).toBeTruthy();
      expect(markdown).toContain('## Provider Options');
      expect(markdown).toContain('Google supports the following provider-specific options');

      // Check for known Google-specific properties
      expect(markdown).toContain('cachedContent');
      expect(markdown).toContain('thinkingConfig');
    });
  });

  describe('OpenAI Provider Options', () => {
    it('should generate documentation with OpenAI-specific properties', () => {
      const markdown = generateProviderOptionsSection('openai');

      expect(markdown).toBeTruthy();
      expect(markdown).toContain('## Provider Options');
      expect(markdown).toContain('OpenAI supports the following provider-specific options');

      // Check for known OpenAI-specific properties (Responses API)
      expect(markdown).toContain('instructions');
    });
  });

  describe('Unsupported Provider', () => {
    it('should return empty string for providers without options', () => {
      const markdown = generateProviderOptionsSection('unsupported-provider');

      expect(markdown).toBe('');
    });
  });
});
