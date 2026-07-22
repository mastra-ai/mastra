import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import type {
  GatewayLanguageModel,
  MastraModelGatewayInterface,
  ProviderConfig,
  GatewayAuthRequest,
  GatewayAuthResult,
} from '../llm/model/gateways';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

/**
 * Minimal in-memory gateway used to drive the AgentController model catalog without
 * hitting the network. `fetchProviders` is a vi.fn so tests can assert caching.
 */
function createFakeGateway(options?: {
  models?: string[];
  apiKeyEnvVar?: string;
  resolveAuth?: (request: GatewayAuthRequest) => GatewayAuthResult | undefined;
}): MastraModelGatewayInterface & { fetchProviders: ReturnType<typeof vi.fn> } {
  const models = options?.models ?? ['sonic-fast'];
  const fetchProviders = vi.fn(async (): Promise<Record<string, ProviderConfig>> => ({
    acme: {
      name: 'Acme',
      models,
      apiKeyEnvVar: options?.apiKeyEnvVar ?? 'ACME_API_KEY',
      gateway: 'test-gateway',
    },
  }));

  return {
    id: 'test-gateway',
    name: 'Test Gateway',
    fetchProviders,
    buildUrl: () => 'https://example.com/v1',
    // Mirror real gateways (e.g. models.dev): throw when no key is configured.
    getApiKey: async () => {
      throw new Error('no api key');
    },
    resolveAuth: options?.resolveAuth,
    resolveLanguageModel: () => ({}) as GatewayLanguageModel,
  };
}

function createController(gateway: MastraModelGatewayInterface, defaultModelId?: string) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId }],
    gateways: [gateway],
    omConfig: defaultModelId ? { defaultObserverModelId: defaultModelId } : undefined,
    modelUseCountProvider: () => ({
      'test-gateway/acme/sonic-fast': 3,
      'test-gateway/acme/new-model': 11,
    }),
  });
}

describe('AgentController.listAvailableModels', () => {
  // The catalog is built purely from gateways: the configured fake gateway plus
  // the router defaults (models.dev / Netlify), which fetch over the network.
  // Stub fetch so those defaults contribute nothing and the test stays hermetic.
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network disabled in test');
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the catalog from gateway providers and caches/refreshes fetchProviders', async () => {
    const gateway = createFakeGateway({ models: ['sonic-fast'] });
    const controller = createController(gateway);

    const firstModels = await controller.listAvailableModels();
    expect(firstModels.find(model => model.id === 'test-gateway/acme/sonic-fast')).toMatchObject({
      id: 'test-gateway/acme/sonic-fast',
      provider: 'test-gateway/acme',
      modelName: 'sonic-fast',
      hasApiKey: false,
      apiKeyEnvVar: 'ACME_API_KEY',
      useCount: 3,
    });

    // Second call is served from cache — fetchProviders not re-invoked.
    await controller.listAvailableModels();
    expect(gateway.fetchProviders).toHaveBeenCalledTimes(1);

    // After invalidation, updated gateway models are reflected.
    gateway.fetchProviders.mockResolvedValueOnce({
      acme: { name: 'Acme', models: ['new-model'], apiKeyEnvVar: 'ACME_API_KEY', gateway: 'test-gateway' },
    });
    controller.invalidateAvailableModelsCache();

    const refreshed = await controller.listAvailableModels();
    expect(gateway.fetchProviders).toHaveBeenCalledTimes(2);
    expect(refreshed.find(model => model.id === 'test-gateway/acme/new-model')).toMatchObject({
      provider: 'test-gateway/acme',
      modelName: 'new-model',
      hasApiKey: false,
      useCount: 11,
    });
    expect(refreshed.find(model => model.id === 'test-gateway/acme/sonic-fast')).toBeUndefined();
  });

  it('marks models authenticated when the gateway can resolve auth', async () => {
    const gateway = createFakeGateway({
      resolveAuth: () => ({ apiKey: 'oauth-key', source: 'gateway' }),
    });
    const controller = createController(gateway, 'test-gateway/acme/sonic-fast');

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const observerModel = session.om.observer.resolvedModel() as { gatewayId?: string; provider?: string };
    expect(observerModel).toMatchObject({ gatewayId: 'test-gateway', provider: 'acme' });

    const models = await controller.listAvailableModels();
    expect(models.find(model => model.id === 'test-gateway/acme/sonic-fast')).toMatchObject({
      hasApiKey: true,
    });
  });

  it('resolves the observer model through the configured gateways', async () => {
    const gateway = createFakeGateway();
    const controller = createController(gateway, 'test-gateway/acme/sonic-fast');
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const observerModel = session.om.observer.resolvedModel() as { gatewayId?: string; provider?: string };
    expect(observerModel?.gatewayId).toBe('test-gateway');
    expect(observerModel?.provider).toBe('acme');
  });

  it('getCurrentModelAuthStatus reflects gateway auth resolution', async () => {
    const authedGateway = createFakeGateway({
      resolveAuth: () => ({ apiKey: 'oauth-key', source: 'gateway' }),
    });
    const authedController = createController(authedGateway, 'test-gateway/acme/sonic-fast');
    await authedController.init();
    const authedSession = await authedController.createSession({ id: 'test-session', ownerId: 'test-owner' });
    authedSession.model.set({ modelId: 'test-gateway/acme/sonic-fast' });

    const authedStatus = await authedController.getCurrentModelAuthStatus(authedSession);
    expect(authedStatus.hasAuth).toBe(true);

    // Without auth configured (getApiKey throws), hasAuth should be false.
    const unauthedGateway = createFakeGateway(); // throws on getApiKey, no resolveAuth
    const unauthedController = createController(unauthedGateway, 'test-gateway/acme/sonic-fast');
    await unauthedController.init();
    const unauthedSession = await unauthedController.createSession({ id: 'test-session', ownerId: 'test-owner' });
    unauthedSession.model.set({ modelId: 'test-gateway/acme/sonic-fast' });

    const unauthedStatus = await unauthedController.getCurrentModelAuthStatus(unauthedSession);
    expect(unauthedStatus.hasAuth).toBe(false);
  });

  it('getCurrentModelAuthStatus defaults to hasAuth true when no model is selected', async () => {
    const gateway = createFakeGateway();
    const controller = createController(gateway);
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const status = await controller.getCurrentModelAuthStatus(session);
    expect(status).toEqual({ hasAuth: true });
  });

  it('getCurrentModelAuthStatus falls back to hasAuth false when the gateway throws an unexpected error', async () => {
    // resolveAuth throws a non-missing-auth error (e.g. a token-exchange failure).
    // hasAuth rethrows it, but getCurrentModelAuthStatus should catch it so the
    // UI auth-status endpoint stays stable instead of erroring.
    const gateway = createFakeGateway({
      resolveAuth: () => {
        throw new Error('token exchange failed');
      },
    });
    const controller = createController(gateway, 'test-gateway/acme/sonic-fast');
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.model.set({ modelId: 'test-gateway/acme/sonic-fast' });

    const status = await controller.getCurrentModelAuthStatus(session);
    expect(status.hasAuth).toBe(false);
  });
});
