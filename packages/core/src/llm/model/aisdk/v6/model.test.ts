import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import { describe, expect, it, vi } from 'vitest';
import { AISDKV6LanguageModel } from './model';

function createMockV3Model() {
  return {
    specificationVersion: 'v3',
    provider: 'openai',
    modelId: 'test-v3-model',
    supportedUrls: {},
    doGenerate: vi.fn().mockResolvedValue({
      content: [],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
      request: {},
      response: { id: 'test', modelId: 'test-v3-model' },
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    }),
  } as unknown as LanguageModelV3;
}

function createToolResultOptions(value: unknown[]) {
  return {
    prompt: [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'read_file',
            output: { type: 'content', value },
          },
        ],
      },
    ],
  } as any;
}

describe('AISDKV6LanguageModel', () => {
  it('remaps image tool-result media for doStream without mutating the input', async () => {
    const model = createMockV3Model();
    const wrapped = new AISDKV6LanguageModel(model);
    const options = createToolResultOptions([
      { type: 'text', text: 'image result' },
      { type: 'media', data: 'iVBORw0KGgo=', mediaType: 'image/png' },
      { type: 'image-data', data: 'already-v3', mediaType: 'image/jpeg' },
    ]);

    await wrapped.doStream(options);

    const passedOptions = vi.mocked(model.doStream).mock.calls[0]![0] as any;
    expect(passedOptions.prompt[0].content[0].output.value).toEqual([
      { type: 'text', text: 'image result' },
      { type: 'image-data', data: 'iVBORw0KGgo=', mediaType: 'image/png' },
      { type: 'image-data', data: 'already-v3', mediaType: 'image/jpeg' },
    ]);
    expect(options.prompt[0].content[0].output.value[1]).toEqual({
      type: 'media',
      data: 'iVBORw0KGgo=',
      mediaType: 'image/png',
    });
  });

  it('remaps non-image tool-result media for doGenerate and preserves other options', async () => {
    const model = createMockV3Model();
    const wrapped = new AISDKV6LanguageModel(model);
    const options = {
      ...createToolResultOptions([{ type: 'media', data: 'JVBERi0=', mediaType: 'application/pdf' }]),
      temperature: 0.2,
    };

    await wrapped.doGenerate(options);

    const passedOptions = vi.mocked(model.doGenerate).mock.calls[0]![0] as any;
    expect(passedOptions.prompt[0].content[0].output.value).toEqual([
      { type: 'file-data', data: 'JVBERi0=', mediaType: 'application/pdf' },
    ]);
    expect(passedOptions.temperature).toBe(0.2);
  });

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
