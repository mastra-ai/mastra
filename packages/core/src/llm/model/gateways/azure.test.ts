import { createAzure } from '@ai-sdk/azure';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AzureOpenAIGateway } from './azure';
import type { AzureOpenAIGatewayConfig } from './azure';
import { MASTRA_GATEWAY_STREAM_TRANSPORT } from './base';

const { wsFetch, wsClose } = vi.hoisted(() => {
  const wsClose = vi.fn();
  const wsFetch = Object.assign(
    vi.fn(async () => new Response('')),
    { close: wsClose },
  );

  return { wsFetch, wsClose };
});

vi.mock('@ai-sdk/azure', () => ({
  createAzure: vi.fn((options: Record<string, unknown>) => {
    const provider = vi.fn((modelId: string) => ({ modelId, options }));
    provider.responses = vi.fn((modelId: string) => ({
      modelId,
      options,
      api: 'responses',
      doGenerate: vi.fn(async callOptions => ({ callOptions })),
      doStream: vi.fn(async callOptions => ({ callOptions })),
    }));
    return provider;
  }),
}));

vi.mock('../openai-websocket-fetch.js', () => ({
  createOpenAIWebSocketFetch: vi.fn(() => wsFetch),
}));

const { createOpenAIWebSocketFetch } = await import('../openai-websocket-fetch.js');

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('AzureOpenAIGateway', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    wsFetch.mockClear();
    wsClose.mockClear();
  });

  describe('Configuration Validation', () => {
    it('should throw error if resourceName missing', () => {
      expect(() => {
        new AzureOpenAIGateway({
          apiKey: 'test-key',
          deployments: ['gpt-5-4-deployment'],
        } as AzureOpenAIGatewayConfig);
      }).toThrow('resourceName is required');
    });

    it('should throw error if apiKey and Entra ID authentication are missing', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          deployments: ['gpt-5-4-deployment'],
        } as AzureOpenAIGatewayConfig);
      }).toThrow('apiKey or Entra ID authentication is required');
    });

    it('should allow Entra ID authentication without apiKey', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          deployments: ['gpt-5-4-deployment'],
          authentication: {
            type: 'entraId',
            credential: {
              getToken: vi.fn(),
            },
          },
        });
      }).not.toThrow();
    });

    it('should throw error if Entra ID credential missing', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          deployments: ['gpt-5-4-deployment'],
          authentication: {
            type: 'entraId',
          } as any,
        });
      }).toThrow('credential is required');
    });

    it('should warn if both apiKey and Entra ID authentication provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-5-4-deployment'],
        authentication: {
          type: 'entraId',
          credential: {
            getToken: vi.fn(),
          },
        },
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Both apiKey and Entra ID authentication provided'));
      warnSpy.mockRestore();
    });

    it('should reject Responses API with deployment-based URLs', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          apiKey: 'test-key',
          useResponsesAPI: true,
          useDeploymentBasedUrls: true,
          deployments: ['gpt-5-4-deployment'],
        });
      }).toThrow('useResponsesAPI: true cannot be combined with useDeploymentBasedUrls: true');
    });

    it('should warn if both deployments and management provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-5-4-deployment'],
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

    it('should allow neither deployments nor management (manual deployment names)', () => {
      expect(() => {
        new AzureOpenAIGateway({
          resourceName: 'test-resource',
          apiKey: 'test-key',
        });
      }).not.toThrow();
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
        deployments: ['gpt-5-4-prod', 'gpt-5-4-mini-dev'],
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual(['gpt-5-4-prod', 'gpt-5-4-mini-dev']);
      expect(providers['azure-openai'].name).toBe('Azure OpenAI');
      expect(providers['azure-openai'].gateway).toBe('azure-openai');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use static deployments even if management provided', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-5-4-deployment'],
        management: {
          tenantId: 'tenant',
          clientId: 'client',
          clientSecret: 'secret',
          subscriptionId: 'sub',
          resourceGroup: 'rg',
        },
      });

      const providers = await gateway.fetchProviders();

      expect(providers['azure-openai'].models).toEqual(['gpt-5-4-deployment']);
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
          name: 'my-gpt-5-4',
          properties: {
            model: { name: 'gpt-5-4-deployment', version: '0613', format: 'OpenAI' },
            provisioningState: 'Succeeded',
          },
        },
        {
          name: 'staging-gpt-5-4-mini',
          properties: {
            model: { name: 'gpt-5-4-mini', version: '2024-05-13', format: 'OpenAI' },
            provisioningState: 'Succeeded',
          },
        },
        {
          name: 'creating-deployment',
          properties: {
            model: { name: 'gpt-5-4-mini', version: '0613', format: 'OpenAI' },
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

      expect(providers['azure-openai'].models).toEqual(['my-gpt-5-4', 'staging-gpt-5-4-mini']);
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

      expect(providers['azure-openai'].models).toEqual(['my-gpt-5-4', 'staging-gpt-5-4-mini']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle pagination when fetching deployments', async () => {
      const page1Response = {
        value: [
          {
            name: 'deployment-1',
            properties: {
              model: { name: 'gpt-5-4-deployment', version: '0613', format: 'OpenAI' },
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
              model: { name: 'gpt-5-4-mini', version: '2024-05-13', format: 'OpenAI' },
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
            model: { name: 'gpt-5-4-deployment', version: '0613', format: 'OpenAI' },
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
        deployments: ['gpt-5-4-deployment'],
      });

      const url = gateway.buildUrl('azure-openai/gpt-5-4-deployment', {});
      expect(url).toBeUndefined();
    });
  });

  describe('getApiKey', () => {
    it('should return the configured API key', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'my-test-key',
        deployments: ['gpt-5-4-deployment'],
      });

      const apiKey = await gateway.getApiKey('gpt-5-4-deployment');
      expect(apiKey).toBe('my-test-key');
    });

    it('should return empty API key when Entra ID authentication is configured', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'my-test-key',
        authentication: {
          type: 'entraId',
          credential: {
            getToken: vi.fn(),
          },
        },
        deployments: ['gpt-5-4-deployment'],
      });

      const apiKey = await gateway.getApiKey('gpt-5-4-deployment');
      expect(apiKey).toBe('');

      warnSpy.mockRestore();
    });
  });

  describe('resolveLanguageModel', () => {
    it('should create language model with configured values', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        apiVersion: '2024-04-01-preview',
        deployments: ['gpt-5-4-deployment'],
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      });

      expect(model).toBeDefined();
      expect(createAzure).toHaveBeenLastCalledWith(
        expect.objectContaining({
          resourceName: 'test-resource',
          apiKey: 'test-key',
          apiVersion: '2024-04-01-preview',
          useDeploymentBasedUrls: true,
        }),
      );
    });

    it('should use default API version if not provided', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        deployments: ['gpt-5-4-deployment'],
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      });

      expect(model).toBeDefined();
      expect(createAzure).toHaveBeenLastCalledWith(
        expect.objectContaining({
          apiVersion: '2024-04-01-preview',
          useDeploymentBasedUrls: true,
        }),
      );
    });

    it('should support Azure v1 API routing without deployment-based URLs', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        useDeploymentBasedUrls: false,
        deployments: ['gpt-5-4-deployment'],
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      });

      expect(model).toBeDefined();
      expect(createAzure).toHaveBeenLastCalledWith(
        expect.objectContaining({
          resourceName: 'test-resource',
          apiKey: 'test-key',
          apiVersion: 'v1',
          useDeploymentBasedUrls: false,
        }),
      );
    });

    it('should keep deployment-based URLs by default when apiVersion is v1', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        apiVersion: 'v1',
        deployments: ['gpt-5-4-deployment'],
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      });

      expect(model).toBeDefined();
      expect(createAzure).toHaveBeenLastCalledWith(
        expect.objectContaining({
          apiVersion: 'v1',
          useDeploymentBasedUrls: true,
        }),
      );
    });

    it('should keep deployment-based URLs by default when apiVersion is preview', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        apiVersion: 'preview',
        deployments: ['gpt-5-4-deployment'],
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      });

      expect(model).toBeDefined();
      expect(createAzure).toHaveBeenLastCalledWith(
        expect.objectContaining({
          apiVersion: 'preview',
          useDeploymentBasedUrls: true,
        }),
      );
    });

    it('should reject Azure Responses API with date-based API versions', () => {
      expect(
        () =>
          new AzureOpenAIGateway({
            resourceName: 'test-resource',
            apiKey: 'test-key',
            useResponsesAPI: true,
            apiVersion: '2024-04-01-preview',
          }),
      ).toThrow('useResponsesAPI: true requires apiVersion: "v1" or apiVersion: "preview"');
    });

    it('should reject non-deployment routing with date-based API versions', () => {
      expect(
        () =>
          new AzureOpenAIGateway({
            resourceName: 'test-resource',
            apiKey: 'test-key',
            apiVersion: '2024-04-01-preview',
            useDeploymentBasedUrls: false,
          }),
      ).toThrow('useDeploymentBasedUrls: false requires apiVersion: "v1" or apiVersion: "preview"');
    });

    it('should resolve Azure Responses API models with v1 non-deployment routing by default', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        useResponsesAPI: true,
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      })) as any;

      expect(model.api).toBe('responses');
      expect(model.modelId).toBe('gpt-5-4-deployment');
      expect(createAzure).toHaveBeenLastCalledWith(
        expect.objectContaining({
          resourceName: 'test-resource',
          apiKey: 'test-key',
          apiVersion: 'v1',
          useDeploymentBasedUrls: false,
        }),
      );
    });

    it('should use Azure Responses WebSocket fetch when requested', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        useResponsesAPI: true,
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
        transport: 'websocket',
        openaiWebSocket: {
          headers: { 'x-ms-client-request-id': 'request-1' },
        },
      })) as any;

      expect(model.api).toBe('responses');
      expect(createOpenAIWebSocketFetch).toHaveBeenLastCalledWith({
        url: 'wss://test-resource.openai.azure.com/openai/v1/responses',
        headers: { 'x-ms-client-request-id': 'request-1' },
        apiKeyAsBearer: true,
        betaHeader: false,
      });
      expect(createAzure).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fetch: wsFetch,
          apiVersion: 'v1',
          useDeploymentBasedUrls: false,
        }),
      );
      expect(model[MASTRA_GATEWAY_STREAM_TRANSPORT].close).toBe(wsClose);
    });

    it('should use a custom Azure Responses WebSocket URL when provided', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        useResponsesAPI: true,
        deployments: ['gpt-5-4-deployment'],
      });

      await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
        transport: 'websocket',
        openaiWebSocket: {
          url: 'wss://proxy.example.com/openai/v1/responses',
        },
      });

      expect(createOpenAIWebSocketFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'wss://proxy.example.com/openai/v1/responses',
        }),
      );
    });

    it('should route Azure Responses WebSocket Entra ID auth through the token fetch wrapper', async () => {
      const credential = {
        getToken: vi.fn().mockResolvedValue({
          token: 'entra-token',
          expiresOnTimestamp: Date.now() + 3600_000,
        }),
      };

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        authentication: {
          type: 'entraId',
          credential,
        },
        useResponsesAPI: true,
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: await gateway.getApiKey('gpt-5-4-deployment'),
        transport: 'websocket',
      })) as any;

      expect(createOpenAIWebSocketFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          apiKeyAsBearer: false,
          betaHeader: false,
        }),
      );

      await model.options.fetch('https://test-resource.openai.azure.com/openai/v1/responses', {
        method: 'POST',
        headers: {
          'api-key': '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stream: true, model: 'gpt-5-4-deployment', input: 'hello' }),
      });

      const fetchHeaders = wsFetch.mock.calls.at(-1)?.[1].headers as Headers;
      expect(fetchHeaders.get('Authorization')).toBe('Bearer entra-token');
      expect(fetchHeaders.has('api-key')).toBe(false);
    });

    it('should mirror Azure Responses item IDs only inside Azure Responses model calls', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        useResponsesAPI: true,
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      })) as any;

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: '',
                providerOptions: {
                  azure: {
                    itemId: 'rs_azure_reasoning',
                  },
                },
              },
            ],
          },
        ],
      });

      expect(result.callOptions.prompt[0].content[0].providerOptions).toEqual({
        azure: { itemId: 'rs_azure_reasoning' },
        openai: { itemId: 'rs_azure_reasoning' },
      });
    });

    it('should mirror Azure Responses call provider options for the OpenAI converter', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        useResponsesAPI: true,
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      })) as any;

      const providerOptions = {
        azure: {
          store: false,
          previousResponseId: 'resp_azure_123',
        },
        openai: {
          store: true,
          previousResponseId: 'resp_openai_stale',
          serviceTier: 'priority',
        },
      };

      const generateResult = await model.doGenerate({
        providerOptions,
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });
      const streamResult = await model.doStream({
        providerOptions,
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(generateResult.callOptions.providerOptions).toEqual({
        azure: {
          store: false,
          previousResponseId: 'resp_azure_123',
        },
        openai: {
          store: false,
          previousResponseId: 'resp_azure_123',
          serviceTier: 'priority',
        },
      });
      expect(streamResult.callOptions.providerOptions).toEqual(generateResult.callOptions.providerOptions);
    });

    it('should mirror Azure Responses provider options on non-assistant message parts', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        useResponsesAPI: true,
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      })) as any;

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: new URL('https://example.com/image.png'),
                mediaType: 'image/png',
                providerOptions: {
                  azure: {
                    imageDetail: 'high',
                  },
                },
              },
            ],
          },
        ],
      });

      expect(result.callOptions.prompt[0].content[0].providerOptions).toEqual({
        azure: { imageDetail: 'high' },
        openai: { imageDetail: 'high' },
      });
    });

    it('should mirror Azure Responses provider options on message-level options', async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiKey: 'test-key',
        useResponsesAPI: true,
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: 'test-key',
      })) as any;

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'system',
            content: 'Use the stored response context.',
            providerOptions: {
              azure: {
                previousResponseId: 'resp_azure_message',
              },
            },
          },
        ],
      });

      expect(result.callOptions.prompt[0].providerOptions).toEqual({
        azure: { previousResponseId: 'resp_azure_message' },
        openai: { previousResponseId: 'resp_azure_message' },
      });
    });

    it('should use Entra ID bearer auth through custom fetch', async () => {
      const credential = {
        getToken: vi.fn().mockResolvedValue({
          token: 'entra-token',
          expiresOnTimestamp: Date.now() + 3600_000,
        }),
      };

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        authentication: {
          type: 'entraId',
          credential,
        },
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: await gateway.getApiKey('gpt-5-4-deployment'),
      })) as any;

      expect(model.options.apiKey).toBe('');

      mockFetch.mockResolvedValueOnce(new Response('{}'));

      await model.options.fetch(
        'https://test-resource.openai.azure.com/openai/deployments/gpt-5-4-deployment/chat/completions',
        {
          headers: {
            'api-key': '',
            'Content-Type': 'application/json',
          },
        },
      );

      expect(credential.getToken).toHaveBeenCalledWith('https://cognitiveservices.azure.com/.default');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-resource.openai.azure.com/openai/deployments/gpt-5-4-deployment/chat/completions',
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );

      const headers = mockFetch.mock.calls.at(-1)?.[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer entra-token');
      expect(headers.has('api-key')).toBe(false);
    });

    it('should support Azure v1 API routing with Entra ID authentication', async () => {
      const credential = {
        getToken: vi.fn().mockResolvedValue({
          token: 'entra-token',
          expiresOnTimestamp: Date.now() + 3600_000,
        }),
      };

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        apiVersion: 'v1',
        useDeploymentBasedUrls: false,
        authentication: {
          type: 'entraId',
          credential,
        },
        deployments: ['gpt-5-4-deployment'],
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: await gateway.getApiKey('gpt-5-4-deployment'),
      });

      expect(model).toBeDefined();
      expect(createAzure).toHaveBeenLastCalledWith(
        expect.objectContaining({
          apiKey: '',
          apiVersion: 'v1',
          useDeploymentBasedUrls: false,
          fetch: expect.any(Function),
        }),
      );
    });

    it('should cache Entra ID tokens', async () => {
      const credential = {
        getToken: vi.fn().mockResolvedValue({
          token: 'cached-token',
          expiresOnTimestamp: Date.now() + 3600_000,
        }),
      };

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        authentication: {
          type: 'entraId',
          credential,
        },
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: await gateway.getApiKey('gpt-5-4-deployment'),
      })) as any;

      mockFetch.mockResolvedValue(new Response('{}'));

      await model.options.fetch(
        'https://test-resource.openai.azure.com/openai/deployments/gpt-5-4-deployment/chat/completions',
        {
          headers: { 'api-key': '' },
        },
      );
      await model.options.fetch(
        'https://test-resource.openai.azure.com/openai/deployments/gpt-5-4-deployment/chat/completions',
        {
          headers: { 'api-key': '' },
        },
      );

      expect(credential.getToken).toHaveBeenCalledTimes(1);
    });

    it('should reject Entra ID fetches when the credential returns no token', async () => {
      const credential = {
        getToken: vi.fn().mockResolvedValue(null),
      };

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        authentication: {
          type: 'entraId',
          credential,
        },
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: await gateway.getApiKey('gpt-5-4-deployment'),
      })) as any;

      await expect(
        model.options.fetch(
          'https://test-resource.openai.azure.com/openai/deployments/gpt-5-4-deployment/chat/completions',
          {
            headers: { 'api-key': '' },
          },
        ),
      ).rejects.toThrow('Failed to get Entra ID token for Azure OpenAI gateway');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should surface Entra ID credential errors and allow a later retry', async () => {
      const credential = {
        getToken: vi
          .fn()
          .mockRejectedValueOnce(new Error('credential unavailable'))
          .mockResolvedValueOnce({
            token: 'retry-token',
            expiresOnTimestamp: Date.now() + 3600_000,
          }),
      };

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        authentication: {
          type: 'entraId',
          credential,
        },
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: await gateway.getApiKey('gpt-5-4-deployment'),
      })) as any;

      const url = 'https://test-resource.openai.azure.com/openai/deployments/gpt-5-4-deployment/chat/completions';
      await expect(model.options.fetch(url, { headers: { 'api-key': '' } })).rejects.toThrow('credential unavailable');

      mockFetch.mockResolvedValueOnce(new Response('{}'));
      await model.options.fetch(url, { headers: { 'api-key': '' } });

      expect(credential.getToken).toHaveBeenCalledTimes(2);
      const headers = mockFetch.mock.calls.at(-1)?.[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer retry-token');
    });

    it('should dedupe concurrent Entra ID token requests', async () => {
      let resolveToken: (value: { token: string; expiresOnTimestamp: number }) => void = () => {};
      const tokenPromise = new Promise<{ token: string; expiresOnTimestamp: number }>(resolve => {
        resolveToken = resolve;
      });
      const credential = {
        getToken: vi.fn().mockReturnValue(tokenPromise),
      };

      const gateway = new AzureOpenAIGateway({
        resourceName: 'test-resource',
        authentication: {
          type: 'entraId',
          credential,
        },
        deployments: ['gpt-5-4-deployment'],
      });

      const model = (await gateway.resolveLanguageModel({
        modelId: 'gpt-5-4-deployment',
        providerId: 'azure-openai',
        apiKey: await gateway.getApiKey('gpt-5-4-deployment'),
      })) as any;

      mockFetch.mockResolvedValue(new Response('{}'));

      const requests = [
        model.options.fetch(
          'https://test-resource.openai.azure.com/openai/deployments/gpt-5-4-deployment/chat/completions',
          {
            headers: { 'api-key': '' },
          },
        ),
        model.options.fetch(
          'https://test-resource.openai.azure.com/openai/deployments/gpt-5-4-deployment/chat/completions',
          {
            headers: { 'api-key': '' },
          },
        ),
      ];

      await Promise.resolve();

      expect(credential.getToken).toHaveBeenCalledTimes(1);

      resolveToken({
        token: 'deduped-token',
        expiresOnTimestamp: Date.now() + 3600_000,
      });

      await Promise.all(requests);

      expect(credential.getToken).toHaveBeenCalledTimes(1);
      const headers = mockFetch.mock.calls.at(-1)?.[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer deduped-token');
    });
  });
});
