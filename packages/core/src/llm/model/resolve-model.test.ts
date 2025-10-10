import { openai } from '@ai-sdk/openai-v5';
import { describe, it, expect } from 'vitest';
import { RuntimeContext } from '../../runtime-context';
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
    expect(result).toBe(model);
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
    expect(result).toBe(model);
  });

  it('should pass runtimeContext to dynamic function', async () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('preferredModel', 'anthropic/claude-3-opus');

    const dynamicFn = ({ runtimeContext: ctx }) => {
      return ctx.get('preferredModel');
    };

    const result = await resolveModelConfig(dynamicFn, runtimeContext);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
    expect(result.modelId).toBe(`claude-3-opus`);
    expect(result.provider).toBe(`anthropic`);
  });

  it('should throw error for invalid config', async () => {
    await expect(resolveModelConfig({} as any)).rejects.toThrow('Invalid model configuration');
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

      it('should resolve a custom config selected from runtime context', async () => {
        const runtimeContext = new RuntimeContext();
        runtimeContext.set('customEndpoint', 'https://api.mycompany.com/v1/chat/completions');
        runtimeContext.set('customApiKey', 'context-api-key');

        const dynamicFn = ({ runtimeContext: ctx }) => ({
          providerId: 'context-provider',
          modelId: 'context-model',
          url: ctx.get('customEndpoint'),
          apiKey: ctx.get('customApiKey'),
        });

        const result = await resolveModelConfig(dynamicFn, runtimeContext);
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('context-model');
        expect(result.provider).toBe('context-provider');
      });
    });
  });
});
