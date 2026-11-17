import { MastraGateway } from '@mastra/core/llm';
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

  it('is not v2 for a v1 key even when MASTRA_GATEWAY_VERSION is v2', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', 'v2');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_v1-key');
    expect(isGatewayV2()).toBe(false);
  });

  it('is v2 when MASTRA_GATEWAY_VERSION is v2 and the key has no v1 prefix', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', 'v2');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'deployment-key');
    expect(isGatewayV2()).toBe(true);
  });

  it('detects v2 from a registered Mastra gateway instance carrying a v2 config key', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', '');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
    const mastra = { listGateways: () => ({ mastra: { id: 'mastra', isV2: () => true } }) };
    expect(isGatewayV2(mastra)).toBe(true);
  });

  it('does not build a v1 memory client when a registered gateway config is v2 despite a v1 env key', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', '');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_v1-key');
    const mastra = { listGateways: () => ({ mastra: { id: 'mastra', isV2: () => true } }) };
    expect(getGatewayClient(mastra)).toBeNull();
  });

  it('agrees with a registered gateway whose v1 config key wins over MASTRA_GATEWAY_VERSION', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', 'v2');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
    const gateway = new MastraGateway({ apiKey: 'msk_0123456789abcdef0123456789abcdef' });
    const mastra = { listGateways: () => ({ mastra: gateway }) };
    expect(gateway.isV2()).toBe(false);
    expect(isGatewayV2(mastra)).toBe(false);
  });

  it('does not build a v1 memory client from an organization env key', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', '');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'mskv2_org-key');
    const gateway = new MastraGateway({ apiKey: 'msk_0123456789abcdef0123456789abcdef' });
    const mastra = { listGateways: () => ({ mastra: gateway }) };
    expect(isGatewayV2(mastra)).toBe(false);
    expect(getGatewayClient(mastra)).toBeNull();
  });

  it('is not v2 when the registered Mastra gateway instance reports v1', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', '');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
    const mastra = { listGateways: () => ({ mastra: { id: 'mastra', isV2: () => false } }) };
    expect(isGatewayV2(mastra)).toBe(false);
  });
});
