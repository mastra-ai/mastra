import { describe, expect, it, vi } from 'vitest';
import type { MastraModelGatewayInterface } from './gateways/base';
import { resolveModelAuth } from './model-auth-resolver';

function createGateway(overrides: Partial<MastraModelGatewayInterface> = {}): MastraModelGatewayInterface {
  return {
    id: 'test-gateway',
    name: 'Test Gateway',
    fetchProviders: vi.fn(async () => ({})),
    buildUrl: vi.fn(() => 'https://example.com/v1'),
    getApiKey: vi.fn(async () => 'legacy-key'),
    resolveLanguageModel: vi.fn(),
    ...overrides,
  };
}

const request = {
  gatewayId: 'test-gateway',
  providerId: 'test-provider',
  modelId: 'test-model',
  routerId: 'test-gateway/test-provider/test-model',
};

describe('resolveModelAuth', () => {
  it('prefers explicit credentials over gateway hooks and legacy env lookup', async () => {
    const gateway = createGateway({
      resolveAuth: vi.fn(() => ({ apiKey: 'gateway-key' })),
      getApiKey: vi.fn(async () => 'legacy-key'),
    });
    const auth = await resolveModelAuth({
      gateway,
      request,
      explicit: { apiKey: 'explicit-key', headers: { 'x-explicit': 'true' } },
    });

    expect(auth).toMatchObject({ apiKey: 'explicit-key', headers: { 'x-explicit': 'true' }, source: 'explicit' });
    expect(gateway.resolveAuth).not.toHaveBeenCalled();
    expect(gateway.getApiKey).not.toHaveBeenCalled();
  });

  it('prefers gateway auth hooks over legacy env lookup', async () => {
    const gateway = createGateway({
      resolveAuth: vi.fn(() => ({ bearerToken: 'gateway-token' })),
      getApiKey: vi.fn(async () => 'legacy-key'),
    });
    const auth = await resolveModelAuth({ gateway, request });

    expect(auth).toMatchObject({
      bearerToken: 'gateway-token',
      headers: { Authorization: 'Bearer gateway-token' },
      source: 'gateway',
    });
    expect(gateway.resolveAuth).toHaveBeenCalledWith(request);
    expect(gateway.getApiKey).not.toHaveBeenCalled();
  });

  it('falls back to legacy getApiKey with the full router id', async () => {
    const getApiKey = vi.fn(async () => 'legacy-key');
    const gateway = createGateway({ resolveAuth: vi.fn(() => undefined), getApiKey });

    const auth = await resolveModelAuth({ gateway, request });

    expect(auth).toMatchObject({ apiKey: 'legacy-key', source: 'legacy' });
    expect(getApiKey).toHaveBeenCalledWith('test-gateway/test-provider/test-model');
  });
});
