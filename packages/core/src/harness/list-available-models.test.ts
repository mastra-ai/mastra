import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createHarness(customModelCatalogProvider: () => unknown[]) {
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
});
