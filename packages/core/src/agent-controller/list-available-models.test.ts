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
import type { AvailableModel } from './types';

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
  const fetchProviders = vi.fn(
    async (): Promise<Record<string, ProviderConfig>> => ({
      acme: {
        name: 'Acme',
        models,
        apiKeyEnvVar: options?.apiKeyEnvVar ?? 'ACME_API_KEY',
        gateway: 'test-gateway',
      },
    }),
  );

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

function createController(
  gateway: MastraModelGatewayInterface | MastraModelGatewayInterface[],
  defaultModelId?: string,
  useCounts: () => Record<string, number> = () => ({
    'test-gateway/acme/sonic-fast': 3,
    'test-gateway/acme/new-model': 11,
  }),
) {
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
    gateways: [gateway].flat(),
    omConfig: defaultModelId ? { defaultObserverModelId: defaultModelId } : undefined,
    modelUseCountProvider: useCounts,
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

describe('AgentController.listAvailableModels catalog refresh', () => {
  // models.dev is a third-party API, so it is stubbed at the wire: the real
  // router gateways (models.dev, Netlify) parse these responses.
  const MODELS_DEV_URL = 'https://models.dev/api.json';
  let modelsDev: { calls: number; respond: () => Promise<Response> };
  let netlify: { calls: number; respond: () => Promise<Response> };

  function modelsDevCatalog(models: string[]): Response {
    return Response.json({
      'acme-cloud': {
        id: 'acme-cloud',
        name: 'Acme Cloud',
        env: ['ACME_CLOUD_API_KEY'],
        api: 'https://api.acme.test/v1',
        npm: '@ai-sdk/openai-compatible',
        models: Object.fromEntries(models.map(id => [id, { id }])),
      },
    });
  }

  const advance = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));
  const ids = (models: AvailableModel[]) => models.map(model => model.id);
  const rocket = (models: AvailableModel[]) => models.find(model => model.id === 'acme-cloud/rocket-1');
  /** Fails fast instead of hanging when a call waits on a download it should not wait for. */
  const withinOneSecond = <T>(promise: Promise<T>) =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('listAvailableModels waited for the models.dev download')), 1000),
      ),
    ]);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T09:00:00Z'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    modelsDev = { calls: 0, respond: async () => modelsDevCatalog(['rocket-1']) };
    netlify = { calls: 0, respond: async () => Response.json({ providers: {} }) };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === MODELS_DEV_URL) {
          modelsDev.calls += 1;
          return modelsDev.respond();
        }
        if (url.startsWith('https://api.netlify.com/')) {
          netlify.calls += 1;
          return netlify.respond();
        }
        throw new Error(`unexpected request in test: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.ACME_CLOUD_API_KEY;
  });

  it('reopening the model list later does not download models.dev again', async () => {
    const gateway = createFakeGateway();
    const controller = createController(gateway);

    expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-1');
    advance(30_000);
    expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-1');

    expect(modelsDev.calls).toBe(1);
    // Configured gateways can read state the app changes at runtime, so they keep refreshing.
    expect(gateway.fetchProviders).toHaveBeenCalledTimes(2);
  });

  it('requests that arrive together share one models.dev download', async () => {
    const controller = createController(createFakeGateway());

    const [first, second] = await Promise.all([controller.listAvailableModels(), controller.listAvailableModels()]);

    expect(ids(first)).toContain('acme-cloud/rocket-1');
    expect(ids(second)).toContain('acme-cloud/rocket-1');
    expect(modelsDev.calls).toBe(1);
  });

  it('answers from the previous models while a newer models.dev catalog downloads', async () => {
    const controller = createController(createFakeGateway());
    await controller.listAvailableModels();

    advance(6 * 60_000);
    let finishDownload!: () => void;
    modelsDev.respond = () =>
      new Promise(resolve => {
        finishDownload = () => resolve(modelsDevCatalog(['rocket-1', 'rocket-2']));
      });

    const whileDownloading = await withinOneSecond(controller.listAvailableModels());
    expect(ids(whileDownloading)).toContain('acme-cloud/rocket-1');
    expect(ids(whileDownloading)).not.toContain('acme-cloud/rocket-2');
    expect(modelsDev.calls).toBe(2);

    finishDownload();
    await vi.waitFor(async () => {
      expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-2');
    });
    expect(modelsDev.calls).toBe(2);
  });

  it('keeps models.dev models through a models.dev outage and retries a minute later', async () => {
    const controller = createController(createFakeGateway());
    await controller.listAvailableModels();

    advance(6 * 60_000);
    modelsDev.respond = async () => new Response('upstream unavailable', { status: 503 });
    await controller.listAvailableModels();
    await vi.waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('models.dev'), expect.anything()),
    );

    advance(30_000);
    expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-1');
    expect(modelsDev.calls).toBe(2);

    modelsDev.respond = async () => modelsDevCatalog(['rocket-1', 'rocket-2']);
    advance(31_000);
    await controller.listAvailableModels();
    await vi.waitFor(async () => {
      expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-2');
    });
    expect(modelsDev.calls).toBe(3);
  });

  it('keeps refreshing models.dev while a Netlify download hangs', async () => {
    const controller = createController(createFakeGateway());
    await controller.listAvailableModels();

    advance(6 * 60_000);
    netlify.respond = () => new Promise(() => {});
    modelsDev.respond = async () => modelsDevCatalog(['rocket-1', 'rocket-2']);
    await withinOneSecond(controller.listAvailableModels());
    await vi.waitFor(async () => {
      expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-2');
    });

    advance(6 * 60_000);
    modelsDev.respond = async () => modelsDevCatalog(['rocket-1', 'rocket-2', 'rocket-3']);
    await withinOneSecond(controller.listAvailableModels());
    await vi.waitFor(async () => {
      expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-3');
    });
    expect(modelsDev.calls).toBe(3);
    // Still one Netlify download in flight, not a new one per refresh.
    expect(netlify.calls).toBe(2);
  });

  it('waits for models.dev while it has never answered, so the first call after an outage lists its models', async () => {
    modelsDev.respond = async () => new Response('upstream unavailable', { status: 503 });
    const controller = createController(createFakeGateway());
    expect(ids(await controller.listAvailableModels())).not.toContain('acme-cloud/rocket-1');

    modelsDev.respond = async () => modelsDevCatalog(['rocket-1']);
    advance(11_000);
    expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-1');
    expect(modelsDev.calls).toBe(2);
  });

  it('notices a key set outside the app after the short window, without downloading models.dev again', async () => {
    const controller = createController(createFakeGateway());
    expect(rocket(await controller.listAvailableModels())).toMatchObject({
      hasApiKey: false,
      apiKeyEnvVar: 'ACME_CLOUD_API_KEY',
    });

    process.env.ACME_CLOUD_API_KEY = 'sk-acme';
    advance(11_000);
    expect(rocket(await controller.listAvailableModels())).toMatchObject({ hasApiKey: true });
    expect(modelsDev.calls).toBe(1);
  });

  it('after invalidation, shows a key change right away and downloads models.dev again in the background', async () => {
    process.env.ACME_CLOUD_API_KEY = 'sk-acme';
    const controller = createController(createFakeGateway());
    expect(rocket(await controller.listAvailableModels())).toMatchObject({ hasApiKey: true });

    const download = Promise.withResolvers<Response>();
    modelsDev.respond = () => download.promise;
    delete process.env.ACME_CLOUD_API_KEY;
    controller.invalidateAvailableModelsCache();

    expect(rocket(await withinOneSecond(controller.listAvailableModels()))).toMatchObject({ hasApiKey: false });
    expect(modelsDev.calls).toBe(2);

    download.resolve(modelsDevCatalog(['rocket-1', 'rocket-2']));
    await vi.waitFor(async () => {
      expect(ids(await controller.listAvailableModels())).toContain('acme-cloud/rocket-2');
    });
  });

  it('loads configured gateways one after another, so each sees what the previous one wrote', async () => {
    let credentialWritten = false;
    const writer = createFakeGateway();
    writer.fetchProviders.mockImplementation(async () => {
      await Promise.resolve();
      credentialWritten = true;
      return {};
    });
    let readAfterWrite: boolean | undefined;
    const reader = { ...createFakeGateway(), id: 'reader-gateway' };
    reader.fetchProviders.mockImplementation(async () => {
      readAfterWrite = credentialWritten;
      return {};
    });

    await createController([writer, reader]).listAvailableModels();

    expect(readAfterWrite).toBe(true);
  });

  it('reports current use counts on every call', async () => {
    const useCounts: Record<string, number> = { 'acme-cloud/rocket-1': 1 };
    const controller = createController(createFakeGateway(), undefined, () => useCounts);
    expect(rocket(await controller.listAvailableModels())?.useCount).toBe(1);

    useCounts['acme-cloud/rocket-1'] = 2;
    expect(rocket(await controller.listAvailableModels())?.useCount).toBe(2);
  });
});
