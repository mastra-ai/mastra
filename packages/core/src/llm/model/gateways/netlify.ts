import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
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
  readonly id = 'netlify';
  readonly name = 'Netlify AI Gateway';
  private tokenCache = new InMemoryServerCache();

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const response = await fetch('https://api.netlify.com/api/v1/ai-gateway/providers');
    if (!response.ok) {
      throw new Error(`Failed to fetch from Netlify: ${response.statusText}`);
    }
    const data = (await response.json()) as NetlifyResponse;
    const config: ProviderConfig = {
      apiKeyEnvVar: ['NETLIFY_TOKEN', 'NETLIFY_SITE_ID'],
      apiKeyHeader: 'Authorization',
      name: `Netlify`,
      gateway: `netlify`,
      models: [],
      docUrl: 'https://docs.netlify.com/build/ai-gateway/overview/',
    };
    // Convert Netlify format to our standard format
    for (const [providerId, provider] of Object.entries(data.providers)) {
      for (const model of provider.models) {
        config.models.push(`${providerId}/${model}`);
      }
    }
    // Return with gateway ID as key - registry generator will detect this and avoid doubling the prefix
    return { netlify: config };
  }

  async buildUrl(routerId: string, envVars?: typeof process.env): Promise<string> {
    // Check for Netlify site ID first (for token exchange)
    const siteId = envVars?.['NETLIFY_SITE_ID'] || process.env['NETLIFY_SITE_ID'];
    const netlifyToken = envVars?.['NETLIFY_TOKEN'] || process.env['NETLIFY_TOKEN'];

    if (!netlifyToken) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_NO_TOKEN',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing NETLIFY_TOKEN environment variable required for model: ${routerId}`,
      });
    }

    if (!siteId) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_NO_SITE_ID',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing NETLIFY_SITE_ID environment variable required for model: ${routerId}`,
      });
    }

    try {
      const tokenData = await this.getOrFetchToken(siteId, netlifyToken);
      return tokenData.url.endsWith(`/`) ? tokenData.url.substring(0, tokenData.url.length - 1) : tokenData.url;
    } catch (error) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_TOKEN_ERROR',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Failed to get Netlify AI Gateway token for model ${routerId}: ${error instanceof Error ? error.message : String(error)}`,
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

  /**
   * Get cached token or fetch a new site-specific AI Gateway token from Netlify
   */
  async getApiKey(modelId: string): Promise<string> {
    const siteId = process.env['NETLIFY_SITE_ID'];
    const netlifyToken = process.env['NETLIFY_TOKEN'];

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
      return (await this.getOrFetchToken(siteId, netlifyToken)).token;
    } catch (error) {
      throw new MastraError({
        id: 'NETLIFY_GATEWAY_TOKEN_ERROR',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Failed to get Netlify AI Gateway token for model ${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
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
    const baseURL = await this.buildUrl(`${providerId}/${modelId}`);

    switch (providerId) {
      case 'openai':
        return createOpenAI({ apiKey, baseURL }).responses(modelId);
      case 'gemini':
        return createGoogleGenerativeAI({
          baseURL: `${baseURL}/v1beta/`,
          apiKey,
          headers: {
            'user-agent': 'google-genai-sdk/',
          },
        }).chat(modelId);
      case 'anthropic':
        return createAnthropic({
          apiKey,
          baseURL: `${baseURL}/v1/`,
          headers: {
            'anthropic-version': '2023-06-01',
            'user-agent': 'anthropic/',
          },
        })(modelId);
      default:
        return createOpenAICompatible({ name: providerId, apiKey, baseURL, supportsStructuredOutputs: true }).chatModel(
          modelId,
        );
    }
  }
}
