import { openai } from '@ai-sdk/openai-v5';
import { describe, it, expect } from 'vitest';
import { RequestContext } from '../../request-context';
import { AISDKV5LanguageModel } from './aisdk/v5/model';
import { ModelByInputTokens, OM_INPUT_TOKENS_KEY } from './model-by-input-tokens';
import { resolveModelConfig } from './resolve-model';
import { ModelRouterLanguageModel } from './router';

describe('resolveModelConfig', () => {
  it('should resolve a magic string to ModelRouterLanguageModel', async () => {
    const result = await resolveModelConfig('openai/gpt-4o');
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should resolve a config object to ModelRouterLanguageModel', async () => {
    const result = await resolveModelConfig({
      id: 'openai/gpt-4o',
      apiKey: 'test-key',
    });
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should return a LanguageModel instance as-is', async () => {
    const model = openai('gpt-4o');
    const result = await resolveModelConfig(model);
    expect(result).toBeInstanceOf(AISDKV5LanguageModel);
    expect(result.modelId).toBe('gpt-4o');
    expect(result.provider).toBe('openai.responses');
    expect(result.specificationVersion).toBe('v2');
  });

  it('should resolve a dynamic function returning a string', async () => {
    const dynamicFn = () => 'openai/gpt-4o';
    const result = await resolveModelConfig(dynamicFn);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should resolve a dynamic function returning a config object', async () => {
    const dynamicFn = () =>
      ({
        id: 'openai/gpt-4o',
        apiKey: 'test-key',
      }) as const;
    const result = await resolveModelConfig(dynamicFn);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should resolve a dynamic function returning a LanguageModel', async () => {
    const model = openai('gpt-4o');
    const dynamicFn = () => model;
    const result = await resolveModelConfig(dynamicFn);
    expect(result).toBeInstanceOf(AISDKV5LanguageModel);
    expect(result.modelId).toBe('gpt-4o');
    expect(result.provider).toBe('openai.responses');
    expect(result.specificationVersion).toBe('v2');
  });

  it('should pass requestContext to dynamic function', async () => {
    const requestContext = new RequestContext();
    requestContext.set('preferredModel', 'anthropic/claude-3-opus');

    const dynamicFn = ({ requestContext: ctx }) => {
      return ctx.get('preferredModel');
    };

    const result = await resolveModelConfig(dynamicFn, requestContext);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
    expect(result.modelId).toBe(`claude-3-opus`);
    expect(result.provider).toBe(`anthropic`);
  });

  it('should throw error for invalid config', async () => {
    await expect(resolveModelConfig({} as any)).rejects.toThrow('Invalid model configuration');
  });

  describe('unknown specificationVersion handling', () => {
    it('should wrap a model with unknown specificationVersion as AISDKV5LanguageModel when it has doStream/doGenerate', async () => {
      const model = {
        specificationVersion: 'v4',
        provider: 'ollama.responses',
        modelId: 'llama3.2',
        supportedUrls: {},
        doGenerate: async () => ({}),
        doStream: async () => ({}),
      };
      const result = await resolveModelConfig(model as any);
      expect(result).toBeInstanceOf(AISDKV5LanguageModel);
      expect(result.specificationVersion).toBe('v2');
      expect(result.modelId).toBe('llama3.2');
      expect(result.provider).toBe('ollama.responses');
    });

    it('should pass through a model with unknown specificationVersion when it lacks doStream/doGenerate', async () => {
      const model = {
        specificationVersion: 'v4',
        provider: 'test',
        modelId: 'test-model',
      };
      const result = await resolveModelConfig(model as any);
      expect(result).not.toBeInstanceOf(AISDKV5LanguageModel);
      expect(result).toBe(model);
    });

    it('should still wrap v1 models as legacy (no AISDKV5LanguageModel wrapping)', async () => {
      const model = {
        specificationVersion: 'v1',
        provider: 'test',
        modelId: 'test-model',
        doGenerate: async () => ({}),
        doStream: async () => ({}),
      };
      const result = await resolveModelConfig(model as any);
      expect(result).not.toBeInstanceOf(AISDKV5LanguageModel);
      expect(result).toBe(model);
    });
  });

  describe('custom OpenAI-compatible config objects', () => {
    describe('using id format (provider/model)', () => {
      it('should resolve a custom config with id, url, and apiKey', async () => {
        const result = await resolveModelConfig({
          id: 'custom-provider/my-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'custom-api-key',
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('my-model');
        expect(result.provider).toBe('custom-provider');
      });

      it('should resolve a custom config with custom headers', async () => {
        const result = await resolveModelConfig({
          id: 'custom-provider/my-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'custom-api-key',
          headers: {
            'x-custom-header': 'custom-value',
            'x-api-version': '2024-01',
          },
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('my-model');
        expect(result.provider).toBe('custom-provider');
      });

      it('should resolve a custom config without apiKey (for public endpoints)', async () => {
        const result = await resolveModelConfig({
          id: 'public-provider/public-model',
          url: 'https://public-api.example.com/v1/chat/completions',
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('public-model');
        expect(result.provider).toBe('public-provider');
      });
    });

    describe('using providerId/modelId format', () => {
      it('should resolve a custom config with providerId, modelId, url, and apiKey', async () => {
        const result = await resolveModelConfig({
          providerId: 'custom-provider',
          modelId: 'my-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'custom-api-key',
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('my-model');
        expect(result.provider).toBe('custom-provider');
      });

      it('should resolve a custom config with custom headers', async () => {
        const result = await resolveModelConfig({
          providerId: 'custom-provider',
          modelId: 'my-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'custom-api-key',
          headers: {
            'x-custom-header': 'custom-value',
            'x-api-version': '2024-01',
          },
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('my-model');
        expect(result.provider).toBe('custom-provider');
      });

      it('should resolve a custom config without apiKey (for public endpoints)', async () => {
        const result = await resolveModelConfig({
          providerId: 'public-provider',
          modelId: 'public-model',
          url: 'https://public-api.example.com/v1/chat/completions',
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('public-model');
        expect(result.provider).toBe('public-provider');
      });
    });

    describe('dynamic functions', () => {
      it('should resolve a dynamic function returning id format', async () => {
        const dynamicFn = () =>
          ({
            id: 'dynamic-provider/dynamic-model',
            url: 'https://api.mycompany.com/v1/chat/completions',
            apiKey: 'dynamic-api-key',
          }) as const;
        const result = await resolveModelConfig(dynamicFn);
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('dynamic-model');
        expect(result.provider).toBe('dynamic-provider');
      });

      it('should resolve a dynamic function returning providerId/modelId format', async () => {
        const dynamicFn = () => ({
          providerId: 'dynamic-provider',
          modelId: 'dynamic-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'dynamic-api-key',
        });
        const result = await resolveModelConfig(dynamicFn);
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('dynamic-model');
        expect(result.provider).toBe('dynamic-provider');
      });

      it('should resolve a custom config selected from request context', async () => {
        const requestContext = new RequestContext();
        requestContext.set('customEndpoint', 'https://api.mycompany.com/v1/chat/completions');
        requestContext.set('customApiKey', 'context-api-key');

        const dynamicFn = ({ requestContext: ctx }) => ({
          providerId: 'context-provider',
          modelId: 'context-model',
          url: ctx.get('customEndpoint'),
          apiKey: ctx.get('customApiKey'),
        });

        const result = await resolveModelConfig(dynamicFn, requestContext);
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('context-model');
        expect(result.provider).toBe('context-provider');
      });
    });
  });
});

describe('ModelByInputTokens', () => {
  describe('constructor validation', () => {
    it('should throw if upTo is empty', () => {
      expect(() => new ModelByInputTokens({ upTo: {} })).toThrow('ModelByInputTokens requires at least one threshold');
    });

    it('should throw if threshold key is not a positive number', () => {
      expect(() => new ModelByInputTokens({ upTo: { ['-100']: 'model-a' } })).toThrow(
        'threshold keys must be positive numbers',
      );
      expect(() => new ModelByInputTokens({ upTo: { 0: 'model-a' } })).toThrow(
        'threshold keys must be positive numbers',
      );
      expect(() => new ModelByInputTokens({ upTo: { abc: 'model-a' } as any })).toThrow(
        'threshold keys must be positive numbers',
      );
    });
  });

  describe('resolve()', () => {
    it('should select the model for the smallest threshold that covers inputTokens', async () => {
      const selector = new ModelByInputTokens({
        upTo: {
          10_000: 'openai/gpt-4o-mini',
          40_000: 'openai/gpt-4o',
          1_000_000: 'openai/gpt-4.5',
        },
      });

      const ctx10k = new RequestContext();
      ctx10k.set(OM_INPUT_TOKENS_KEY, 5_000);
      const result10k = await resolveModelConfig(selector, ctx10k);
      expect(result10k).toBeInstanceOf(ModelRouterLanguageModel);
      expect(result10k.modelId).toBe('gpt-4o-mini');

      const ctx40k = new RequestContext();
      ctx40k.set(OM_INPUT_TOKENS_KEY, 25_000);
      const result40k = await resolveModelConfig(selector, ctx40k);
      expect(result40k).toBeInstanceOf(ModelRouterLanguageModel);
      expect(result40k.modelId).toBe('gpt-4o');

      const ctx100k = new RequestContext();
      ctx100k.set(OM_INPUT_TOKENS_KEY, 100_000);
      const result100k = await resolveModelConfig(selector, ctx100k);
      expect(result100k).toBeInstanceOf(ModelRouterLanguageModel);
      expect(result100k.modelId).toBe('gpt-4.5');
    });

    it('should handle boundary conditions (exact threshold match)', async () => {
      const selector = new ModelByInputTokens({
        upTo: {
          10_000: 'openai/gpt-4o-mini',
          40_000: 'openai/gpt-4o',
        },
      });

      const ctx = new RequestContext();
      ctx.set(OM_INPUT_TOKENS_KEY, 10_000);
      const result = await resolveModelConfig(selector, ctx);
      expect(result).toBeInstanceOf(ModelRouterLanguageModel);
      expect(result.modelId).toBe('gpt-4o-mini');
    });

    it('should throw when inputTokens exceeds the largest threshold', async () => {
      const selector = new ModelByInputTokens({
        upTo: {
          10_000: 'openai/gpt-4o-mini',
          40_000: 'openai/gpt-4o',
        },
      });

      const ctx = new RequestContext();
      ctx.set(OM_INPUT_TOKENS_KEY, 50_000);
      await expect(resolveModelConfig(selector, ctx)).rejects.toThrow('exceeds the largest configured threshold');
    });

    it('should throw when requestContext lacks omInputTokens', async () => {
      const selector = new ModelByInputTokens({
        upTo: {
          10_000: 'openai/gpt-4o-mini',
        },
      });

      const ctx = new RequestContext();
      await expect(resolveModelConfig(selector, ctx)).rejects.toThrow(
        `"${OM_INPUT_TOKENS_KEY}" to be set in requestContext`,
      );
    });

    it('should accept config objects as model targets', async () => {
      const selector = new ModelByInputTokens({
        upTo: {
          10_000: { id: 'openai/gpt-4o-mini', apiKey: 'test-key' },
          40_000: { id: 'openai/gpt-4o', apiKey: 'test-key' },
        },
      });

      const ctx = new RequestContext();
      ctx.set(OM_INPUT_TOKENS_KEY, 5_000);
      const result = await resolveModelConfig(selector, ctx);
      expect(result).toBeInstanceOf(ModelRouterLanguageModel);
      expect(result.modelId).toBe('gpt-4o-mini');
    });

    it('should accept LanguageModel instances as model targets', async () => {
      const smallModel = openai('gpt-4o-mini');
      const largeModel = openai('gpt-4o');

      const selector = new ModelByInputTokens({
        upTo: {
          10_000: smallModel,
          40_000: largeModel,
        },
      });

      const ctx = new RequestContext();
      ctx.set(OM_INPUT_TOKENS_KEY, 5_000);
      const result = await resolveModelConfig(selector, ctx);
      expect(result).toBeInstanceOf(AISDKV5LanguageModel);
      expect(result.modelId).toBe('gpt-4o-mini');
    });

    it('should sort thresholds internally regardless of input order', async () => {
      // Deliberately pass thresholds out of order
      const selector = new ModelByInputTokens({
        upTo: {
          100_000: 'openai/gpt-4o',
          1_000: 'openai/gpt-4o-mini',
          10_000: 'openai/gpt-4o-mini',
        },
      });

      expect(selector.getThresholds()).toEqual([1_000, 10_000, 100_000]);

      const ctx = new RequestContext();
      ctx.set(OM_INPUT_TOKENS_KEY, 5_000);
      const result = await resolveModelConfig(selector, ctx);
      expect(result).toBeInstanceOf(ModelRouterLanguageModel);
      expect(result.modelId).toBe('gpt-4o-mini');
    });
  });
});
