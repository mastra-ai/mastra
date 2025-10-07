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
    const mockModel = {
      specificationVersion: 'v2' as const,
      provider: 'test',
      modelId: 'test-model',
      doGenerate: async () => ({ text: 'test' }),
    };
    const result = await resolveModelConfig(mockModel as any);
    expect(result).toBe(mockModel);
  });

  it('should resolve a dynamic function returning a string', async () => {
    const dynamicFn = () => 'openai/gpt-4o';
    const result = await resolveModelConfig(dynamicFn);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should resolve a dynamic function returning a config object', async () => {
    const dynamicFn = () => ({
      id: 'openai/gpt-4o',
      apiKey: 'test-key',
    });
    const result = await resolveModelConfig(dynamicFn);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should resolve a dynamic function returning a LanguageModel', async () => {
    const mockModel = {
      specificationVersion: 'v2' as const,
      provider: 'test',
      modelId: 'test-model',
      doGenerate: async () => ({ text: 'test' }),
    };
    const dynamicFn = () => mockModel;
    const result = await resolveModelConfig(dynamicFn as any);
    expect(result).toBe(mockModel);
  });

  it('should pass runtimeContext to dynamic function', async () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('preferredModel', 'anthropic/claude-3-opus');

    const dynamicFn = ({ runtimeContext: ctx }: any) => {
      return ctx.get('preferredModel');
    };

    const result = await resolveModelConfig(dynamicFn, runtimeContext);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should throw error for invalid config', async () => {
    await expect(resolveModelConfig({} as any)).rejects.toThrow('Invalid model configuration');
  });
});
