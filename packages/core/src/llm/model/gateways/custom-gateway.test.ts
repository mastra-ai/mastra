import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
import { ModelRouterLanguageModel } from '../router';
import { MastraModelGateway } from './base';
import type { ProviderConfig } from './base';

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
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const baseURL = this.buildUrl(`${providerId}/${modelId}`);
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL,
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
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const baseURL = this.buildUrl(`${providerId}/${modelId}`);
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL,
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}

describe('Custom Gateway Integration', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.CUSTOM_API_KEY = 'test-custom-key';
    process.env.ANOTHER_API_KEY = 'test-another-key';
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
      expect(Object.keys(gateways ?? {})).toHaveLength(1);
      expect(gateways?.custom).toBe(customGateway);
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
      expect(Object.keys(gateways ?? {})).toHaveLength(2);
      expect(gateways?.custom).toBe(gateway1);
      expect(gateways?.another).toBe(gateway2);
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
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a test agent',
        model: 'custom/my-provider/model-1',
      });

      const mastra = new Mastra({
        gateways: {
          custom: customGateway,
        },
        agents: {
          testAgent: agent,
        },
      });

      const retrievedAgent = mastra.getAgent('testAgent');
      expect(retrievedAgent).toBeDefined();
      expect(retrievedAgent.name).toBe('test-agent');
    });

    it('should support multiple gateways for different agents', () => {
      const gateway1 = new TestCustomGateway();
      const gateway2 = new AnotherCustomGateway();

      const agent1 = new Agent({
        name: 'agent-1',
        instructions: 'Agent using custom gateway',
        model: 'custom/my-provider/model-1',
      });

      const agent2 = new Agent({
        name: 'agent-2',
        instructions: 'Agent using another gateway',
        model: 'another/another-provider/model-a',
      });

      const mastra = new Mastra({
        gateways: {
          custom: gateway1,
          another: gateway2,
        },
        agents: {
          agent1: agent1,
          agent2: agent2,
        },
      });

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

      // Invalid model ID format (missing parts)
      expect(() => {
        new ModelRouterLanguageModel('custom/invalid', [customGateway]);
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
});
