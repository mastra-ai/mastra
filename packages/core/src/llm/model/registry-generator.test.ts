import { describe, it, expect } from 'vitest';
import { generateTypesContent } from './registry-generator.js';

describe('registry-generator', () => {
  describe('generateTypesContent', () => {
    it('should not quote valid JS identifiers', () => {
      const models = {
        openai: ['gpt-4'],
        _private: ['model-1'],
        $provider: ['model-2'],
        provider123: ['model-3'],
      };

      const content = generateTypesContent(models);

      expect(content).toContain('readonly openai:');
      expect(content).toContain('readonly _private:');
      expect(content).toContain('readonly $provider:');
      expect(content).toContain('readonly provider123:');
    });

    it('should quote provider names with special characters', () => {
      const models = {
        'fireworks-ai': ['llama-v3-70b'],
      };

      const content = generateTypesContent(models);

      expect(content).toContain("readonly 'fireworks-ai':");
    });

    it('should quote provider names starting with digits', () => {
      const models = {
        '302ai': ['model-1'],
      };

      const content = generateTypesContent(models);

      expect(content).toContain("readonly '302ai':");
      expect(content).not.toMatch(/readonly\s+\d/);
    });
  });
});
