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
    const mastra = {
      listGateways: () => ({ mastra: { id: 'mastra', isV2: () => true, config: { apiKey: 'mskv2_org-key' } } }),
    };
    expect(getGatewayClient(mastra)).toBeNull();
  });

  // `@mastra/core` 1.83 and 1.84 answer v2 for any key when MASTRA_GATEWAY_VERSION=v2 is set.
  it('uses v1 for a project env key when an older registered gateway answers v2', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', 'v2');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_0123456789abcdef0123456789abcdef');
    const mastra = { listGateways: () => ({ mastra: { id: 'mastra', isV2: () => true } }) };
    expect(isGatewayV2(mastra)).toBe(false);
    expect(getGatewayClient(mastra)).not.toBeNull();
  });

  it('uses v1 for a project config key when an older registered gateway answers v2', () => {
    vi.stubEnv('MASTRA_GATEWAY_VERSION', 'v2');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
    const mastra = {
      listGateways: () => ({
        mastra: { id: 'mastra', isV2: () => true, config: { apiKey: 'msk_0123456789abcdef0123456789abcdef' } },
      }),
    };
    expect(isGatewayV2(mastra)).toBe(false);
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

describe('v2 detection and the v1 memory client across configurations', () => {
  afterEach(() => vi.unstubAllEnvs());

  const envKeys = {
    none: '',
    project: 'msk_0123456789abcdef0123456789abcdef',
    organization: 'mskv2_org-key',
    unprefixed: 'deployment-key',
  } as const;
  const registeredKeys = {
    none: undefined,
    v1: 'msk_fedcba9876543210fedcba9876543210',
    v2: 'mskv2_registered',
  } as const;

  // [env key, MASTRA_GATEWAY_VERSION, registered gateway key, isGatewayV2, v1 memory client built]
  const table: Array<[keyof typeof envKeys, 'unset' | 'v2', keyof typeof registeredKeys, boolean, boolean]> = [
    ['none', 'unset', 'none', false, false],
    ['none', 'v2', 'none', true, false],
    ['none', 'unset', 'v1', false, false],
    ['none', 'v2', 'v1', false, false],
    ['none', 'unset', 'v2', true, false],
    ['none', 'v2', 'v2', true, false],
    ['project', 'unset', 'none', false, true],
    ['project', 'v2', 'none', false, true],
    ['project', 'unset', 'v1', false, true],
    ['project', 'v2', 'v1', false, true],
    ['project', 'unset', 'v2', true, false],
    ['project', 'v2', 'v2', true, false],
    ['organization', 'unset', 'none', true, false],
    ['organization', 'v2', 'none', true, false],
    ['organization', 'unset', 'v1', false, false],
    ['organization', 'v2', 'v1', false, false],
    ['organization', 'unset', 'v2', true, false],
    ['organization', 'v2', 'v2', true, false],
    ['unprefixed', 'unset', 'none', false, true],
    ['unprefixed', 'v2', 'none', true, false],
    ['unprefixed', 'unset', 'v1', false, true],
    ['unprefixed', 'v2', 'v1', false, false],
    ['unprefixed', 'unset', 'v2', true, false],
    ['unprefixed', 'v2', 'v2', true, false],
  ];

  it.each(table)(
    'env key %s, MASTRA_GATEWAY_VERSION %s, registered key %s: v2 is %s, v1 memory client built is %s',
    async (envKey, version, registeredKey, expectedV2, expectedClient) => {
      vi.stubEnv('MASTRA_GATEWAY_API_KEY', envKeys[envKey]);
      vi.stubEnv('MASTRA_GATEWAY_VERSION', version === 'v2' ? 'v2' : '');
      const registered = registeredKeys[registeredKey];
      // Mastra always lists a Mastra gateway: the registered one, or a default one without a config key.
      const gateway = registered ? new MastraGateway({ apiKey: registered }) : new MastraGateway();
      const mastra = { listGateways: () => ({ mastra: gateway }) };

      // A fresh module, so the cached client from one case cannot answer for another.
      vi.resetModules();
      const client = await import('./gateway-memory-client.js');

      expect(client.isGatewayV2(mastra)).toBe(expectedV2);
      expect(client.getGatewayClient(mastra) !== null).toBe(expectedClient);
      if (!registered) expect(client.isGatewayV2()).toBe(expectedV2);
    },
  );
});
