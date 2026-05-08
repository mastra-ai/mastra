import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import { describe, expect, it, vi } from 'vitest';
import { AISDKV6LanguageModel } from './model';

function createMockV3Model() {
  return {
    specificationVersion: 'v3',
    provider: 'openai',
    modelId: 'test-v3-model',
    supportedUrls: {},
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  } as unknown as LanguageModelV3;
}

describe('AISDKV6LanguageModel', () => {
  describe('serializeForSpan', () => {
    it('returns only identity fields', () => {
      const wrapped = new AISDKV6LanguageModel(createMockV3Model());

      expect(wrapped.serializeForSpan()).toEqual({
        specificationVersion: 'v3',
        modelId: 'test-v3-model',
        provider: 'openai',
      });
    });

    it('does not expose the wrapped provider SDK client', () => {
      const wrapped = new AISDKV6LanguageModel(createMockV3Model());

      const serialized = JSON.stringify(wrapped.serializeForSpan());

      expect(serialized).not.toContain('supportedUrls');
      expect(serialized).not.toContain('doGenerate');
      expect(serialized).not.toContain('doStream');
    });
  });
});
