import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AzureOpenAIGateway } from './azure';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('AzureOpenAIGateway', () => {
  let gateway: AzureOpenAIGateway;

  beforeEach(() => {
    gateway = new AzureOpenAIGateway();
    mockFetch.mockClear();

    delete process.env.AZURE_TENANT_ID;
    delete process.env.AZURE_CLIENT_ID;
    delete process.env.AZURE_CLIENT_SECRET;
    delete process.env.AZURE_SUBSCRIPTION_ID;
    delete process.env.AZURE_RESOURCE_GROUP;
    delete process.env.AZURE_RESOURCE_NAME;
    delete process.env.AZURE_API_KEY;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchProviders', () => {
    const mockEnvVars = {
      AZURE_TENANT_ID: 'tenant-123',
      AZURE_CLIENT_ID: 'client-456',
      AZURE_CLIENT_SECRET: 'secret-789',
      AZURE_SUBSCRIPTION_ID: 'sub-abc',
      AZURE_RESOURCE_GROUP: 'my-rg',
      AZURE_RESOURCE_NAME: 'my-openai',
    };

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
            model: {
              name: 'gpt-4',
              version: '0613',
              format: 'OpenAI',
            },
            provisioningState: 'Succeeded',
          },
        },
        {
          name: 'staging-gpt-4o',
          properties: {
            model: {
              name: 'gpt-4o',
              version: '2024-05-13',
              format: 'OpenAI',
            },
            provisioningState: 'Succeeded',
          },
        },
        {
          name: 'creating-deployment',
          properties: {
            model: {
              name: 'gpt-35-turbo',
              version: '0613',
              format: 'OpenAI',
            },
            provisioningState: 'Creating', // Should be filtered out
          },
        },
      ],
    };

    beforeEach(() => {
      Object.assign(process.env, mockEnvVars);
    });

    it('should fetch and parse deployments from Azure Management API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeploymentsResponse,
      });

      const providers = await gateway.fetchProviders();

      // Verify token endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      const tokenCallArgs = mockFetch.mock.calls.find(call => call[0].includes('login.microsoftonline.com'));
      const requestBody = tokenCallArgs?.[1]?.body as string;
      expect(requestBody).toContain('grant_type=client_credentials');
      expect(requestBody).toContain('client_id=client-456');
      expect(requestBody).toContain('client_secret=secret-789');
      expect(requestBody).toContain('scope=https%3A%2F%2Fmanagement.azure.com%2F.default');

      // Verify deployments endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://management.azure.com/subscriptions/sub-abc/resourceGroups/my-rg/providers/Microsoft.CognitiveServices/accounts/my-openai/deployments',
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        }),
      );

      expect(providers).toBeDefined();
      expect(providers['azureopenai']).toBeDefined();
      expect(providers['azureopenai'].models).toContain('my-gpt4');
      expect(providers['azureopenai'].models).toContain('staging-gpt-4o');
      expect(providers['azureopenai'].models).not.toContain('creating-deployment'); // Filtered out
    });

    it('should return ProviderConfig with correct format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeploymentsResponse,
      });

      const providers = await gateway.fetchProviders();

      const azureConfig = providers['azureopenai'];
      expect(azureConfig).toBeDefined();
      expect(azureConfig.apiKeyEnvVar).toBe('AZURE_API_KEY');
      expect(azureConfig.apiKeyHeader).toBe('api-key');
      expect(azureConfig.name).toBe('Azure OpenAI');
      expect(azureConfig.gateway).toBe('azureopenai');
      expect(azureConfig.models.length).toBe(2); // Only 'Succeeded' deployments
    });

    it('should cache Azure AD token', async () => {
      // First call - fetch token
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeploymentsResponse,
        });

      await gateway.fetchProviders();

      // Second call - should use cached token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeploymentsResponse,
      });

      await gateway.fetchProviders();

      // Token endpoint should only be called once (cached on second call)
      const tokenCalls = mockFetch.mock.calls.filter(call => call[0].includes('login.microsoftonline.com'));
      expect(tokenCalls.length).toBe(1);
    });

    it('should refetch token when cached token is about to expire', async () => {
      // First call - fetch token that expires in less than 60 seconds
      const expiringTokenResponse = {
        token_type: 'Bearer',
        expires_in: 50,
        access_token: 'expiring-token',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => expiringTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeploymentsResponse,
        });

      await gateway.fetchProviders();

      // Second call - should fetch new token because cached one expires in <60s
      const freshTokenResponse = {
        token_type: 'Bearer',
        expires_in: 3600,
        access_token: 'fresh-token',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => freshTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeploymentsResponse,
        });

      await gateway.fetchProviders();

      // Token endpoint should be called twice (not cached because token expires within 60 seconds)
      const tokenCalls = mockFetch.mock.calls.filter(call => call[0].includes('login.microsoftonline.com'));
      expect(tokenCalls.length).toBe(2);
    });

    it('should handle paginated deployment responses', async () => {
      const firstPageResponse = {
        value: [
          {
            name: 'deployment-1',
            properties: {
              model: {
                name: 'gpt-4',
                version: '0613',
                format: 'OpenAI',
              },
              provisioningState: 'Succeeded',
            },
          },
          {
            name: 'deployment-2',
            properties: {
              model: {
                name: 'gpt-35-turbo',
                version: '0613',
                format: 'OpenAI',
              },
              provisioningState: 'Succeeded',
            },
          },
        ],
        nextLink:
          'https://management.azure.com/subscriptions/sub-abc/resourceGroups/my-rg/providers/Microsoft.CognitiveServices/accounts/my-openai/deployments?api-version=2024-10-01&$skiptoken=abc123',
      };

      const secondPageResponse = {
        value: [
          {
            name: 'deployment-3',
            properties: {
              model: {
                name: 'gpt-4o',
                version: '2024-05-13',
                format: 'OpenAI',
              },
              provisioningState: 'Succeeded',
            },
          },
          {
            name: 'deployment-4',
            properties: {
              model: {
                name: 'text-embedding-ada-002',
                version: '1',
                format: 'OpenAI',
              },
              provisioningState: 'Creating', // Should be filtered out
            },
          },
        ],
        // No nextLink - end of pagination
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => firstPageResponse,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => secondPageResponse,
      });

      const providers = await gateway.fetchProviders();

      const tokenCalls = mockFetch.mock.calls.filter(call => call[0].includes('login.microsoftonline.com'));
      expect(tokenCalls.length).toBe(1);

      const deploymentCalls = mockFetch.mock.calls.filter(
        call => call[0].includes('management.azure.com') && call[0].includes('/deployments'),
      );
      expect(deploymentCalls.length).toBe(2);

      expect(deploymentCalls[1][0]).toBe(firstPageResponse.nextLink);

      expect(providers['azureopenai'].models).toHaveLength(3);
      expect(providers['azureopenai'].models).toContain('deployment-1');
      expect(providers['azureopenai'].models).toContain('deployment-2');
      expect(providers['azureopenai'].models).toContain('deployment-3');
      expect(providers['azureopenai'].models).not.toContain('deployment-4');
    });

    it('should return graceful fallback when Management API credentials are missing', async () => {
      delete process.env.AZURE_TENANT_ID;

      const result = await gateway.fetchProviders();

      expect(result).toMatchObject({
        azureopenai: {
          apiKeyEnvVar: 'AZURE_API_KEY',
          models: [],
          gateway: 'azureopenai',
        },
      });
    });

    it('should return graceful fallback on Azure AD authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const result = await gateway.fetchProviders();

      expect(result).toMatchObject({
        azureopenai: {
          apiKeyEnvVar: 'AZURE_API_KEY',
          models: [],
          gateway: 'azureopenai',
        },
      });
    });

    it('should return graceful fallback on Management API fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const result = await gateway.fetchProviders();

      expect(result).toMatchObject({
        azureopenai: {
          apiKeyEnvVar: 'AZURE_API_KEY',
          models: [],
          gateway: 'azureopenai',
        },
      });
    });
  });

  describe('buildUrl', () => {
    it('should return undefined (SDK handles URL construction)', () => {
      const url = gateway.buildUrl('azureopenai/my-deployment');
      expect(url).toBeUndefined();
    });
  });

  describe('getApiKey', () => {
    it('should return AZURE_API_KEY from environment', async () => {
      process.env.AZURE_API_KEY = 'test-api-key';

      const apiKey = await gateway.getApiKey('azureopenai/my-deployment');

      expect(apiKey).toBe('test-api-key');
    });

    it('should throw error when AZURE_API_KEY is missing', async () => {
      delete process.env.AZURE_API_KEY;

      await expect(gateway.getApiKey('azureopenai/my-deployment')).rejects.toThrow('Missing AZURE_API_KEY');
    });
  });

  describe('resolveLanguageModel', () => {
    it('should create Azure language model with deployment name', async () => {
      process.env.AZURE_RESOURCE_NAME = 'my-resource';
      process.env.AZURE_API_KEY = 'test-key';

      await expect(
        gateway.resolveLanguageModel({ modelId: 'my-gpt4', providerId: 'azureopenai', apiKey: 'test-key' }),
      ).resolves.toBeDefined();
    });

    it('should throw error when AZURE_RESOURCE_NAME is missing', async () => {
      delete process.env.AZURE_RESOURCE_NAME;

      await expect(
        gateway.resolveLanguageModel({
          modelId: 'my-gpt4',
          providerId: 'azureopenai',
          apiKey: 'test-key',
        }),
      ).rejects.toThrow('Missing AZURE_RESOURCE_NAME');
    });

    it('should use default API version when not specified', async () => {
      process.env.AZURE_RESOURCE_NAME = 'my-resource';
      delete process.env.OPENAI_API_VERSION;

      await expect(
        gateway.resolveLanguageModel({ modelId: 'my-gpt4', providerId: 'azureopenai', apiKey: 'test-key' }),
      ).resolves.toBeDefined();
    });
  });
});
