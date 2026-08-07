import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
import { ModelRouterLanguageModel } from '../router';
import { MastraModelGateway } from './base';
import type { MastraModelGatewayInterface, ProviderConfig } from './base';

// Mock custom gateway implementation for testing
class TestCustomGateway extends MastraModelGateway {
  readonly id = 'custom';
  readonly name = 'test-custom';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      'my-provider': {
        name: 'My Custom Provider',
        models: ['model-1', 'model-2', 'model-3'],
        apiKeyEnvVar: 'CUSTOM_API_KEY',
        gateway: 'custom',
        url: 'https://api.custom-provider.com/v1',
      },
    };
  }

  buildUrl(_modelId: string): string {
    return 'https://api.custom-provider.com/v1';
  }

  async getApiKey(modelId: string): Promise<string> {
    const apiKey = process.env.CUSTOM_API_KEY;
    if (!apiKey) {
      throw new Error(`Missing CUSTOM_API_KEY environment variable for model: ${modelId}`);
    }
    return apiKey;
  }

  async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): Promise<LanguageModelV2> {
    const baseURL = this.buildUrl(`${providerId}/${modelId}`);
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL,
      headers,
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}

// Another test gateway with a different prefix
class AnotherCustomGateway extends MastraModelGateway {
  readonly id = 'another';
  readonly name = 'another-custom';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      'another-provider': {
        name: 'Another Provider',
        models: ['model-a', 'model-b'],
        apiKeyEnvVar: 'ANOTHER_API_KEY',
        gateway: 'another',
        url: 'https://api.another.com/v1',
      },
    };
  }

  buildUrl(_modelId: string): string {
    return 'https://api.another.com/v1';
  }

  async getApiKey(modelId: string): Promise<string> {
    const apiKey = process.env.ANOTHER_API_KEY;
    if (!apiKey) {
      throw new Error(`Missing ANOTHER_API_KEY environment variable for model: ${modelId}`);
    }
    return apiKey;
  }

  async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): Promise<LanguageModelV2> {
    const baseURL = this.buildUrl(`${providerId}/${modelId}`);
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL,
      headers,
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}

function createPlainObjectGateway(): MastraModelGatewayInterface {
  return {
    id: 'plain',
    name: 'plain-object-gateway',
    fetchProviders: vi.fn(async () => ({
      provider: {
        name: 'Plain Provider',
        models: ['model-1'],
        apiKeyEnvVar: 'PLAIN_API_KEY',
        gateway: 'plain',
        url: 'https://api.plain.example/v1',
      },
    })),
    buildUrl: vi.fn(() => 'https://api.plain.example/v1'),
    getApiKey: vi.fn(async () => 'plain-key'),
    resolveLanguageModel: vi.fn(
      ({ providerId, modelId }) =>
        ({
          specificationVersion: 'v2',
          provider: providerId,
          modelId,
          supportedUrls: {},
          doGenerate: vi.fn(),
          doStream: vi.fn(async () => ({ stream: new ReadableStream() })),
        }) as unknown as LanguageModelV2,
    ),
  };
}

