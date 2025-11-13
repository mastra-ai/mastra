import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AzureGateway } from './azure';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('AzureGateway', () => {
  let gateway: AzureGateway;

  beforeEach(() => {
    gateway = new AzureGateway();
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
      // Set environment variables
      Object.assign(process.env, mockEnvVars);
    });

    it('should fetch and parse deployments from Azure Management API', async () => {
      // Mock token endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      // Mock deployments endpoint
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

      // Verify provider config
      expect(providers).toBeDefined();
      expect(providers['azure']).toBeDefined();
      expect(providers['azure'].models).toContain('my-gpt4');
      expect(providers['azure'].models).toContain('staging-gpt-4o');
      expect(providers['azure'].models).not.toContain('creating-deployment'); // Filtered out
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

      const azureConfig = providers['azure'];
      expect(azureConfig).toBeDefined();
      expect(azureConfig.apiKeyEnvVar).toBe('AZURE_API_KEY');
      expect(azureConfig.apiKeyHeader).toBe('api-key');
      expect(azureConfig.name).toBe('Azure OpenAI');
      expect(azureConfig.gateway).toBe('azure');
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

    it('should handle missing Management API credentials gracefully', async () => {
      // Remove credentials
      delete process.env.AZURE_TENANT_ID;

      const providers = await gateway.fetchProviders();

      // Should return empty models list but not throw
      expect(providers['azure']).toBeDefined();
      expect(providers['azure'].models).toEqual([]);
    });

    it('should handle Azure AD authentication failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const providers = await gateway.fetchProviders();

      // Should return empty models list but not throw
      expect(providers['azure']).toBeDefined();
      expect(providers['azure'].models).toEqual([]);
    });

    it('should handle Management API fetch failure gracefully', async () => {
      // Token succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      // Deployments fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const providers = await gateway.fetchProviders();

      // Should return empty models list but not throw
      expect(providers['azure']).toBeDefined();
      expect(providers['azure'].models).toEqual([]);
    });
  });

  describe('buildUrl', () => {
    it('should return undefined (SDK handles URL construction)', () => {
      const url = gateway.buildUrl('azure/my-deployment');
      expect(url).toBeUndefined();
    });
  });

  describe('getApiKey', () => {
    it('should return AZURE_API_KEY from environment', async () => {
      process.env.AZURE_API_KEY = 'test-api-key';

      const apiKey = await gateway.getApiKey('azure/my-deployment');

      expect(apiKey).toBe('test-api-key');
    });

    it('should throw error when AZURE_API_KEY is missing', async () => {
      delete process.env.AZURE_API_KEY;

      await expect(gateway.getApiKey('azure/my-deployment')).rejects.toThrow('Missing AZURE_API_KEY');
    });
  });

  describe('resolveLanguageModel', () => {
    it('should create Azure language model with deployment name', async () => {
      process.env.AZURE_RESOURCE_NAME = 'my-resource';
      process.env.AZURE_API_KEY = 'test-key';

      // Note: This test will need to mock the @ai-sdk/azure module
      // For now, we can just verify it doesn't throw
      await expect(
        gateway.resolveLanguageModel({
          modelId: 'my-gpt4',
          providerId: 'azure',
          apiKey: 'test-key',
        }),
      ).resolves.toBeDefined();
    });

    it('should throw error when AZURE_RESOURCE_NAME is missing', async () => {
      delete process.env.AZURE_RESOURCE_NAME;

      await expect(
        gateway.resolveLanguageModel({
          modelId: 'my-gpt4',
          providerId: 'azure',
          apiKey: 'test-key',
        }),
      ).rejects.toThrow('Missing AZURE_RESOURCE_NAME');
    });

    it('should use default API version when not specified', async () => {
      process.env.AZURE_RESOURCE_NAME = 'my-resource';
      delete process.env.OPENAI_API_VERSION;

      // The SDK should be called with default version '2024-04-01-preview'
      // This would require mocking the createAzure function
      await expect(
        gateway.resolveLanguageModel({
          modelId: 'my-gpt4',
          providerId: 'azure',
          apiKey: 'test-key',
        }),
      ).resolves.toBeDefined();
    });
  });
});
