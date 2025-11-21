import { createAzure } from '@ai-sdk/azure';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { InMemoryServerCache } from '../../../cache/inmemory.js';
import { MastraError } from '../../../error/index.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';

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

/**
 * Configuration for Azure OpenAI Gateway
 */
export interface AzureOpenAIGatewayConfig {
  /**
   * Azure OpenAI resource name (e.g., 'my-openai-resource')
   * Used to construct the API endpoint: https://{resourceName}.openai.azure.com/
   *
   * @required
   */
  resourceName: string;

  /**
   * API key for Azure OpenAI data plane operations
   * Found in Azure Portal → Your OpenAI Resource → Keys and Endpoint
   *
   * @required
   */
  apiKey: string;

  /**
   * Azure OpenAI API version
   *
   * @optional
   * @default '2024-04-01-preview'
   */
  apiVersion?: string;

  /**
   * Static list of deployment names
   * Use this for production when you know your deployments in advance
   *
   * @optional
   * @example ['gpt-4-prod', 'gpt-35-turbo-dev']
   */
  deployments?: string[];

  /**
   * Azure Management API credentials for deployment discovery
   * Required if not providing static deployments list
   *
   * @optional
   */
  management?: {
    /**
     * Azure AD tenant ID (Directory ID)
     * Found in Azure Portal → Azure Active Directory → Properties
     *
     * @required
     */
    tenantId: string;

    /**
     * Service Principal application (client) ID
     * Found in Azure Portal → App Registrations → Your App → Overview
     *
     * @required
     */
    clientId: string;

    /**
     * Service Principal client secret
     * Created in Azure Portal → App Registrations → Your App → Certificates & secrets
     *
     * @required
     */
    clientSecret: string;

    /**
     * Azure subscription ID
     * Found in Azure Portal → Subscriptions
     *
     * @required
     */
    subscriptionId: string;

    /**
     * Resource group name containing the Azure OpenAI resource
     * Found in Azure Portal → Your OpenAI Resource → Overview
     *
     * @required
     */
    resourceGroup: string;
  };
}

export class AzureOpenAIGateway extends MastraModelGateway {
  readonly id = 'azureopenai';
  readonly name = 'azureopenai';
  readonly prefix = 'azureopenai';
  private tokenCache = new InMemoryServerCache();

  constructor(private config: AzureOpenAIGatewayConfig) {
    super();
    this.validateConfig();
  }

  private validateConfig(): void {
    // Validate required fields
    if (!this.config.resourceName) {
      throw new MastraError({
        id: 'AZURE_GATEWAY_INVALID_CONFIG',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'resourceName is required for Azure OpenAI gateway',
      });
    }

    if (!this.config.apiKey) {
      throw new MastraError({
        id: 'AZURE_GATEWAY_INVALID_CONFIG',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'apiKey is required for Azure OpenAI gateway',
      });
    }

    // Check if both modes are provided (warn but allow)
    const hasDeployments = this.config.deployments && this.config.deployments.length > 0;
    const hasManagement = this.config.management !== undefined;

    if (hasDeployments && hasManagement) {
      console.warn(
        '[AzureOpenAIGateway] Both deployments and management credentials provided. Using static deployments list and ignoring management API.',
      );
    }

    // Validate management credentials if provided
    if (hasManagement) {
      const { tenantId, clientId, clientSecret, subscriptionId, resourceGroup } = this.config.management!;
      const missing = [];
      if (!tenantId) missing.push('tenantId');
      if (!clientId) missing.push('clientId');
      if (!clientSecret) missing.push('clientSecret');
      if (!subscriptionId) missing.push('subscriptionId');
      if (!resourceGroup) missing.push('resourceGroup');

      if (missing.length > 0) {
        throw new MastraError({
          id: 'AZURE_GATEWAY_INVALID_CONFIG',
          domain: 'LLM',
          category: 'UNKNOWN',
          text: `Management credentials incomplete. Missing: ${missing.join(', ')}. Required fields: tenantId, clientId, clientSecret, subscriptionId, resourceGroup.`,
        });
      }
    }

    // Note: If neither deployments nor management is provided, we allow it
    // The user can still use Azure OpenAI by manually specifying deployment names
    // They just won't get autocomplete in their IDE
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    // Static mode: use provided deployments
    if (this.config.deployments && this.config.deployments.length > 0) {
      return {
        azureopenai: {
          apiKeyEnvVar: [], // Not used with constructor config
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: this.config.deployments,
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azureopenai',
        },
      };
    }

    // Discovery mode: fetch from Management API
    if (!this.config.management) {
      // No deployments and no management config - return empty models
      // User can still use Azure OpenAI by manually specifying deployment names
      return {
        azureopenai: {
          apiKeyEnvVar: [],
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: [],
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azureopenai',
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
        azureopenai: {
          apiKeyEnvVar: [], // Not used with constructor config
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: deployments.map(d => d.name),
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azureopenai',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[AzureOpenAIGateway] Deployment discovery failed: ${errorMsg}`,
        '\nReturning fallback configuration. Azure OpenAI can still be used by manually specifying deployment names.',
      );

      // Return fallback configuration with empty models
      return {
        azureopenai: {
          apiKeyEnvVar: [],
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: [],
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azureopenai',
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

    // Follow pagination links until no more pages
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

      // Accumulate deployments from this page
      allDeployments.push(...data.value);

      // Move to next page if available
      url = data.nextLink;
    }

    // Filter after collecting all pages
    const successfulDeployments = allDeployments.filter(d => d.properties.provisioningState === 'Succeeded');

    return successfulDeployments;
  }

  // Azure SDK constructs URLs internally
  buildUrl(_routerId: string, _envVars?: typeof process.env): undefined {
    return undefined;
  }

  async getApiKey(_modelId: string): Promise<string> {
    // Return config value directly (already validated in constructor)
    return this.config.apiKey;
  }

  async resolveLanguageModel({
    modelId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const apiVersion = this.config.apiVersion || '2024-04-01-preview';

    return createAzure({
      resourceName: this.config.resourceName,
      apiKey,
      apiVersion,
      useDeploymentBasedUrls: true,
    })(modelId);
  }
}
