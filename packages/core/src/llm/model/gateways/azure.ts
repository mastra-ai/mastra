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

export class AzureGateway extends MastraModelGateway {
  readonly id = 'azure';
  readonly name = 'azure';
  readonly prefix = 'azure';
  private tokenCache = new InMemoryServerCache();

  /**
   * Fetch Azure OpenAI deployments from Management API
   */
  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    try {
      // Step 1: Get Management API credentials
      const credentials = this.getManagementCredentials();

      // Step 2: Get Azure AD access token (cached)
      const token = await this.getAzureADToken({
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      });

      // Step 3: Fetch deployments from Management API
      const deployments = await this.fetchDeployments(token, {
        subscriptionId: credentials.subscriptionId,
        resourceGroup: credentials.resourceGroup,
        resourceName: credentials.resourceName,
      });

      // Step 4: Transform to ProviderConfig format
      return {
        azure: {
          apiKeyEnvVar: 'AZURE_API_KEY',
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: deployments.map(d => d.name),
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azure',
        },
      };
    } catch (error) {
      // Log warning explaining fallback
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[AzureGateway] Skipping deployment discovery: ${errorMsg}`,
        '\nReturning fallback configuration. Azure OpenAI can still be used by manually specifying deployment names.',
      );

      // Return fallback configuration with empty models
      return {
        azure: {
          apiKeyEnvVar: 'AZURE_API_KEY',
          apiKeyHeader: 'api-key',
          name: 'Azure OpenAI',
          models: [], // Empty - users specify deployments manually
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azure',
        },
      };
    }
  }

  /**
   * Get Management API credentials from environment
   */
  private getManagementCredentials() {
    const tenantId = process.env['AZURE_TENANT_ID'];
    const clientId = process.env['AZURE_CLIENT_ID'];
    const clientSecret = process.env['AZURE_CLIENT_SECRET'];
    const subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];
    const resourceGroup = process.env['AZURE_RESOURCE_GROUP'];
    const resourceName = process.env['AZURE_RESOURCE_NAME'];

    // Check for Management API credentials
    const missing = [];
    if (!tenantId) missing.push('AZURE_TENANT_ID');
    if (!clientId) missing.push('AZURE_CLIENT_ID');
    if (!clientSecret) missing.push('AZURE_CLIENT_SECRET');
    if (!subscriptionId) missing.push('AZURE_SUBSCRIPTION_ID');
    if (!resourceGroup) missing.push('AZURE_RESOURCE_GROUP');
    if (!resourceName) missing.push('AZURE_RESOURCE_NAME');

    if (missing.length > 0) {
      throw new MastraError({
        id: 'AZURE_MANAGEMENT_CREDENTIALS_MISSING',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing Azure Management API credentials: ${missing.join(', ')}. These are required to fetch deployments dynamically. You can still use Azure OpenAI by specifying deployment names manually, but autocomplete will not be available.`,
      });
    }

    // After the check above, TypeScript knows all values are defined
    return {
      tenantId: tenantId!,
      clientId: clientId!,
      clientSecret: clientSecret!,
      subscriptionId: subscriptionId!,
      resourceGroup: resourceGroup!,
      resourceName: resourceName!,
    };
  }

  /**
   * Get Azure AD access token for Management API (with caching)
   */
  private async getAzureADToken(credentials: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  }): Promise<string> {
    const { tenantId, clientId, clientSecret } = credentials;

    // Create cache key from credentials
    const cacheKey = `azure-mgmt-token:${tenantId}:${clientId}`;

    // Check cache first
    const cached = (await this.tokenCache.get(cacheKey)) as CachedToken | undefined;
    if (cached && cached.expiresAt > Date.now() / 1000 + 60) {
      // Return cached token if it won't expire in the next minute
      return cached.token;
    }

    // Fetch new token
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

    // Calculate expiry timestamp
    const expiresAt = Math.floor(Date.now() / 1000) + tokenResponse.expires_in;

    // Cache the token
    await this.tokenCache.set(cacheKey, {
      token: tokenResponse.access_token,
      expiresAt,
    });

    return tokenResponse.access_token;
  }

  /**
   * Fetch deployments from Azure Management API
   */
  private async fetchDeployments(
    token: string,
    credentials: {
      subscriptionId: string;
      resourceGroup: string;
      resourceName: string;
    },
  ): Promise<AzureDeployment[]> {
    const { subscriptionId, resourceGroup, resourceName } = credentials;

    const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${resourceName}/deployments?api-version=2024-10-01`;

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

    // Filter to only include successfully provisioned deployments
    const successfulDeployments = data.value.filter(d => d.properties.provisioningState === 'Succeeded');

    // TODO: Handle pagination if nextLink is present
    // This is unlikely for most users (<100 deployments)
    if (data.nextLink) {
      console.warn('[AzureGateway] Pagination detected but not implemented. Only first page of deployments returned.');
    }

    return successfulDeployments;
  }

  /**
   * Azure SDK constructs URLs internally, so buildUrl is not needed
   */
  buildUrl(_routerId: string, _envVars?: typeof process.env): undefined {
    return undefined;
  }

  /**
   * Get API key for Azure OpenAI service (not Management API)
   */
  async getApiKey(_modelId: string): Promise<string> {
    const apiKey = process.env['AZURE_API_KEY'];

    if (!apiKey) {
      throw new MastraError({
        id: 'AZURE_API_KEY_MISSING',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'Missing AZURE_API_KEY environment variable required for Azure OpenAI API calls',
      });
    }

    return apiKey;
  }

  /**
   * Resolve language model using Azure SDK
   */
  async resolveLanguageModel({
    modelId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const resourceName = process.env['AZURE_RESOURCE_NAME'];
    const apiVersion = process.env['OPENAI_API_VERSION'] || '2024-04-01-preview';

    if (!resourceName) {
      throw new MastraError({
        id: 'AZURE_RESOURCE_NAME_MISSING',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'Missing AZURE_RESOURCE_NAME environment variable',
      });
    }

    // Create Azure provider with resource name
    // modelId is the deployment name (e.g., "my-gpt4-deployment")
    // useDeploymentBasedUrls: true is required for Azure deployment URLs
    return createAzure({
      resourceName,
      apiKey,
      apiVersion,
      useDeploymentBasedUrls: true,
    })(modelId);
  }
}
