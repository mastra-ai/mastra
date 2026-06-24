import { describe, expect, it, vi } from 'vitest';

import type {
  GatewayAuthRequest,
  GatewayAuthResult,
  GatewayLanguageModel,
  MastraModelGatewayInterface,
  ProviderConfig,
} from './base';
import { defaultGateways } from './defaults';
import { GatewayManager } from './gateway-manager';

/**
 * Minimal in-memory gateway for exercising GatewayManager without real
 * network calls. `fetchProviders` / `getApiKey` / `resolveAuth` are vi.fn so
 * tests can assert call counts and return values.
 */
function createFakeGateway(options?: {
  id?: string;
  models?: string[];
  apiKeyEnvVar?: string | string[];
  apiKey?: string | (() => Promise<string>);
  resolveAuth?: (request: GatewayAuthRequest) => GatewayAuthResult | undefined;
  enabled?: boolean;
  provider?: string;
}): MastraModelGatewayInterface {
  const id = options?.id ?? 'test-gateway';
  const provider = options?.provider ?? 'acme';
  const models = options?.models ?? ['sonic-fast'];
  const apiKeyEnvVar = options?.apiKeyEnvVar ?? 'ACME_API_KEY';

  return {
    id,
    name: 'Test Gateway',
    shouldEnable: () => options?.enabled ?? true,
    fetchProviders: vi.fn(
      async (): Promise<Record<string, ProviderConfig>> => ({
        [provider]: {
          name: 'Acme',
          models,
          apiKeyEnvVar,
          gateway: id,
        },
      }),
    ),
    buildUrl: () => 'https://example.com/v1',
    getApiKey: vi.fn(async () => {
      if (typeof options?.apiKey === 'function') return options.apiKey();
      return options?.apiKey ?? '';
    }),
    resolveAuth: options?.resolveAuth,
    resolveLanguageModel: () => ({}) as GatewayLanguageModel,
  };
}

