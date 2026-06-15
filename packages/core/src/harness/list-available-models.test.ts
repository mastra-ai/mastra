import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import type { CustomModelCatalogProvider } from './types';
import { Harness } from './harness';

function createHarness(customModelCatalogProvider: CustomModelCatalogProvider) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    customModelCatalogProvider,
    modelUseCountProvider: () => ({
      'openai/gpt-4o': 7,
      'acme/sonic-fast': 3,
      'acme/new-model': 11,
    }),
  });
}

describe('Harness.listAvailableModels', () => {
  it('merges custom catalog models, lets duplicate IDs override built-ins, and refreshes after cache invalidation', async () => {
    let customModels = [
      {
        id: 'openai/gpt-4o',
        provider: 'acme-openai',
        modelName: 'gpt-4o-compatible',
        hasApiKey: true,
        apiKeyEnvVar: 'ACME_API_KEY',
      },
      {
        id: 'acme/sonic-fast',
        provider: 'acme',
        modelName: 'sonic-fast',
        hasApiKey: false,
      },
    ];
    const customModelCatalogProvider = vi.fn(() => customModels);
    const harness = createHarness(customModelCatalogProvider);

    const firstModels = await harness.listAvailableModels();
    const overriddenBuiltin = firstModels.find(model => model.id === 'openai/gpt-4o');
    expect(overriddenBuiltin).toMatchObject({
      id: 'openai/gpt-4o',
      provider: 'acme-openai',
      modelName: 'gpt-4o-compatible',
      hasApiKey: true,
      apiKeyEnvVar: 'ACME_API_KEY',
      useCount: 7,
    });
    expect(firstModels.find(model => model.id === 'acme/sonic-fast')).toMatchObject({
      provider: 'acme',
      modelName: 'sonic-fast',
      hasApiKey: false,
      useCount: 3,
    });

    await harness.listAvailableModels();
    expect(customModelCatalogProvider).toHaveBeenCalledTimes(1);

    customModels = [
      {
        id: 'acme/new-model',
        provider: 'acme',
        modelName: 'new-model',
        hasApiKey: true,
      },
    ];
    harness.invalidateAvailableModelsCache();

    const refreshedModels = await harness.listAvailableModels();
    expect(customModelCatalogProvider).toHaveBeenCalledTimes(2);
    expect(refreshedModels.find(model => model.id === 'acme/new-model')).toMatchObject({
      provider: 'acme',
      modelName: 'new-model',
      hasApiKey: true,
      useCount: 11,
    });
    expect(refreshedModels.find(model => model.id === 'acme/sonic-fast')).toBeUndefined();
  });

  it('uses app-provided model catalog and resolver hooks for gateway-backed models', async () => {
    const resolveModel = vi.fn(modelId => ({ modelId }));
    const customModelCatalogProvider = vi.fn(() => [
      {
        id: 'test-gateway/acme/sonic-fast',
        provider: 'test-gateway/acme',
        modelName: 'sonic-fast',
        hasApiKey: true,
        apiKeyEnvVar: 'ACME_API_KEY',
      },
    ]);

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a test agent.',
      model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
    });
    const harness = new Harness({
      id: 'test-harness',
      storage: new InMemoryStore(),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent,
          defaultModelId: 'test-gateway/acme/sonic-fast',
        },
      ],
      resolveModel,
      customModelCatalogProvider,
      omConfig: {
        defaultObserverModelId: 'test-gateway/acme/sonic-fast',
      },
    });

    const observerModel = harness.getResolvedObserverModel() as { modelId?: string };
    expect(observerModel).toMatchObject({ modelId: 'test-gateway/acme/sonic-fast' });
    expect(resolveModel).toHaveBeenCalledWith('test-gateway/acme/sonic-fast');

    const models = await harness.listAvailableModels();
    expect(models.find(model => model.id === 'test-gateway/acme/sonic-fast')).toMatchObject({
      provider: 'test-gateway/acme',
      modelName: 'sonic-fast',
      hasApiKey: true,
      apiKeyEnvVar: 'ACME_API_KEY',
    });

    await expect(harness.getCurrentModelAuthStatus()).resolves.toEqual({ hasAuth: true, apiKeyEnvVar: undefined });
  });
});
