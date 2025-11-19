import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { MastraModelGateway } from '../llm/model/gateways/base';
import type { ProviderConfig } from '../llm/model/gateways/base';
import { resolveModelConfig } from '../llm/model/resolve-model';
import { RequestContext } from '../request-context';
import { Mastra } from './index';

class Gateway1 extends MastraModelGateway {
  readonly id = 'gateway-1';
  readonly name = 'gateway-1';
  readonly prefix = 'g1';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      'provider-1': {
        name: 'Provider 1',
        models: ['model-1'],
        apiKeyEnvVar: 'G1_API_KEY',
        gateway: 'gateway-1',
      },
    };
  }
  buildUrl(_modelId: string): string {
    return 'https://api.gateway-1.com/v1';
  }
  getApiKey(_modelId: string): Promise<string> {
    return Promise.resolve('G1_API_KEY');
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
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL: this.buildUrl(`${providerId}/${modelId}`),
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}
class Gateway2 extends MastraModelGateway {
  readonly id = 'gateway-2';
  readonly name = 'gateway-2';
  readonly prefix = 'g2';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      'provider-2': {
        name: 'Provider 2',
        models: ['model-2'],
        apiKeyEnvVar: 'G2_API_KEY',
        gateway: 'gateway-2',
      },
    };
  }
  buildUrl(_modelId: string): string {
    return 'https://api.gateway-2.com/v1';
  }
  getApiKey(_modelId: string): Promise<string> {
    return Promise.resolve('G2_API_KEY');
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
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL: this.buildUrl(`${providerId}/${modelId}`),
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}