describe('Custom Gateway Integration', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.CUSTOM_API_KEY = 'test-custom-key';
    process.env.ANOTHER_API_KEY = 'test-another-key';
    (ModelRouterLanguageModel as unknown as { _clearCachesForTests: () => void })._clearCachesForTests();
  });

  describe('Mastra Gateway Configuration', () => {
    it('should accept custom gateways in Mastra config', () => {
      const customGateway = new TestCustomGateway();
      const mastra = new Mastra({
        gateways: {
          custom: customGateway,
        },
      });

      const gateways = mastra.listGateways();
      expect(gateways).toBeDefined();
      expect(gateways?.custom).toBe(customGateway);
    });

    it('should accept plain object gateways in Mastra config', () => {
      const plainGateway = createPlainObjectGateway();
      const mastra = new Mastra({
        gateways: {
          plain: plainGateway,
        },
      });

      expect(mastra.listGateways()?.plain).toBe(plainGateway);
      expect(mastra.getGatewayById('plain')).toBe(plainGateway);
    });

    it('should accept multiple custom gateways', () => {
      const gateway1 = new TestCustomGateway();
      const gateway2 = new AnotherCustomGateway();
      const mastra = new Mastra({
        gateways: {
          custom: gateway1,
          another: gateway2,
        },
      });

      const gateways = mastra.listGateways();
      expect(gateways).toBeDefined();
      expect(gateways?.custom).toBe(gateway1);
      expect(gateways?.another).toBe(gateway2);
    });

    it('should allow adding gateways after initialization', () => {
      const mastra = new Mastra();
      expect(mastra.listGateways()).toBeDefined();

      const customGateway = new TestCustomGateway();
      mastra.addGateway(customGateway, 'custom');

      const gateways = mastra.listGateways();
      expect(gateways).toBeDefined();
      expect(gateways?.custom).toBe(customGateway);
    });

    it('should allow getting a gateway by name', () => {
      const gateway1 = new TestCustomGateway();
      const mastra = new Mastra({
        gateways: {
          custom: gateway1,
        },
      });

      const gateway = mastra.getGateway('custom');
      expect(gateway).toBe(gateway1);
    });

    it('should throw error when getting non-existent gateway', () => {
      const mastra = new Mastra();
      expect(() => mastra.getGateway('nonexistent')).toThrow('Gateway with key nonexistent not found');
    });
  });

  describe('ModelRouterLanguageModel with Custom Gateways', () => {
    it('should use custom gateway when provided', () => {
      const customGateway = new TestCustomGateway();

      // Create model with custom gateway
      const model = new ModelRouterLanguageModel('custom/my-provider/model-1', [customGateway]);

      expect(model).toBeDefined();
      expect(model.modelId).toBe('model-1');
      expect(model.provider).toBe('my-provider');
    });

    it('should use plain object gateways without extending MastraModelGateway', async () => {
      const plainGateway = createPlainObjectGateway();
      const model = new ModelRouterLanguageModel('plain/provider/model-1', [plainGateway]);

      expect(model.modelId).toBe('model-1');
      expect(model.provider).toBe('provider');

      await model.doStream({} as any);
      expect(plainGateway.getApiKey).toHaveBeenCalledWith('plain/provider/model-1');
      expect(plainGateway.resolveLanguageModel).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'plain-key', providerId: 'provider', modelId: 'model-1' }),
      );
    });

    it('should call plain object gateway resolveAuth before resolveLanguageModel', async () => {
      const plainGateway = createPlainObjectGateway();
      plainGateway.resolveAuth = vi.fn(() => ({ apiKey: 'hook-key', source: 'gateway' as const }));
      const model = new ModelRouterLanguageModel('plain/provider/model-1', [plainGateway]);

      await model.doStream({} as any);

      expect(plainGateway.resolveAuth).toHaveBeenCalledWith(
        expect.objectContaining({ gatewayId: 'plain', providerId: 'provider', modelId: 'model-1' }),
      );
      expect(plainGateway.getApiKey).not.toHaveBeenCalled();
      expect(plainGateway.resolveLanguageModel).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'hook-key', providerId: 'provider', modelId: 'model-1' }),
      );
    });

    it('should fall back to default gateways when custom gateways array is empty', () => {
      // This should use default gateways (netlify, models.dev)
      const model = new ModelRouterLanguageModel('openai/gpt-4o', []);

      expect(model).toBeDefined();
      expect(model.modelId).toBe('gpt-4o');
      expect(model.provider).toBe('openai');
    });

    it('should prefer custom gateway over default when both can handle the model', () => {
      const customGateway = new TestCustomGateway();

      // Custom gateway should be used for models with its prefix
      const model = new ModelRouterLanguageModel('custom/my-provider/model-1', [customGateway]);

      expect(model.provider).toBe('my-provider');
    });

    it('should fall back to default gateways when custom gateways cannot handle the model ID', () => {
      const customGateway = new TestCustomGateway();

      // Model ID doesn't match custom gateway prefix, but should fall back to default gateways
      const model = new ModelRouterLanguageModel('openai/gpt-4', [customGateway]);

      // Should use default gateway (models.dev) since custom gateway doesn't handle 'openai' prefix
      expect(model).toBeDefined();
    });
  });

  describe('Gateway Integration with Agents', () => {
    it('should use custom gateway from Mastra instance in agent', async () => {
      const customGateway = new TestCustomGateway();
      const mastra = new Mastra({
        gateways: {
          custom: customGateway,
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a test agent',
        model: 'custom/my-provider/model-1',
      });

      mastra.addAgent(agent, 'testAgent');

      const retrievedAgent = mastra.getAgent('testAgent');
      expect(retrievedAgent).toBeDefined();
      expect(retrievedAgent.name).toBe('test-agent');
    });

    it('should support multiple gateways for different agents', () => {
      const gateway1 = new TestCustomGateway();
      const gateway2 = new AnotherCustomGateway();
      const mastra = new Mastra({
        gateways: {
          custom: gateway1,
          another: gateway2,
        },
      });

      const agent1 = new Agent({
        id: 'agent-1',
        name: 'agent-1',
        instructions: 'Agent using custom gateway',
        model: 'custom/my-provider/model-1',
      });

      const agent2 = new Agent({
        id: 'agent-2',
        name: 'agent-2',
        instructions: 'Agent using another gateway',
        model: 'another/another-provider/model-a',
      });

      mastra.addAgent(agent1, 'agent1');
      mastra.addAgent(agent2, 'agent2');

      expect(mastra.getAgent('agent1')).toBeDefined();
      expect(mastra.getAgent('agent2')).toBeDefined();
    });
  });

  describe('Gateway fetchProviders', () => {
    it('should correctly fetch providers from custom gateway', async () => {
      const customGateway = new TestCustomGateway();
      const providers = await customGateway.fetchProviders();

      expect(providers).toBeDefined();
      expect(providers['my-provider']).toBeDefined();
      expect(providers['my-provider'].name).toBe('My Custom Provider');
      expect(providers['my-provider'].models).toEqual(['model-1', 'model-2', 'model-3']);
    });

    it('should correctly build URLs for custom gateway', () => {
      const customGateway = new TestCustomGateway();
      const url = customGateway.buildUrl('custom/my-provider/model-1');

      expect(url).toBe('https://api.custom-provider.com/v1');
    });

    it('should correctly get API keys for custom gateway', async () => {
      const customGateway = new TestCustomGateway();
      const apiKey = await customGateway.getApiKey('custom/my-provider/model-1');

      expect(apiKey).toBe('test-custom-key');
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.CUSTOM_API_KEY;
      const customGateway = new TestCustomGateway();

      await expect(customGateway.getApiKey('custom/my-provider/model-1')).rejects.toThrow(
        'Missing CUSTOM_API_KEY environment variable',
      );
    });
  });

  describe('Gateway Prefix Handling', () => {
    it('should correctly parse model IDs with custom prefix', () => {
      const customGateway = new TestCustomGateway();
      const model = new ModelRouterLanguageModel('custom/my-provider/model-1', [customGateway]);

      expect(model.provider).toBe('my-provider');
      expect(model.modelId).toBe('model-1');
    });

    it('should handle models with different prefixes', () => {
      const gateway1 = new TestCustomGateway();
      const gateway2 = new AnotherCustomGateway();

      const model1 = new ModelRouterLanguageModel('custom/my-provider/model-1', [gateway1, gateway2]);
      expect(model1.provider).toBe('my-provider');

      const model2 = new ModelRouterLanguageModel('another/another-provider/model-a', [gateway1, gateway2]);
      expect(model2.provider).toBe('another-provider');
    });
  });

  describe('Custom Gateway Error Handling', () => {
    it('should handle gateway resolution errors gracefully', () => {
      const customGateway = new TestCustomGateway();

      // Invalid model ID format (missing model part)
      expect(() => {
        new ModelRouterLanguageModel('custom/', [customGateway]);
      }).toThrow();
    });

    it('should fall back to default gateways for unknown prefixes', () => {
      const customGateway = new TestCustomGateway();

      // Model ID with unknown prefix should fall back to default gateways
      const model = new ModelRouterLanguageModel('anthropic/claude-3-5-sonnet-20241022', [customGateway]);

      // Should use default gateway (models.dev) since prefix doesn't match custom gateway
      expect(model).toBeDefined();
    });
  });

  describe('Gateway with Dynamic Model Config', () => {
    it('should work with OpenAICompatibleConfig objects', () => {
      const customGateway = new TestCustomGateway();
      const model = new ModelRouterLanguageModel(
        {
          id: 'custom/my-provider/model-1',
          apiKey: 'override-key',
        },
        [customGateway],
      );

      expect(model).toBeDefined();
      expect(model.provider).toBe('my-provider');
      expect(model.modelId).toBe('model-1');
    });

    it('should work with providerId/modelId config objects', () => {
      const customGateway = new TestCustomGateway();
      const model = new ModelRouterLanguageModel(
        {
          providerId: 'custom/my-provider',
          modelId: 'model-1',
          apiKey: 'override-key',
        },
        [customGateway],
      );

      expect(model).toBeDefined();
      expect(model.provider).toBe('my-provider');
      expect(model.modelId).toBe('model-1');
    });
  });

  describe('Custom gateway dedup regression', () => {
    it('uses the custom gateway when it shadows a default gateway id (first-wins)', () => {
      // A custom gateway with the same id as the default Netlify gateway.
      // Before the GatewayManager dedup fix, the default would override the
      // custom gateway, losing the user's override. Now first-wins dedup keeps
      // the custom gateway.
      const shadowGateway: MastraModelGatewayInterface = {
        id: 'netlify',
        name: 'custom-netlify-override',
        shouldEnable: () => true,
        fetchProviders: vi.fn(async () => ({
          'shadow-provider': {
            name: 'Shadow',
            models: ['shadow-model'],
            apiKeyEnvVar: 'SHADOW_KEY',
            gateway: 'netlify',
            url: 'https://shadow.example/v1',
          },
        })),
        buildUrl: () => 'https://shadow.example/v1',
        getApiKey: vi.fn(async () => 'shadow-key'),
        resolveAuth: vi.fn(() => ({ apiKey: 'shadow-auth-key', source: 'gateway' as const })),
        resolveLanguageModel: vi.fn(
          () =>
            ({
              specificationVersion: 'v2',
              doGenerate: vi.fn(),
              doStream: vi.fn(),
            }) as any,
        ),
      };

      const model = new ModelRouterLanguageModel('netlify/shadow-provider/shadow-model', [shadowGateway]);

      // The custom gateway wins over the default Netlify gateway.
      expect(model.gatewayId).toBe('netlify');
      expect(model.provider).toBe('shadow-provider');
      expect(model.modelId).toBe('shadow-model');
      expect(shadowGateway.resolveAuth).not.toHaveBeenCalled(); // not called at construction time
    });

    it('does not reserve a gateway id from a disabled custom gateway before an enabled default', async () => {
      // A disabled custom gateway with the same id as a default should not
      // block the enabled default from being used. Use a netlify-prefixed id
      // so resolution depends on the netlify gateway (openai/gpt-4o would
      // fall back to models.dev and hide a regression here).
      const disabledGateway: MastraModelGatewayInterface = {
        id: 'netlify',
        name: 'disabled-netlify-override',
        shouldEnable: () => false,
        fetchProviders: vi.fn(async () => ({})),
        buildUrl: () => '',
        getApiKey: vi.fn(async () => 'should-not-be-used'),
        resolveLanguageModel: vi.fn(() => ({}) as any),
      };

      // Ensure the default Netlify gateway's getApiKey throws predictably
      // (missing token) instead of attempting a network token exchange.
      const prevToken = process.env['NETLIFY_TOKEN'];
      const prevSiteId = process.env['NETLIFY_SITE_ID'];
      delete process.env['NETLIFY_TOKEN'];
      delete process.env['NETLIFY_SITE_ID'];

      try {
        const model = new ModelRouterLanguageModel('netlify/openai/gpt-4o', [disabledGateway]);

        expect(model).toBeDefined();
        expect(model.gatewayId).toBe('netlify');

        // Driving resolution: the default Netlify gateway is retained (its
        // getApiKey throws on the missing token), so resolveLanguageModel is
        // never reached. If the disabled gateway were incorrectly retained,
        // its getApiKey would return 'should-not-be-used' and
        // resolveLanguageModel would be called — failing this assertion.
        await model.supportedUrls;
        expect(disabledGateway.resolveLanguageModel).not.toHaveBeenCalled();
        expect(disabledGateway.getApiKey).not.toHaveBeenCalled();
      } finally {
        if (prevToken !== undefined) process.env['NETLIFY_TOKEN'] = prevToken;
        else delete process.env['NETLIFY_TOKEN'];
        if (prevSiteId !== undefined) process.env['NETLIFY_SITE_ID'] = prevSiteId;
        else delete process.env['NETLIFY_SITE_ID'];
      }
    });
  });
});
