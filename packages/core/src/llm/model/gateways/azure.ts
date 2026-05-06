import { createAzure } from '@ai-sdk/azure';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { InMemoryServerCache } from '../../../cache/inmemory.js';
import { MastraError } from '../../../error/index.js';
import { createOpenAIWebSocketFetch } from '../openai-websocket-fetch.js';
import type { OpenAITransport, OpenAIWebSocketOptions } from '../provider-options.js';
import { MASTRA_GATEWAY_STREAM_TRANSPORT, MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';
import { MASTRA_USER_AGENT } from './constants.js';

interface AzureTokenResponse {
  token_type: 'Bearer';
  expires_in: number;
  access_token: string;
}

interface AzureDeployment {
  name: string;
  properties: {
    model: {
      name: string;
      version: string;
      format: string;
    };
    provisioningState: string;
  };
}

interface AzureDeploymentsResponse {
  value: AzureDeployment[];
  nextLink?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

type AzureLanguageModelCallOptions = Parameters<LanguageModelV2['doGenerate']>[0];

export interface AzureAccessToken {
  token: string;
  expiresOnTimestamp?: number;
}

export interface AzureTokenCredential {
  getToken(scopes: string | string[], options?: unknown): Promise<AzureAccessToken | null>;
}

export interface AzureOpenAIGatewayConfig {
  resourceName: string;
  apiKey?: string;
  apiVersion?: string;
  useResponsesAPI?: boolean;
  useDeploymentBasedUrls?: boolean;
  deployments?: string[];
  authentication?: {
    type: 'entraId';
    credential: AzureTokenCredential;
    scope?: string;
  };
  management?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    subscriptionId: string;
    resourceGroup: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mirrorAzureProviderOptionsForOpenAI<T>(providerOptions: T): T {
  if (!isRecord(providerOptions) || !isRecord(providerOptions.azure)) {
    return providerOptions;
  }

  const openai = isRecord(providerOptions.openai) ? providerOptions.openai : {};

  return {
    ...providerOptions,
    openai: {
      ...openai,
      ...providerOptions.azure,
    },
  } as T;
}

function mirrorAzureResponseProviderOptions(
  prompt: AzureLanguageModelCallOptions['prompt'],
): AzureLanguageModelCallOptions['prompt'] {
  let promptModified = false;

  const mirroredPrompt = prompt.map(message => {
    const messageWithProviderOptions = message as typeof message & { providerOptions?: unknown };
    const providerOptions = mirrorAzureProviderOptionsForOpenAI(messageWithProviderOptions.providerOptions);
    const providerOptionsModified = providerOptions !== messageWithProviderOptions.providerOptions;

    if (!Array.isArray(message.content)) {
      if (providerOptionsModified) {
        promptModified = true;
        return { ...message, providerOptions } as typeof message;
      }

      return message;
    }

    let contentModified = false;
    const content = message.content.map(part => {
      if (!('providerOptions' in part)) {
        return part;
      }

      const providerOptions = mirrorAzureProviderOptionsForOpenAI(part.providerOptions);
      if (providerOptions === part.providerOptions) {
        return part;
      }

      contentModified = true;
      return { ...part, providerOptions };
    }) as typeof message.content;

    if (!contentModified) {
      if (providerOptionsModified) {
        promptModified = true;
        return { ...message, providerOptions } as typeof message;
      }

      return message;
    }

    promptModified = true;
    return { ...message, ...(providerOptionsModified ? { providerOptions } : {}), content };
  });

  return (promptModified ? mirroredPrompt : prompt) as AzureLanguageModelCallOptions['prompt'];
}

function withAzureResponsesInputCompatibility(model: LanguageModelV2): LanguageModelV2 {
  return new Proxy(model, {
    get(target, property, receiver) {
      // Audit this wrapper when AI SDK adds new prompt-taking LanguageModelV2 methods.
      if (property === 'doGenerate') {
        return (options: AzureLanguageModelCallOptions) =>
          target.doGenerate({
            ...options,
            providerOptions: mirrorAzureProviderOptionsForOpenAI(options.providerOptions),
            prompt: mirrorAzureResponseProviderOptions(options.prompt),
          });
      }

      if (property === 'doStream') {
        return (options: Parameters<LanguageModelV2['doStream']>[0]) =>
          target.doStream({
            ...options,
            providerOptions: mirrorAzureProviderOptionsForOpenAI(options.providerOptions),
            prompt: mirrorAzureResponseProviderOptions(options.prompt),
          });
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

export class AzureOpenAIGateway extends MastraModelGateway {
  readonly id = 'azure-openai';
  readonly name = 'azure-openai';
  private tokenCache = new InMemoryServerCache();
  private entraIdTokenRequests = new Map<string, Promise<CachedToken>>();

  constructor(private config: AzureOpenAIGatewayConfig) {
    super();
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.resourceName) {
      throw new MastraError({
        id: 'AZURE_GATEWAY_INVALID_CONFIG',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'resourceName is required for Azure OpenAI gateway',
      });
    }

    if (!this.config.apiKey && this.config.authentication?.type !== 'entraId') {
      throw new MastraError({
        id: 'AZURE_GATEWAY_INVALID_CONFIG',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'apiKey or Entra ID authentication is required for Azure OpenAI gateway',
      });
    }

    if (this.config.authentication?.type === 'entraId' && !this.config.authentication.credential) {
      throw new MastraError({
        id: 'AZURE_GATEWAY_INVALID_CONFIG',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'credential is required for Azure OpenAI Entra ID authentication',
      });
    }

    if (this.config.apiKey && this.config.authentication?.type === 'entraId') {
      console.warn(
        '[AzureOpenAIGateway] Both apiKey and Entra ID authentication provided. Using Entra ID authentication and ignoring apiKey.',
      );
    }

    if (this.config.useResponsesAPI && this.config.useDeploymentBasedUrls === true) {
      throw new MastraError({
        id: 'AZURE_GATEWAY_INVALID_CONFIG',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'useResponsesAPI: true cannot be combined with useDeploymentBasedUrls: true. Omit useDeploymentBasedUrls or set it to false.',
      });
    }

    if (this.config.useResponsesAPI && this.config.apiVersion && !['v1', 'preview'].includes(this.config.apiVersion)) {
      throw new MastraError({
        id: 'AZURE_GATEWAY_INVALID_CONFIG',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'useResponsesAPI: true requires apiVersion: "v1" or apiVersion: "preview". Omit apiVersion to use "v1".',
      });
    }

    if (
      this.config.useDeploymentBasedUrls === false &&
      this.config.apiVersion &&
      !['v1', 'preview'].includes(this.config.apiVersion)
    ) {
      throw new MastraError({
        id: 'AZURE_GATEWAY_INVALID_CONFIG',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'useDeploymentBasedUrls: false requires apiVersion: "v1" or apiVersion: "preview". Omit apiVersion to use "v1".',
      });
    }

    const hasDeployments = this.config.deployments && this.config.deployments.length > 0;
    const hasManagement = this.config.management !== undefined;

    if (hasDeployments && hasManagement) {
      console.warn(
        '[AzureOpenAIGateway] Both deployments and management credentials provided. Using static deployments list and ignoring management API.',
      );
    }

    if (hasManagement) {
      this.getManagementCredentials(this.config.management!);
    }
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    if (this.config.deployments && this.config.deployments.length > 0) {
      return {
        'azure-openai': {
          apiKeyEnvVar: [],
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: this.config.deployments,
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azure-openai',
        },
      };
    }

    if (!this.config.management) {
      return {
        'azure-openai': {
          apiKeyEnvVar: [],
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: [],
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azure-openai',
        },
      };
    }

    try {
      const credentials = this.getManagementCredentials(this.config.management);

      const token = await this.getAzureADToken({
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      });

      const deployments = await this.fetchDeployments(token, {
        subscriptionId: credentials.subscriptionId,
        resourceGroup: credentials.resourceGroup,
        resourceName: this.config.resourceName,
      });

      return {
        'azure-openai': {
          apiKeyEnvVar: [],
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: deployments.map(d => d.name),
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azure-openai',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[AzureOpenAIGateway] Deployment discovery failed: ${errorMsg}`,
        '\nReturning fallback configuration. Azure OpenAI can still be used by manually specifying deployment names.',
      );

      return {
        'azure-openai': {
          apiKeyEnvVar: [],
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: [],
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azure-openai',
        },
      };
    }
  }

  private getManagementCredentials(management: NonNullable<AzureOpenAIGatewayConfig['management']>) {
    const { tenantId, clientId, clientSecret, subscriptionId, resourceGroup } = management;

    const missing = [];
    if (!tenantId) missing.push('tenantId');
    if (!clientId) missing.push('clientId');
    if (!clientSecret) missing.push('clientSecret');
    if (!subscriptionId) missing.push('subscriptionId');
    if (!resourceGroup) missing.push('resourceGroup');

    if (missing.length > 0) {
      throw new MastraError({
        id: 'AZURE_MANAGEMENT_CREDENTIALS_MISSING',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Management credentials incomplete. Missing: ${missing.join(', ')}. Required fields: tenantId, clientId, clientSecret, subscriptionId, resourceGroup.`,
      });
    }

    return {
      tenantId,
      clientId,
      clientSecret,
      subscriptionId,
      resourceGroup,
    };
  }

  private async getAzureADToken(credentials: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  }): Promise<string> {
    const { tenantId, clientId, clientSecret } = credentials;

    const cacheKey = `azure-mgmt-token:${tenantId}:${clientId}`;

    const cached = (await this.tokenCache.get(cacheKey)) as CachedToken | undefined;
    if (cached && cached.expiresAt > Date.now() / 1000 + 60) {
      return cached.token;
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://management.azure.com/.default',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new MastraError({
        id: 'AZURE_AD_TOKEN_ERROR',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Failed to get Azure AD token: ${response.status} ${error}`,
      });
    }

    const tokenResponse = (await response.json()) as AzureTokenResponse;

    const expiresAt = Math.floor(Date.now() / 1000) + tokenResponse.expires_in;

    await this.tokenCache.set(cacheKey, {
      token: tokenResponse.access_token,
      expiresAt,
    });

    return tokenResponse.access_token;
  }

  private async fetchDeployments(
    token: string,
    credentials: {
      subscriptionId: string;
      resourceGroup: string;
      resourceName: string;
    },
  ): Promise<AzureDeployment[]> {
    const { subscriptionId, resourceGroup, resourceName } = credentials;

    let url: string | undefined =
      `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${resourceName}/deployments?api-version=2024-10-01`;

    const allDeployments: AzureDeployment[] = [];

    while (url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new MastraError({
          id: 'AZURE_DEPLOYMENTS_FETCH_ERROR',
          domain: 'LLM',
          category: 'UNKNOWN',
          text: `Failed to fetch Azure deployments: ${response.status} ${error}`,
        });
      }

      const data = (await response.json()) as AzureDeploymentsResponse;

      allDeployments.push(...data.value);

      url = data.nextLink;
    }

    const successfulDeployments = allDeployments.filter(d => d.properties.provisioningState === 'Succeeded');

    return successfulDeployments;
  }

  buildUrl(_routerId: string, _envVars?: typeof process.env): undefined {
    return undefined;
  }

  async getApiKey(_modelId: string): Promise<string> {
    return this.config.authentication?.type === 'entraId' ? '' : (this.config.apiKey ?? '');
  }

  private async getEntraIdToken(): Promise<string> {
    if (this.config.authentication?.type !== 'entraId') {
      throw new MastraError({
        id: 'AZURE_ENTRA_ID_AUTH_NOT_CONFIGURED',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'Entra ID authentication is not configured for Azure OpenAI gateway',
      });
    }

    const scope = this.config.authentication.scope ?? 'https://cognitiveservices.azure.com/.default';
    const cacheKey = `azure-openai-token:${scope}`;
    const cached = (await this.tokenCache.get(cacheKey)) as CachedToken | undefined;
    if (cached && cached.expiresAt > Date.now() / 1000 + 60) {
      return cached.token;
    }

    let tokenRequest = this.entraIdTokenRequests.get(cacheKey);

    if (!tokenRequest) {
      tokenRequest = this.fetchEntraIdToken(scope, cacheKey);
      this.entraIdTokenRequests.set(cacheKey, tokenRequest);
    }

    try {
      const token = await tokenRequest;
      return token.token;
    } finally {
      this.entraIdTokenRequests.delete(cacheKey);
    }
  }

  private async fetchEntraIdToken(scope: string, cacheKey: string): Promise<CachedToken> {
    if (this.config.authentication?.type !== 'entraId') {
      throw new MastraError({
        id: 'AZURE_ENTRA_ID_AUTH_NOT_CONFIGURED',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'Entra ID authentication is not configured for Azure OpenAI gateway',
      });
    }

    const accessToken = await this.config.authentication.credential.getToken(scope);
    if (!accessToken?.token) {
      throw new MastraError({
        id: 'AZURE_ENTRA_ID_TOKEN_ERROR',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'Failed to get Entra ID token for Azure OpenAI gateway',
      });
    }

    const token = {
      token: accessToken.token,
      expiresAt: accessToken.expiresOnTimestamp
        ? Math.floor(accessToken.expiresOnTimestamp / 1000)
        : Math.floor(Date.now() / 1000) + 300,
    };

    await this.tokenCache.set(cacheKey, token);

    return token;
  }

  private createEntraIdFetch(innerFetch: typeof globalThis.fetch = fetch): typeof globalThis.fetch {
    return async (input, init) => {
      const token = await this.getEntraIdToken();
      const headers = new Headers(init?.headers);
      headers.delete('api-key');
      headers.set('Authorization', `Bearer ${token}`);

      return innerFetch(input, {
        ...init,
        headers,
      });
    };
  }

  private createAzureResponsesWebSocketFetch({
    useEntraId,
    openaiWebSocket,
  }: {
    useEntraId: boolean;
    openaiWebSocket?: OpenAIWebSocketOptions;
  }): typeof globalThis.fetch & { close(): void } {
    const websocketFetch = createOpenAIWebSocketFetch({
      url: openaiWebSocket?.url ?? `wss://${this.config.resourceName}.openai.azure.com/openai/v1/responses`,
      headers: openaiWebSocket?.headers,
      apiKeyAsBearer: !useEntraId,
      betaHeader: false,
    });

    return useEntraId
      ? Object.assign(this.createEntraIdFetch(websocketFetch), { close: websocketFetch.close })
      : websocketFetch;
  }

  async resolveLanguageModel({
    modelId,
    apiKey,
    headers,
    transport,
    openaiWebSocket,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: OpenAITransport;
    openaiWebSocket?: OpenAIWebSocketOptions;
  }): Promise<LanguageModelV2> {
    const useResponsesAPI = this.config.useResponsesAPI ?? false;
    const apiVersion =
      this.config.apiVersion ||
      (useResponsesAPI || this.config.useDeploymentBasedUrls === false ? 'v1' : '2024-04-01-preview');
    const useDeploymentBasedUrls = this.config.useDeploymentBasedUrls ?? (useResponsesAPI ? false : true);
    const useEntraId = this.config.authentication?.type === 'entraId';
    const useWebSocket = useResponsesAPI && transport === 'websocket';
    const websocketFetch = useWebSocket
      ? this.createAzureResponsesWebSocketFetch({
          useEntraId,
          openaiWebSocket,
        })
      : undefined;
    const azureConfig = {
      resourceName: this.config.resourceName,
      apiKey: useEntraId ? '' : apiKey,
      apiVersion,
      // Mastra's Azure gateway has historically used deployment-based URLs.
      // Keep that default for compatibility; set false with apiVersion: 'v1'
      // to use the newer Azure OpenAI v1 route.
      useDeploymentBasedUrls,
      headers: { 'User-Agent': MASTRA_USER_AGENT, ...headers },
      ...(websocketFetch && !useEntraId ? { fetch: websocketFetch } : {}),
    };

    const azureProvider = createAzure(
      useEntraId
        ? {
            ...azureConfig,
            fetch: websocketFetch ?? this.createEntraIdFetch(),
          }
        : azureConfig,
    );

    if (useResponsesAPI) {
      const model = withAzureResponsesInputCompatibility(azureProvider.responses(modelId));
      if (websocketFetch) {
        Object.defineProperty(model, MASTRA_GATEWAY_STREAM_TRANSPORT, {
          configurable: true,
          value: {
            type: 'openai-websocket',
            close: websocketFetch.close,
          },
        });
      }

      return model;
    }

    return azureProvider(modelId);
  }
}
