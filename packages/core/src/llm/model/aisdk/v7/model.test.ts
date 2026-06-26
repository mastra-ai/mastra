import type { LanguageModelV4, LanguageModelV4CallOptions } from '@ai-sdk/provider-v7';
import { describe, expect, it, vi } from 'vitest';
import { AISDKV7LanguageModel } from './model';

function createMockV4Model() {
  return {
    specificationVersion: 'v4',
    provider: 'openai',
    modelId: 'test-v4-model',
    supportedUrls: {},
    doGenerate: vi.fn(async () => ({
      content: [],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
    })),
    doStream: vi.fn(async () => ({
      stream: new ReadableStream(),
    })),
  } as unknown as LanguageModelV4;
}

describe('AISDKV7LanguageModel', () => {
  describe('serializeForSpan', () => {
    it('returns only identity fields', () => {
      const wrapped = new AISDKV7LanguageModel(createMockV4Model());

      expect(wrapped.serializeForSpan()).toEqual({
        specificationVersion: 'v4',
        modelId: 'test-v4-model',
        provider: 'openai',
      });
    });

    it('does not expose the wrapped provider SDK client', () => {
      const wrapped = new AISDKV7LanguageModel(createMockV4Model());

      const serialized = JSON.stringify(wrapped.serializeForSpan());

      expect(serialized).not.toContain('supportedUrls');
      expect(serialized).not.toContain('doGenerate');
      expect(serialized).not.toContain('doStream');
    });
  });

  describe('tool remapping', () => {
    it('remaps provider-defined tools to provider for V4 in doStream', async () => {
      const model = createMockV4Model();
      const wrapped = new AISDKV7LanguageModel(model);

      const options = {
        prompt: [],
        tools: [{ type: 'provider-defined', id: 'openai.web_search', name: 'web_search', args: {} }],
      } as unknown as LanguageModelV4CallOptions;

      await wrapped.doStream(options);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(passed.tools[0].type).toBe('provider');
    });

    it('leaves function tools untouched', async () => {
      const model = createMockV4Model();
      const wrapped = new AISDKV7LanguageModel(model);

      const options = {
        prompt: [],
        tools: [{ type: 'function', name: 'getWeather', inputSchema: {} }],
      } as unknown as LanguageModelV4CallOptions;

      await wrapped.doStream(options);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(passed.tools[0].type).toBe('function');
    });
  });
});