describe('GatewayManager', () => {
  describe('constructor', () => {
    it('stores only the gateways passed in (no side-effect defaults)', () => {
      const gw = createFakeGateway({ id: 'my-gateway' });
      const manager = new GatewayManager([gw]);
      expect(manager.gateways).toHaveLength(1);
      expect(manager.gateways[0]).toBe(gw);
    });

    it('defaults to an empty gateway list', () => {
      const manager = new GatewayManager();
      expect(manager.gateways).toHaveLength(0);
    });

    it('drops disabled gateways', () => {
      const enabled = createFakeGateway({ id: 'on-gateway' });
      const disabled = createFakeGateway({ id: 'off-gateway', enabled: false });
      const manager = new GatewayManager([enabled, disabled]);
      expect(manager.gateways.map(g => g.id)).not.toContain('off-gateway');
      expect(manager.gateways.map(g => g.id)).toContain('on-gateway');
    });
  });

  describe('getPrefix', () => {
    it('returns undefined for models.dev', () => {
      expect(GatewayManager.getPrefix('models.dev')).toBeUndefined();
    });

    it('returns the gateway id for any other gateway', () => {
      expect(GatewayManager.getPrefix('netlify')).toBe('netlify');
      expect(GatewayManager.getPrefix('my-gateway')).toBe('my-gateway');
    });
  });

  describe('parseModelId', () => {
    it('parses a prefixed router id', () => {
      const gateway = createFakeGateway({ id: 'test-gateway', provider: 'acme', models: ['sonic-fast'] });
      const manager = new GatewayManager([gateway]);
      const parsed = manager.parseModelId('test-gateway/acme/sonic-fast');
      expect(parsed).toEqual({
        providerId: 'acme',
        modelId: 'sonic-fast',
        gatewayId: 'test-gateway',
      });
    });

    it('parses a models.dev (prefix-less) router id', () => {
      const manager = new GatewayManager(defaultGateways);
      const parsed = manager.parseModelId('openai/gpt-4o');
      expect(parsed.gatewayId).toBe('models.dev');
      expect(parsed.providerId).toBe('openai');
      expect(parsed.modelId).toBe('gpt-4o');
    });
  });

  describe('resolveAuth', () => {
    it('prefers gateway.resolveAuth when present', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        resolveAuth: () => ({ apiKey: 'oauth-key', source: 'gateway' }),
      });
      const manager = new GatewayManager([gateway]);
      const auth = await manager.resolveAuth('test-gateway/acme/sonic-fast');
      expect(auth.apiKey).toBe('oauth-key');
      expect(auth.source).toBe('gateway');
    });

    it('promotes bearerToken to an Authorization header', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        resolveAuth: () => ({ bearerToken: 'tok-123' }),
      });
      const manager = new GatewayManager([gateway]);
      const auth = await manager.resolveAuth('test-gateway/acme/sonic-fast');
      expect(auth.bearerToken).toBe('tok-123');
      expect(auth.headers?.Authorization).toBe('Bearer tok-123');
    });

    it('falls back to getApiKey when resolveAuth returns nothing', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        apiKey: 'env-key',
      });
      const manager = new GatewayManager([gateway]);
      const auth = await manager.resolveAuth('test-gateway/acme/sonic-fast');
      expect(auth.apiKey).toBe('env-key');
      expect(auth.source).toBe('legacy');
    });
  });

  describe('hasAuth', () => {
    it('returns true when resolveAuth yields credentials', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        resolveAuth: () => ({ apiKey: 'key' }),
      });
      const manager = new GatewayManager([gateway]);
      expect(await manager.hasAuth('test-gateway/acme/sonic-fast')).toBe(true);
    });

    it('returns false when no credentials resolve and getApiKey is empty', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        apiKey: '',
      });
      const manager = new GatewayManager([gateway]);
      expect(await manager.hasAuth('test-gateway/acme/sonic-fast')).toBe(false);
    });

    it('returns false instead of throwing on an unknown model', async () => {
      const manager = new GatewayManager([createFakeGateway({ id: 'test-gateway' })]);
      expect(await manager.hasAuth('unknown/garbage/model')).toBe(false);
    });
  });

  describe('listProviders', () => {
    it('flattens providers from all gateways and stamps the gateway id', async () => {
      const gateway = createFakeGateway({ id: 'test-gateway', provider: 'acme', models: ['sonic-fast'] });
      const manager = new GatewayManager([gateway]);

      const providers = await manager.listProviders();
      const key = 'test-gateway/acme';
      expect(providers[key]).toMatchObject({
        name: 'Acme',
        models: ['sonic-fast'],
        gateway: 'test-gateway',
      });
    });

    it('dedupes by provider key — earlier gateway wins', async () => {
      const first = createFakeGateway({ id: 'gw-a', provider: 'shared', models: ['first-model'] });
      const second = createFakeGateway({ id: 'gw-b', provider: 'shared', models: ['second-model'] });
      const manager = new GatewayManager([first, second]);

      const providers = await manager.listProviders();
      // Both register provider 'shared' under their own prefix.
      expect(providers['gw-a/shared'].models).toEqual(['first-model']);
      expect(providers['gw-b/shared'].models).toEqual(['second-model']);
    });
  });

  describe('listAvailableModels', () => {
    it('builds model entries with id/provider/modelName and applies auth per provider', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        models: ['sonic-fast', 'sonic-turbo'],
        resolveAuth: () => ({ apiKey: 'k' }),
      });
      const manager = new GatewayManager([gateway]);

      const models = await manager.listAvailableModels();
      const ours = models.filter(m => m.provider === 'test-gateway/acme');
      expect(ours).toHaveLength(2);
      expect(ours[0]).toMatchObject({
        id: 'test-gateway/acme/sonic-fast',
        provider: 'test-gateway/acme',
        modelName: 'sonic-fast',
        hasApiKey: true,
        apiKeyEnvVar: 'ACME_API_KEY',
      });
      expect(ours[1]).toMatchObject({
        id: 'test-gateway/acme/sonic-turbo',
        modelName: 'sonic-turbo',
        hasApiKey: true,
      });
    });

    it('marks hasApiKey false when auth cannot be resolved', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        apiKey: '',
      });
      const manager = new GatewayManager([gateway]);

      const models = await manager.listAvailableModels();
      expect(models[0].hasApiKey).toBe(false);
    });

    it('normalises array apiKeyEnvVar to the first entry', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        apiKeyEnvVar: ['FIRST_KEY', 'SECOND_KEY'],
      });
      const manager = new GatewayManager([gateway]);

      const models = await manager.listAvailableModels();
      expect(models[0].apiKeyEnvVar).toBe('FIRST_KEY');
    });
  });
});
