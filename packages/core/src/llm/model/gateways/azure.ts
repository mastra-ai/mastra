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

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    try {
      const credentials = this.getManagementCredentials();

      const token = await this.getAzureADToken({
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      });

      const deployments = await this.fetchDeployments(token, {
        subscriptionId: credentials.subscriptionId,
        resourceGroup: credentials.resourceGroup,
        resourceName: credentials.resourceName,
      });

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
          models: [],
          docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
          gateway: 'azure',
        },
      };
    }
  }

  private getManagementCredentials() {
    const tenantId = process.env['AZURE_TENANT_ID'];
    const clientId = process.env['AZURE_CLIENT_ID'];
    const clientSecret = process.env['AZURE_CLIENT_SECRET'];
    const subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];
    const resourceGroup = process.env['AZURE_RESOURCE_GROUP'];
    const resourceName = process.env['AZURE_RESOURCE_NAME'];

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

    return {
      tenantId: tenantId!,
      clientId: clientId!,
      clientSecret: clientSecret!,
      subscriptionId: subscriptionId!,
      resourceGroup: resourceGroup!,
      resourceName: resourceName!,
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

    return createAzure({
      resourceName,
      apiKey,
      apiVersion,
      useDeploymentBasedUrls: true,
    })(modelId);
  }
}
