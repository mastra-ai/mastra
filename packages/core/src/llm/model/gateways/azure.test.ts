import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AzureOpenAIGateway } from './azure';
import type { AzureOpenAIGatewayConfig } from './azure';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('AzureOpenAIGateway', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Configuration Validation', () => {
    it('should throw error if resourceName missing', () => {
      expect(() => {
        new AzureOpenAIGateway({
          apiKey: 'test-key',
          deployments: ['gpt-4'],
        } as AzureOpenAIGatewayConfig);
      }).toThrow('resourceName is required');
    });

    it('should throw error if apiKey missing', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          deployments: ['gpt-4'],
        } as AzureOpenAIGatewayConfig);
      }).toThrow('apiKey is required');
    });

    it('should allow neither deployments nor management (manual deployment names)', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          apiKey: 'test-key',
        });
      }).not.toThrow();
    });

    it('should warn if both deployments and management provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-4'],
        management: {
          tenantId: 'tenant',
          clientId: 'client',
          clientSecret: 'secret',
          subscriptionId: 'sub',
          resourceGroup: 'rg',
        },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Both deployments and management credentials provided'),
      );
      warnSpy.mockRestore();
    });

    it('should throw error if management credentials incomplete', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          apiKey: 'test-key',
          management: {
            tenantId: 'tenant',
            clientId: 'client',
          } as any,
        });
      }).toThrow('Management credentials incomplete');
    });

    it('should validate all missing management fields', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          apiKey: 'test-key',
          management: {} as any,
        });
      }).toThrow(/tenantId.*clientId.*clientSecret.*subscriptionId.*resourceGroup/);
    });
  });

  describe('Static Deployments Mode', () => {
    it('should return static deployments without API calls', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-4-prod', 'gpt-35-turbo-dev'],
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual(['gpt-4-prod', 'gpt-35-turbo-dev']);
      expect(providers['azure-openai'].name).toBe('Azure OpenAI');
      expect(providers['azure-openai'].gateway).toBe('azure-openai');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use static deployments even if management provided', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-4'],
        management: {
          tenantId: 'tenant',
          clientId: 'client',
          clientSecret: 'secret',
          subscriptionId: 'sub',
          resourceGroup: 'rg',
        },
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual(['gpt-4']);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty models for empty deployments without management', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: [],
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('No Configuration Mode', () => {
    it('should return empty models when neither deployments nor management provided', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual([]);
      expect(providers['azure-openai'].name).toBe('Azure OpenAI');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Discovery Mode', () => {
    const mockTokenResponse = {
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: 'mock-access-token',
    };

    const mockDeploymentsResponse = {
      value: [
        {
          name: 'my-gpt4',
          properties: {
            model: { name: 'gpt-4', version: '0613', format: 'OpenAI' },
            provisioningState: 'Succeeded',
          },
        },
        {
          name: 'staging-gpt-4o',
          properties: {
            model: { name: 'gpt-4o', version: '2024-05-13', format: 'OpenAI' },
            provisioningState: 'Succeeded',
          },
        },
        {
          name: 'creating-deployment',
          properties: {
            model: { name: 'gpt-35-turbo', version: '0613', format: 'OpenAI' },
            provisioningState: 'Creating',
          },
        },
      ],
    };

    beforeEach(() => {
      mockFetch.mockClear();
    });

    it('should fetch token and deployments from Management API', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeploymentsResponse,
        });

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        management: {
          tenantId: 'test-tenant',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          subscriptionId: 'test-sub',
          resourceGroup: 'test-rg',
        },
      });

      const providers = await gateway.fetchProviders();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/subscriptions/test-sub/resourceGroups/test-rg'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        }),
      );

      expect(providers['azure-openai'].models).toEqual(['my-gpt4', 'staging-gpt-4o']);
      expect(providers['azure-openai'].models).not.toContain('creating-deployment');
    });

    it('should use discovery mode when deployments is empty array with management', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeploymentsResponse,
        });

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: [],
        management: {
          tenantId: 'test-tenant',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          subscriptionId: 'test-sub',
          resourceGroup: 'test-rg',
        },
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual(['my-gpt4', 'staging-gpt-4o']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle pagination when fetching deployments', async () => {
      const page1Response = {
        value: [
          {
            name: 'deployment-1',
            properties: {
              model: { name: 'gpt-4', version: '0613', format: 'OpenAI' },
              provisioningState: 'Succeeded',
            },
          },
        ],
        nextLink:
          'https://management.azure.com/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.CognitiveServices/accounts/test-resource/deployments?api-version=2024-10-01&$skiptoken=abc',
      };

      const page2Response = {
        value: [
          {
            name: 'deployment-2',
            properties: {
              model: { name: 'gpt-4o', version: '2024-05-13', format: 'OpenAI' },
              provisioningState: 'Succeeded',
            },
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page1Response,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page2Response,
        });

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        management: {
          tenantId: 'test-tenant',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          subscriptionId: 'test-sub',
          resourceGroup: 'test-rg',
        },
      });

      const providers = await gateway.fetchProviders();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(providers['azure-openai'].models).toEqual(['deployment-1', 'deployment-2']);
    });

    it('should return fallback config if token fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        management: {
          tenantId: 'test-tenant',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          subscriptionId: 'test-sub',
          resourceGroup: 'test-rg',
        },
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment discovery failed'), expect.anything());

      warnSpy.mockRestore();
    });

    it('should return fallback config if deployments fetch fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        management: {
          tenantId: 'test-tenant',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          subscriptionId: 'test-sub',
          resourceGroup: 'test-rg',
        },
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('Token Caching', () => {
    const mockTokenResponse = {
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: 'mock-token',
    };

    const mockDeploymentsResponse = {
      value: [
        {
          name: 'test-deployment',
          properties: {
            model: { name: 'gpt-4', version: '0613', format: 'OpenAI' },
            provisioningState: 'Succeeded',
          },
        },
      ],
    };

    it('should cache and reuse tokens', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeploymentsResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeploymentsResponse,
        });

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        management: {
          tenantId: 'test-tenant',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          subscriptionId: 'test-sub',
          resourceGroup: 'test-rg',
        },
      });

      await gateway.fetchProviders();
      await gateway.fetchProviders();

      const tokenCalls = mockFetch.mock.calls.filter((call: any) => call[0].includes('login.microsoftonline.com'));
      expect(tokenCalls.length).toBe(1);

      const deploymentCalls = mockFetch.mock.calls.filter((call: any) => call[0].includes('deployments'));
      expect(deploymentCalls.length).toBe(2);
    });
  });

  describe('buildUrl', () => {
    it('should return undefined (Azure SDK constructs URLs internally)', () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-4'],
      });

      const url = gateway.buildUrl('azure-openai/gpt-4', {});
      expect(url).toBeUndefined();
    });
  });

  describe('getApiKey', () => {
    it('should return the configured API key', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'my-test-key',
        deployments: ['gpt-4'],
      });

      const apiKey = await gateway.getApiKey('gpt-4');
      expect(apiKey).toBe('my-test-key');
    });
  });

  describe('resolveLanguageModel', () => {
    it('should create language model with configured values', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        apiVersion: '2024-04-01-preview',
        deployments: ['gpt-4'],
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-4',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      });

      expect(model).toBeDefined();
    });

    it('should use default API version if not provided', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-4'],
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-4',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      });

      expect(model).toBeDefined();
    });
  });
});
