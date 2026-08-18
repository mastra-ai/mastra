import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GatewayLanguageModel, MastraModelGatewayInterface, ProviderConfig } from './gateways/base.js';
import { ModelRouterLanguageModel } from './router.js';

function createGateway() {
  return {
    id: 'test-gateway',
    name: 'Test Gateway',
    fetchProviders: vi.fn(async (): Promise<Record<string, ProviderConfig>> => ({})),
    buildUrl: vi.fn(() => 'https://api.example.com/v1'),
    getApiKey: vi.fn(async () => 'legacy-key'),
    resolveAuth: vi.fn(),
    resolveLanguageModel: vi.fn(
      ({ providerId, modelId }) =>
        ({
          specificationVersion: 'v2',
          provider: providerId,
          modelId,
          supportedUrls: {},
          doGenerate: vi.fn(),
          doStream: vi.fn(async () => ({ stream: new ReadableStream() })),
        }) as GatewayLanguageModel,
    ),
  } satisfies MastraModelGatewayInterface;
}

describe('ModelRouterLanguageModel gateway auth cache', () => {
  beforeEach(() => {
    (ModelRouterLanguageModel as unknown as { _clearCachesForTests: () => void })._clearCachesForTests();
  });

  it('creates a new model when a gateway-resolved API key rotates', async () => {
    const gateway = createGateway();
    gateway.resolveAuth
      .mockReturnValueOnce({ apiKey: 'first-key', source: 'gateway' as const })
      .mockReturnValueOnce({ apiKey: 'first-key', source: 'gateway' as const })
      .mockReturnValueOnce({ apiKey: 'rotated-key', source: 'gateway' as const });
    const router = new ModelRouterLanguageModel('test-gateway/provider/model', [gateway]);

    await router.doStream({} as any);
    await router.doStream({} as any);
    await router.doStream({} as any);

    expect(gateway.resolveAuth).toHaveBeenCalledTimes(3);
    expect(gateway.resolveLanguageModel).toHaveBeenCalledTimes(2);
    expect(gateway.resolveLanguageModel).toHaveBeenNthCalledWith(1, expect.objectContaining({ apiKey: 'first-key' }));
    expect(gateway.resolveLanguageModel).toHaveBeenNthCalledWith(2, expect.objectContaining({ apiKey: 'rotated-key' }));
  });
});
