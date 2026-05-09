import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it, vi } from 'vitest';
import { AISDKV5LanguageModel } from './model';

function createMockV2Model() {
  return {
    specificationVersion: 'v2',
    provider: 'openai-compatible',
    modelId: 'test-model',
    defaultObjectGenerationMode: 'json',
    supportsStructuredOutputs: true,
    supportsImageUrls: true,
    supportedUrls: {},
    doGenerate: vi.fn().mockResolvedValue({
      text: 'ok',
      content: [],
      warnings: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      finishReason: 'stop',
      request: {},
      response: { id: 'resp_1', modelId: 'test-model' },
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      request: {},
      response: { id: 'resp_1', modelId: 'test-model' },
    }),
  } as unknown as LanguageModelV2;
}

describe('AISDKV5LanguageModel', () => {
  it.each(['doGenerate', 'doStream'] as const)(
    'strips strict from function tools before calling v2 %s',
    async method => {
      const model = createMockV2Model();
      const wrapped = new AISDKV5LanguageModel(model);

      await wrapped[method]({
        inputFormat: 'messages',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        tools: [
          {
            type: 'function',
            name: 'strictTool',
            description: 'A strict tool',
            strict: true,
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      } as any);

      const call = (model[method] as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.tools[0]).not.toHaveProperty('strict');
    },
  );

  it.each(['doGenerate', 'doStream'] as const)(
    'injects strictJsonSchema into openai providerOptions when a tool has strict: true via %s',
    async method => {
      const model = createMockV2Model();
      const wrapped = new AISDKV5LanguageModel(model);

      await wrapped[method]({
        inputFormat: 'messages',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        tools: [
          {
            type: 'function',
            name: 'strictTool',
            description: 'A strict tool',
            strict: true,
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      } as any);

      const call = (model[method] as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.providerOptions?.openai?.strictJsonSchema).toBe(true);
    },
  );

  it.each(['doGenerate', 'doStream'] as const)(
    'does not inject strictJsonSchema when no tool has strict: true via %s',
    async method => {
      const model = createMockV2Model();
      const wrapped = new AISDKV5LanguageModel(model);

      await wrapped[method]({
        inputFormat: 'messages',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        tools: [
          {
            type: 'function',
            name: 'normalTool',
            description: 'A normal tool',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      } as any);

      const call = (model[method] as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.providerOptions?.openai?.strictJsonSchema).toBeUndefined();
    },
  );

  it.each(['doGenerate', 'doStream'] as const)(
    'does not override explicit strictJsonSchema: false via %s',
    async method => {
      const model = createMockV2Model();
      const wrapped = new AISDKV5LanguageModel(model);

      await wrapped[method]({
        inputFormat: 'messages',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        providerOptions: {
          openai: { strictJsonSchema: false },
        },
        tools: [
          {
            type: 'function',
            name: 'strictTool',
            description: 'A strict tool',
            strict: true,
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      } as any);

      const call = (model[method] as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // User explicitly set strictJsonSchema to false, should not override
      expect(call.providerOptions?.openai?.strictJsonSchema).toBe(false);
    },
  );

  describe('serializeForSpan', () => {
    it('returns only identity fields', () => {
      const model = createMockV2Model();
      const wrapped = new AISDKV5LanguageModel(
        Object.assign(model, { gatewayId: 'mastra' }) as LanguageModelV2 & { gatewayId?: string },
      );

      expect(wrapped.serializeForSpan()).toEqual({
        specificationVersion: 'v2',
        modelId: 'test-model',
        provider: 'openai-compatible',
        gatewayId: 'mastra',
      });
    });

    it('does not expose the wrapped provider SDK client', () => {
      const model = createMockV2Model();
      const wrapped = new AISDKV5LanguageModel(model);

      const serialized = JSON.stringify(wrapped.serializeForSpan());

      // supportedUrls (regex map / PromiseLike) and doGenerate/doStream
      // closures from the wrapped model should not appear.
      expect(serialized).not.toContain('supportedUrls');
      expect(serialized).not.toContain('doGenerate');
      expect(serialized).not.toContain('doStream');
    });
  });
});
