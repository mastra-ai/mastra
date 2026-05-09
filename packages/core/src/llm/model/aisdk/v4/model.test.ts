import type { LanguageModelV1, LanguageModelV1CallOptions } from '@internal/ai-sdk-v4';
import { describe, expect, it, vi } from 'vitest';
import { AISDKV4LegacyLanguageModel } from './model';

function createMockV1Model(overrides?: Partial<LanguageModelV1>): LanguageModelV1 {
  return {
    specificationVersion: 'v1',
    provider: 'openai',
    modelId: 'test-v1-model',
    defaultObjectGenerationMode: 'json',
    doGenerate: vi.fn().mockResolvedValue({
      text: 'ok',
      finishReason: 'stop',
      usage: { promptTokens: 1, completionTokens: 1 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    ...overrides,
  } as LanguageModelV1;
}

describe('AISDKV4LegacyLanguageModel', () => {
  describe('delegation', () => {
    it('forwards doGenerate to the wrapped model', async () => {
      const mock = createMockV1Model();
      const wrapped = new AISDKV4LegacyLanguageModel(mock);
      const options = { mode: { type: 'regular' }, prompt: [] } as unknown as LanguageModelV1CallOptions;

      await wrapped.doGenerate(options);

      expect(mock.doGenerate).toHaveBeenCalledWith(options);
    });

    it('forwards doStream to the wrapped model', async () => {
      const mock = createMockV1Model();
      const wrapped = new AISDKV4LegacyLanguageModel(mock);
      const options = { mode: { type: 'regular' }, prompt: [] } as unknown as LanguageModelV1CallOptions;

      await wrapped.doStream(options);

      expect(mock.doStream).toHaveBeenCalledWith(options);
    });

    it('forwards supportsUrl when the wrapped model implements it', () => {
      const supportsUrl = vi.fn().mockReturnValue(true);
      const mock = createMockV1Model({ supportsUrl });
      const wrapped = new AISDKV4LegacyLanguageModel(mock);
      const url = new URL('https://example.com/file.pdf');

      expect(wrapped.supportsUrl(url)).toBe(true);
      expect(supportsUrl).toHaveBeenCalledWith(url);
    });

    it('returns false from supportsUrl when the wrapped model does not implement it', () => {
      const mock = createMockV1Model();
      const wrapped = new AISDKV4LegacyLanguageModel(mock);

      expect(wrapped.supportsUrl(new URL('https://example.com/file.pdf'))).toBe(false);
    });
  });

  describe('serializeForSpan', () => {
    it('returns only identity fields', () => {
      const wrapped = new AISDKV4LegacyLanguageModel(createMockV1Model());

      expect(wrapped.serializeForSpan()).toEqual({
        specificationVersion: 'v1',
        modelId: 'test-v1-model',
        provider: 'openai',
      });
    });

    it('does not expose the wrapped provider SDK client', () => {
      // Simulate a v1 provider that exposes its internal config as enumerable
      // properties (which is what would leak without the wrapper).
      const leaky = createMockV1Model() as LanguageModelV1 & { config: { apiKey: string } };
      (leaky as any).config = { apiKey: 'sk-should-not-leak' };
      const wrapped = new AISDKV4LegacyLanguageModel(leaky);

      const serialized = JSON.stringify(wrapped.serializeForSpan());

      expect(serialized).not.toContain('sk-should-not-leak');
      expect(serialized).not.toContain('config');
      expect(serialized).not.toContain('doGenerate');
      expect(serialized).not.toContain('doStream');
    });
  });
});
