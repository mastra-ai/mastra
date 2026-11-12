import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGatewayClient, isGatewayV2 } from './gateway-memory-client.js';

describe('Gateway memory client in v2 deployments', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does not call the v1 memory API when the deployment uses Gateway v2', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', 'v2');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-gateway-managed');
    expect(getGatewayClient()).toBeNull();
  });

  it('detects v2 from an organization key prefix without MASTRA_GATEWAY_VERSION', () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'mskv2_org-key');
    expect(isGatewayV2()).toBe(true);
    expect(getGatewayClient()).toBeNull();
  });

  it('is not v2 for a v1 key without MASTRA_GATEWAY_VERSION', () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_v1-key');
    expect(isGatewayV2()).toBe(false);
  });
});