// Test custom gateway
class TestGateway extends MastraModelGateway {
  readonly id = 'test-gateway';
  readonly name = 'test-gateway';
  readonly prefix = 'test';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      'test-provider': {
        name: 'Test Provider',
        models: ['test-model-1', 'test-model-2'],
        apiKeyEnvVar: 'TEST_API_KEY',
        gateway: 'test-gateway',
        url: 'https://api.test.com/v1',
      },
    };
  }

  buildUrl(_modelId: string): string {
    return 'https://api.test.com/v1';
  }

  async getApiKey(_modelId: string): Promise<string> {
    return process.env.TEST_API_KEY || 'test-key';
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

describe('Mastra Custom Gateway Integration', () => {
  beforeEach(() => {
    process.env.TEST_API_KEY = 'test-api-key-123';
  });

  describe('Mastra Configuration', () => {
    it('should store gateways when passed in config', () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      const gateways = mastra.listGateways();
      expect(gateways).toBeDefined();
      expect(Object.keys(gateways ?? {})).toHaveLength(1);
      expect(gateways?.test.name).toBe('test-gateway');
    });

    it('should return empty record when no gateways are configured', () => {
      const mastra = new Mastra();
      const gateways = mastra.listGateways();
      expect(gateways).toBeDefined();
      expect(Object.keys(gateways ?? {})).toHaveLength(0);
    });

    it('should allow adding gateways after construction', () => {
      const mastra = new Mastra();
      const testGateway = new TestGateway();

      mastra.addGateway(testGateway, 'test');

      const gateways = mastra.listGateways();
      expect(gateways).toBeDefined();
      expect(Object.keys(gateways ?? {})).toHaveLength(1);
      expect(gateways?.test).toBe(testGateway);
    });

    it('should support multiple gateways', () => {
      const mastra = new Mastra({
        gateways: {
          g1: new Gateway1(),
          g2: new Gateway2(),
        },
      });

      const gateways = mastra.listGateways();
      expect(gateways).toBeDefined();
      expect(Object.keys(gateways ?? {})).toHaveLength(2);
      expect(gateways?.g1.name).toBe('gateway-1');
      expect(gateways?.g2.name).toBe('gateway-2');
    });

    it('should allow getting a gateway by name', () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      const gateway = mastra.getGateway('test');
      expect(gateway).toBe(testGateway);
      expect(gateway.name).toBe('test-gateway');
    });

    it('should throw error when getting non-existent gateway', () => {
      const mastra = new Mastra();
      expect(() => mastra.getGateway('nonexistent')).toThrow('Gateway with key nonexistent not found');
    });

    it('should allow getting a gateway by its ID', () => {
      class GatewayWithId extends MastraModelGateway {
        readonly id = 'test-gateway-v1';
        readonly name = 'test-gateway-name';
        readonly prefix = 'test-id';

        async fetchProviders() {
          return {
            'test-provider': {
              name: 'Test Provider',
              models: ['model-1'],
              apiKeyEnvVar: 'TEST_API_KEY',
              gateway: 'test-gateway-name',
            },
          };
        }

        buildUrl(_modelId: string) {
          return 'https://api.test-id.com/v1';
        }

        async getApiKey(_modelId: string) {
          return 'test-key';
        }

        async resolveLanguageModel({
          modelId,
          providerId,
          apiKey,
        }: {
          modelId: string;
          providerId: string;
          apiKey: string;
        }) {
          return createOpenAICompatible({
            name: providerId,
            apiKey,
            baseURL: this.buildUrl(`${providerId}/${modelId}`),
            supportsStructuredOutputs: true,
          }).chatModel(modelId);
        }
      }

      const gateway = new GatewayWithId();
      const mastra = new Mastra({
        gateways: {
          myKey: gateway,
        },
      });

      // Get by ID (not the key)
      const retrievedGateway = mastra.getGatewayById('test-gateway-v1');
      expect(retrievedGateway).toBe(gateway);
      expect(retrievedGateway.getId()).toBe('test-gateway-v1');
    });

    it('should use name as ID when gateway has no explicit ID', () => {
      const testGateway = new TestGateway(); // name = 'test-gateway', no id
      const mastra = new Mastra({
        gateways: {
          someKey: testGateway,
        },
      });

      // Should be able to get by name when no ID is set
      const retrievedGateway = mastra.getGatewayById('test-gateway');
      expect(retrievedGateway).toBe(testGateway);
    });

    it('should throw error when getting gateway by non-existent ID', () => {
      const mastra = new Mastra({
        gateways: {
          test: new TestGateway(),
        },
      });

      expect(() => mastra.getGatewayById('non-existent-id')).toThrow('Gateway with ID non-existent-id not found');
    });
  });

  describe('resolveModelConfig Integration', () => {
    it('should use custom gateways from Mastra instance when resolving model strings', async () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      const requestContext = new RequestContext();
      const model = await resolveModelConfig('test/test-provider/test-model-1', requestContext, mastra);

      expect(model).toBeDefined();
      expect(model.specificationVersion).toBe('v2');
    });

    it('should use custom gateways when resolving config objects', async () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      const requestContext = new RequestContext();
      const model = await resolveModelConfig(
        {
          id: 'test/test-provider/test-model-1',
          apiKey: 'custom-key',
        },
        requestContext,
        mastra,
      );

      expect(model).toBeDefined();
      expect(model.specificationVersion).toBe('v2');
    });

    it('should use custom gateways when resolving dynamic functions', async () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      const requestContext = new RequestContext();
      const model = await resolveModelConfig(() => 'test/test-provider/test-model-1', requestContext, mastra);

      expect(model).toBeDefined();
      expect(model.specificationVersion).toBe('v2');
    });

    it('should work without Mastra instance (use default gateways)', async () => {
      const requestContext = new RequestContext();
      const model = await resolveModelConfig('openai/gpt-4o', requestContext);

      expect(model).toBeDefined();
      expect(model.specificationVersion).toBe('v2');
    });

    it('should work when Mastra instance has no custom gateways', async () => {
      const mastra = new Mastra();
      const requestContext = new RequestContext();
      const model = await resolveModelConfig('openai/gpt-4o', requestContext, mastra);

      expect(model).toBeDefined();
      expect(model.specificationVersion).toBe('v2');
    });
  });

  describe('Agent Integration with Custom Gateways', () => {
    it('should allow agents to use models from custom gateways', () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
        agents: {
          testAgent: new Agent({
            name: 'test-agent',
            instructions: 'Test agent instructions',
            model: 'test/test-provider/test-model-1',
          }),
        },
      });

      const agent = mastra.getAgent('testAgent');
      expect(agent).toBeDefined();
      expect(agent.name).toBe('test-agent');
    });

    it('should allow adding agents with custom gateway models after Mastra initialization', () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      const agent = new Agent({
        name: 'dynamic-agent',
        instructions: 'Dynamically added agent',
        model: 'test/test-provider/test-model-2',
      });

      mastra.addAgent(agent, 'dynamicAgent');

      const retrievedAgent = mastra.getAgent('dynamicAgent');
      expect(retrievedAgent).toBeDefined();
      expect(retrievedAgent.name).toBe('dynamic-agent');
    });

    it('should support multiple agents using different custom gateways', async () => {
      const mastra = new Mastra({
        gateways: {
          g1: new Gateway1(),
          g2: new Gateway2(),
        },
        agents: {
          agent1: new Agent({
            name: 'agent-1',
            instructions: 'Agent 1',
            model: 'g1/provider-1/model-1',
          }),
          agent2: new Agent({
            name: 'agent-2',
            instructions: 'Agent 2',
            model: 'g2/provider-2/model-2',
          }),
        },
      });

      const agent1 = mastra.getAgent('agent1');
      const agent2 = mastra.getAgent('agent2');
      const llm1 = await agent1.getLLM();
      const llm2 = await agent2.getLLM();

      expect(llm1).toBeDefined();
      expect(llm2).toBeDefined();
      expect(llm1.getProvider()).toBe('provider-1');
      expect(llm2.getProvider()).toBe('provider-2');
    });
  });

  describe('Gateway Lifecycle', () => {
    it('should allow adding gateways after initialization', () => {
      const gateway1 = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: gateway1,
        },
      });

      expect(Object.keys(mastra.listGateways() ?? {})).toHaveLength(1);

      mastra.addGateway(new Gateway2(), 'g2');

      const gateways = mastra.listGateways();
      expect(Object.keys(gateways ?? {})).toHaveLength(2);
      expect(gateways?.test.name).toBe('test-gateway');
      expect(gateways?.g2.name).toBe('gateway-2');
    });

    it('should not replace existing gateways when adding with same key', () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      mastra.addGateway(new Gateway2(), 'test'); // Try to add with same key

      const gateways = mastra.listGateways();
      expect(Object.keys(gateways ?? {})).toHaveLength(1);
      expect(gateways?.test).toBe(testGateway); // Original gateway should remain
      expect(gateways?.test.name).toBe('test-gateway');
    });

    it('should use gateway name as key if no key provided', () => {
      const mastra = new Mastra();

      const gateway = new Gateway2();

      mastra.addGateway(gateway); // No key provided, should use gateway.name = 'gateway-2'

      const gateways = mastra.listGateways();
      expect(gateways?.['gateway-2']).toBe(gateway);
    });
  });

  describe('Type Safety', () => {
    it('should accept MastraModelGateway instances', () => {
      const testGateway: MastraModelGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      expect(mastra.listGateways()).toBeDefined();
    });

    it('should return correct type from listGateways', () => {
      const testGateway = new TestGateway();
      const mastra = new Mastra({
        gateways: {
          test: testGateway,
        },
      });

      const gateways: Record<string, MastraModelGateway> | undefined = mastra.listGateways();
      expect(gateways).toBeDefined();
    });
  });
});
