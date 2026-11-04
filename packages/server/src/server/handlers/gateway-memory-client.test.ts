import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadGetGatewayClient() {
  vi.resetModules();
  const mod = await import('./gateway-memory-client');
  return mod.getGatewayClient;
}

describe('getGatewayClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a client for v1 project keys', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_project_key');
    const getGatewayClient = await loadGetGatewayClient();
    expect(getGatewayClient()).not.toBeNull();
  });

  it.each(['msk-gateway-org_key', 'mskv2_org_key'])(
    'returns null for v2 key %s, whose gateway has no memory API',
    async key => {
      vi.stubEnv('MASTRA_GATEWAY_API_KEY', key);
      const getGatewayClient = await loadGetGatewayClient();
      expect(getGatewayClient()).toBeNull();
    },
  );

  it('returns null without a key', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
    const getGatewayClient = await loadGetGatewayClient();
    expect(getGatewayClient()).toBeNull();
  });
});
