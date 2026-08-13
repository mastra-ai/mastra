import type { LanguageModelV3, LanguageModelV3CallOptions } from '@ai-sdk/provider-v6';
import { describe, expect, it, vi } from 'vitest';
import { AISDKV6LanguageModel } from './model';

function createMockV3Model() {
  return {
    specificationVersion: 'v3',
    provider: 'openai',
    modelId: 'test-v3-model',
    supportedUrls: {},
    doGenerate: vi.fn(async () => ({
      content: [],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
      request: {},
      response: { id: 'test', modelId: 'test-v3-model' },
    })),
    doStream: vi.fn(async () => ({
      stream: new ReadableStream(),
    })),
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

  describe('tool remapping', () => {
    it('remaps provider-defined tools to provider for V3 in doStream', async () => {
      const model = createMockV3Model();
      const wrapped = new AISDKV6LanguageModel(model);

      const options = {
        prompt: [],
        tools: [{ type: 'provider-defined', id: 'openai.web_search', name: 'web_search', args: {} }],
      } as unknown as LanguageModelV3CallOptions;

      await wrapped.doStream(options);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(passed.tools[0].type).toBe('provider');
    });

    it('leaves function tools untouched', async () => {
      const model = createMockV3Model();
      const wrapped = new AISDKV6LanguageModel(model);

      const options = {
        prompt: [],
        tools: [{ type: 'function', name: 'getWeather', inputSchema: {} }],
      } as unknown as LanguageModelV3CallOptions;

      await wrapped.doStream(options);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(passed.tools[0].type).toBe('function');
    });
  });

  describe('tool-result media remapping', () => {
    it('remaps a v2 tool-result media image part to image-data', async () => {
      const model = createMockV3Model();
      const wrapped = new AISDKV6LanguageModel(model);

      const options = {
        prompt: [
          {
            role: 'assistant',
            content: [{ type: 'tool-call', toolCallId: 'call_1', toolName: 'read_image', input: {} }],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                toolName: 'read_image',
                output: {
                  type: 'content',
                  value: [
                    { type: 'text', text: 'image result' },
                    { type: 'media', data: 'iVBORw0KGgo=', mediaType: 'image/png' },
                  ],
                },
              },
            ],
          },
        ],
      } as unknown as LanguageModelV3CallOptions;

      await wrapped.doStream(options);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const toolMsg = passed.prompt.find((m: { role: string }) => m.role === 'tool');
      const value = toolMsg.content[0].output.value;

      expect(value).toEqual([
        { type: 'text', text: 'image result' },
        { type: 'image-data', data: 'iVBORw0KGgo=', mediaType: 'image/png' },
      ]);
    });

    it('remaps a v2 tool-result media non-image part to file-data', async () => {
      const model = createMockV3Model();
      const wrapped = new AISDKV6LanguageModel(model);

      const options = {
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                toolName: 'read_pdf',
                output: {
                  type: 'content',
                  value: [{ type: 'media', data: 'JVBERi0=', mediaType: 'application/pdf' }],
                },
              },
            ],
          },
        ],
      } as unknown as LanguageModelV3CallOptions;

      await wrapped.doGenerate(options);

      const passed = (model.doGenerate as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const value = passed.prompt[0].content[0].output.value;

      expect(value).toEqual([{ type: 'file-data', data: 'JVBERi0=', mediaType: 'application/pdf' }]);
    });

    it('leaves already-converted image-data parts untouched', async () => {
      const model = createMockV3Model();
      const wrapped = new AISDKV6LanguageModel(model);

      const options = {
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                toolName: 'read_image',
                output: {
                  type: 'content',
                  value: [{ type: 'image-data', data: 'iVBORw0KGgo=', mediaType: 'image/png' }],
                },
              },
            ],
          },
        ],
      } as unknown as LanguageModelV3CallOptions;

      await wrapped.doStream(options);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const value = passed.prompt[0].content[0].output.value;

      expect(value).toEqual([{ type: 'image-data', data: 'iVBORw0KGgo=', mediaType: 'image/png' }]);
    });
  });
});
