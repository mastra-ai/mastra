import { InMemoryServerCache } from '../../../cache/inmemory.js';
import { MastraError } from '../../../error/index.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';

interface NetlifyProviderResponse {
  token_env_var: string;
  url_env_var: string;
  models: string[];
}
interface NetlifyResponse {
  providers: Record<string, NetlifyProviderResponse>;
}

interface NetlifyTokenResponse {
  token: string;
  url: string;
  expires_at: number;
}

interface CachedToken {
  token: string;
  url: string;
  expiresAt: number;
}

interface TokenData {
  token: string;
  url: string;
}
export class NetlifyGateway extends MastraModelGateway {
  readonly name = 'netlify';
  readonly prefix = 'netlify'; // All providers will be prefixed with "netlify/"
  private tokenCache = new InMemoryServerCache();

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    console.info('Fetching providers from Netlify AI Gateway...');
    const response = await fetch('https://api.netlify.com/api/v1/ai-gateway/providers');
    if (!response.ok) {
      throw new Error(`Failed to fetch from Netlify: ${response.statusText}`);
    }
    const data = (await response.json()) as NetlifyResponse;
    const netlify: ProviderConfig = {
      apiKeyEnvVar: ['NETLIFY_TOKEN', 'NETLIFY_SITE_ID'],
      apiKeyHeader: 'Authorization', // Netlify uses standard Bearer auth
      name: `Netlify`,
      gateway: `netlify`,
      models: [],
      docUrl: 'https://docs.netlify.com/build/build-with-ai/ai-gateway/overview',
    };
    // Convert Netlify format to our standard format
    for (const [providerId, provider] of Object.entries(data.providers)) {
      for (const model of provider.models) {
        netlify.models.push(`${providerId}/${model}`);
      }
    }
    console.info(`Found ${Object.keys(data.providers).length} models via Netlify Gateway`);
    return { netlify };
  }

  async buildUrl(modelId: string, envVars: Record<string, string>): Promise<string | false> {
    // Check if this model ID is for our gateway
    if (!modelId.startsWith(`${this.prefix}/`)) {
      return false; // Not our prefix
    }
    // Parse the model ID: "netlify/openai/gpt-4o"
    const parts = modelId.split('/');
    if (parts.length < 3) {
      return false; // Invalid format
    }
    const provider = parts[1];
    if (!provider) {
      return false;
    }

    // Check for Netlify site ID first (for token exchange)
    const siteId = envVars['NETLIFY_SITE_ID'];
    const netlifyToken = envVars['NETLIFY_TOKEN'];

    if (!netlifyToken) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_NO_TOKEN',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing NETLIFY_TOKEN environment variable required for model: ${modelId}`,
      });
    }

    if (!siteId) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_NO_SITE_ID',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing NETLIFY_SITE_ID environment variable required for model: ${modelId}`,
      });
    }

    try {
      const tokenData = await this.getOrFetchToken(siteId, netlifyToken);
      return `${tokenData.url}chat/completions`;
    } catch (error) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_TOKEN_ERROR',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Failed to get Netlify AI Gateway token for model ${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Get cached token or fetch a new site-specific AI Gateway token from Netlify
   */
  private async getOrFetchToken(siteId: string, netlifyToken: string): Promise<TokenData> {
    const cacheKey = `netlify-token:${siteId}:${netlifyToken}`;

    // Check cache first
    const cached = (await this.tokenCache.get(cacheKey)) as CachedToken | undefined;
    if (cached && cached.expiresAt > Date.now() / 1000 + 60) {
      // Return cached token if it won't expire in the next minute
      return { token: cached.token, url: cached.url };
    }

    // Fetch new token
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/ai-gateway/token`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Netlify AI Gateway token: ${response.status} ${error}`);
    }

    const tokenResponse = (await response.json()) as NetlifyTokenResponse;

    // Cache the token - InMemoryServerCache will handle the TTL
    await this.tokenCache.set(cacheKey, {
      token: tokenResponse.token,
      url: tokenResponse.url,
      expiresAt: tokenResponse.expires_at,
    });

    return { token: tokenResponse.token, url: tokenResponse.url };
  }
  async buildHeaders(modelId: string, envVars: Record<string, string>): Promise<Record<string, string>> {
    const siteId = envVars['NETLIFY_SITE_ID'];
    const netlifyToken = envVars['NETLIFY_TOKEN'];

    if (!netlifyToken) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_NO_TOKEN',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing NETLIFY_TOKEN environment variable required for model: ${modelId}`,
      });
    }

    if (!siteId) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_NO_SITE_ID',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing NETLIFY_SITE_ID environment variable required for model: ${modelId}`,
      });
    }

    try {
      const tokenData = await this.getOrFetchToken(siteId, netlifyToken);
      return {
        Authorization: `Bearer ${tokenData.token}`,
      };
    } catch (error) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_TOKEN_ERROR',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Failed to get Netlify AI Gateway token for model ${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}
