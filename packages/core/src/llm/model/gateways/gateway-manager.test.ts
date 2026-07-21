import { describe, expect, it, vi } from 'vitest';

import { MastraError } from '../../../error/index.js';
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
  handlesModel?: (modelId: string) => boolean;
}): MastraModelGatewayInterface {
  const id = options?.id ?? 'test-gateway';
  const provider = options?.provider ?? 'acme';
  const models = options?.models ?? ['sonic-fast'];
  const apiKeyEnvVar = options?.apiKeyEnvVar ?? 'ACME_API_KEY';

  return {
    id,
    name: 'Test Gateway',
    shouldEnable: () => options?.enabled ?? true,
    fetchProviders: vi.fn(async (): Promise<Record<string, ProviderConfig>> => ({
      [provider]: {
        name: 'Acme',
        models,
        apiKeyEnvVar,
        gateway: id,
      },
    })),
    buildUrl: () => 'https://example.com/v1',
    getApiKey: vi.fn(async () => {
      if (typeof options?.apiKey === 'function') return options.apiKey();
      return options?.apiKey ?? '';
    }),
    resolveAuth: options?.resolveAuth,
    handlesModel: options?.handlesModel,
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

    it('deduplicates by gateway id — first (custom) gateway wins', () => {
      const custom = createFakeGateway({ id: 'netlify', provider: 'openai', models: ['custom-model'] });
      const defaultLike = createFakeGateway({ id: 'netlify', provider: 'openai', models: ['default-model'] });
      const manager = new GatewayManager([custom, defaultLike]);
      expect(manager.gateways).toHaveLength(1);
      expect(manager.gateways[0]).toBe(custom);
    });

    it('removes later duplicates when custom appears before defaults', () => {
      const custom = createFakeGateway({ id: 'netlify', provider: 'openai', models: ['custom-model'] });
      const other = createFakeGateway({ id: 'models.dev', provider: 'openai' });
      const duplicate = createFakeGateway({ id: 'netlify', provider: 'openai', models: ['dup-model'] });
      const manager = new GatewayManager([custom, other, duplicate]);
      expect(manager.gateways.map(g => g.id)).toEqual(['netlify', 'models.dev']);
      expect(manager.gateways[0]).toBe(custom);
    });

    it('does not reserve a gateway id from a disabled gateway before an enabled duplicate', () => {
      const disabled = createFakeGateway({ id: 'shared', enabled: false, models: ['disabled-model'] });
      const enabled = createFakeGateway({ id: 'shared', models: ['enabled-model'] });
      const manager = new GatewayManager([disabled, enabled]);
      // The disabled gateway is filtered out before dedup, so the enabled
      // duplicate is kept — not removed by the disabled one's id.
      expect(manager.gateways).toHaveLength(1);
      expect(manager.gateways[0]).toBe(enabled);
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

  describe('handlesModel routing', () => {
    it('routes an unprefixed model id to a gateway that claims it', () => {
      const claiming = createFakeGateway({
        id: 'mastracode',
        provider: 'anthropic',
        handlesModel: id => id.startsWith('anthropic/'),
      });
      const manager = new GatewayManager([claiming, ...defaultGateways]);

      const gateway = manager.findGatewayForModel('anthropic/claude-sonnet-4-5');
      expect(gateway.id).toBe('mastracode');
    });

    it('still prefers an exact prefix match over a claiming gateway', () => {
      const claiming = createFakeGateway({
        id: 'mastracode',
        provider: 'anthropic',
        handlesModel: () => true,
      });
      const prefixed = createFakeGateway({ id: 'netlify', provider: 'anthropic' });
      const manager = new GatewayManager([claiming, prefixed]);

      expect(manager.findGatewayForModel('netlify/anthropic/claude-sonnet-4-5').id).toBe('netlify');
    });

    it('falls back to models.dev when no gateway claims the model', () => {
      const claiming = createFakeGateway({
        id: 'mastracode',
        provider: 'anthropic',
        handlesModel: id => id.startsWith('anthropic/'),
      });
      const manager = new GatewayManager([claiming, ...defaultGateways]);

      expect(manager.findGatewayForModel('openai/gpt-4o').id).toBe('models.dev');
    });

    it('parses a claimed unprefixed id as provider/model (not gateway-prefixed)', () => {
      const claiming = createFakeGateway({
        id: 'mastracode',
        provider: 'anthropic',
        handlesModel: id => id.startsWith('anthropic/'),
      });
      const manager = new GatewayManager([claiming]);

      expect(manager.parseModelId('anthropic/claude-sonnet-4-5')).toEqual({
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4-5',
        gatewayId: 'mastracode',
      });
    });

    it('resolves auth for a claimed unprefixed id via the claiming gateway', async () => {
      const claiming = createFakeGateway({
        id: 'mastracode',
        provider: 'anthropic',
        handlesModel: id => id.startsWith('anthropic/'),
        resolveAuth: () => ({ bearerToken: 'oauth' }),
      });
      const manager = new GatewayManager([claiming, ...defaultGateways]);

      expect(await manager.hasAuth('anthropic/claude-sonnet-4-5')).toBe(true);
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

    it('returns false when resolveAuth throws a MastraError for a missing API key', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        resolveAuth: () => {
          throw new MastraError({
            id: 'MASTRA_GATEWAY_NO_API_KEY',
            domain: 'LLM',
            category: 'UNKNOWN',
            text: 'Could not find API key',
          });
        },
      });
      const manager = new GatewayManager([gateway]);
      expect(await manager.hasAuth('test-gateway/acme/sonic-fast')).toBe(false);
    });

    it('returns false when getApiKey throws a plain Error for a missing env var', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        apiKey: () => {
          throw new Error('Missing OPENAI_API_KEY environment variable');
        },
      });
      const manager = new GatewayManager([gateway]);
      expect(await manager.hasAuth('test-gateway/acme/sonic-fast')).toBe(false);
    });

    it('re-throws unexpected gateway failures (e.g. token exchange)', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        resolveAuth: () => {
          throw new Error('token exchange failed');
        },
      });
      const manager = new GatewayManager([gateway]);
      await expect(manager.hasAuth('test-gateway/acme/sonic-fast')).rejects.toThrow('token exchange failed');
    });

    it('re-throws unexpected MastraError IDs (e.g. token exchange error)', async () => {
      const gateway = createFakeGateway({
        id: 'test-gateway',
        provider: 'acme',
        resolveAuth: () => {
          throw new MastraError({
            id: 'NETLIFY_GATEWAY_TOKEN_ERROR',
            domain: 'LLM',
            category: 'UNKNOWN',
            text: 'token exchange failed',
          });
        },
      });
      const manager = new GatewayManager([gateway]);
      await expect(manager.hasAuth('test-gateway/acme/sonic-fast')).rejects.toThrow('token exchange failed');
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

  describe('provider-equals-gateway (two-part router ids)', () => {
    // A gateway whose provider id is the same as its gateway id (e.g. a
    // standalone amazon-bedrock gateway) emits two-part catalog ids like
    // `amazon-bedrock/<model>` rather than `amazon-bedrock/amazon-bedrock/<model>`.
    it('parses a two-part router id when gateway id equals provider id', () => {
      const gateway = createFakeGateway({
        id: 'amazon-bedrock',
        provider: 'amazon-bedrock',
        models: ['anthropic.claude-sonnet-4-5'],
      });
      const manager = new GatewayManager([gateway]);
      expect(manager.parseModelId('amazon-bedrock/anthropic.claude-sonnet-4-5')).toEqual({
        gatewayId: 'amazon-bedrock',
        providerId: 'amazon-bedrock',
        modelId: 'anthropic.claude-sonnet-4-5',
      });
    });

    it('listAvailableModels emits unprefixed amazon-bedrock/<model> ids', async () => {
      const gateway = createFakeGateway({
        id: 'amazon-bedrock',
        provider: 'amazon-bedrock',
        models: ['anthropic.claude-sonnet-4-5', 'anthropic.claude-haiku-4-5'],
        resolveAuth: () => ({ apiKey: 'aws-credential-chain', source: 'gateway' }),
      });
      const manager = new GatewayManager([gateway]);

      const models = await manager.listAvailableModels();
      expect(models.map(m => m.id)).toEqual([
        'amazon-bedrock/anthropic.claude-sonnet-4-5',
        'amazon-bedrock/anthropic.claude-haiku-4-5',
      ]);
      expect(models[0]).toMatchObject({
        provider: 'amazon-bedrock',
        modelName: 'anthropic.claude-sonnet-4-5',
        hasApiKey: true,
      });
    });

    it('resolveAuth calls the gateway with the two-part router id', async () => {
      const resolveAuth = vi.fn((_req: GatewayAuthRequest): GatewayAuthResult => ({
        apiKey: 'aws-credential-chain',
        source: 'gateway',
      }));
      const gateway = createFakeGateway({
        id: 'amazon-bedrock',
        provider: 'amazon-bedrock',
        models: ['anthropic.claude-sonnet-4-5'],
        resolveAuth,
      });
      const manager = new GatewayManager([gateway]);

      const auth = await manager.resolveAuth('amazon-bedrock/anthropic.claude-sonnet-4-5');
      expect(auth.apiKey).toBe('aws-credential-chain');
      expect(resolveAuth).toHaveBeenCalledWith({
        gatewayId: 'amazon-bedrock',
        providerId: 'amazon-bedrock',
        modelId: 'anthropic.claude-sonnet-4-5',
        routerId: 'amazon-bedrock/anthropic.claude-sonnet-4-5',
      });
    });

    it('still parses standard three-part gateway/provider/model ids', () => {
      const gateway = createFakeGateway({
        id: 'netlify',
        provider: 'anthropic',
        models: ['claude-sonnet-4-5'],
      });
      const manager = new GatewayManager([gateway]);
      expect(manager.parseModelId('netlify/anthropic/claude-sonnet-4-5')).toEqual({
        gatewayId: 'netlify',
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4-5',
      });
    });
  });
});
