import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import type { MastraModelGatewayInterface } from '../llm/model/gateways';
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

  it('includes gateway-discovered models and resolves their auth through the gateway', async () => {
    const gateway: MastraModelGatewayInterface = {
      id: 'test-gateway',
      name: 'Test Gateway',
      fetchProviders: vi.fn(async () => ({
        acme: {
          name: 'Acme',
          url: 'https://gateway.example.com/acme',
          apiKeyHeader: 'Authorization',
          apiKeyEnvVar: 'ACME_API_KEY',
          models: ['sonic-fast'],
          gateway: 'test-gateway',
        },
      })),
      buildUrl: vi.fn(modelId => modelId),
      getApiKey: vi.fn(async () => ''),
      resolveLanguageModel: vi.fn(),
      resolveAuth: vi.fn(async ({ gatewayId, providerId, modelId, routerId }) => {
        if (
          gatewayId === 'test-gateway' &&
          providerId === 'acme' &&
          modelId === 'sonic-fast' &&
          routerId === 'test-gateway/acme/sonic-fast'
        ) {
          return { apiKey: 'test-key', source: 'gateway' as const };
        }
        return undefined;
      }),
    };

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
      gateways: [gateway],
      omConfig: {
        defaultObserverModelId: 'test-gateway/acme/sonic-fast',
      },
    });

    const observerModel = harness.getResolvedObserverModel() as { gatewayId?: string; provider?: string; modelId?: string };
    expect(observerModel).toMatchObject({
      gatewayId: 'test-gateway',
      provider: 'acme',
      modelId: 'sonic-fast',
    });

    const models = await harness.listAvailableModels();
    expect(models.find(model => model.id === 'test-gateway/acme/sonic-fast')).toMatchObject({
      provider: 'test-gateway/acme',
      modelName: 'sonic-fast',
      hasApiKey: true,
      apiKeyEnvVar: 'ACME_API_KEY',
    });
    expect(gateway.resolveAuth).toHaveBeenCalledWith({
      gatewayId: 'test-gateway',
      providerId: 'acme',
      modelId: 'sonic-fast',
      routerId: 'test-gateway/acme/sonic-fast',
    });

    await expect(harness.getCurrentModelAuthStatus()).resolves.toEqual({ hasAuth: true });
  });
});
