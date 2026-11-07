import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGatewayClient } from './gateway-memory-client.js';

describe('Gateway memory client in v2 deployments', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does not call the v1 memory API when the deployment uses Gateway v2', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', 'v2');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-gateway-managed');
    expect(getGatewayClient()).toBeNull();
  });
});
