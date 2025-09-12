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

export class NetlifyGateway extends MastraModelGateway {
  readonly name = 'netlify';
  readonly prefix = 'netlify'; // All providers will be prefixed with "netlify/"

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    console.log('Fetching providers from Netlify AI Gateway...');

    const response = await fetch('https://api.netlify.com/api/v1/ai-gateway/providers');
    if (!response.ok) {
      throw new Error(`Failed to fetch from Netlify: ${response.statusText}`);
    }

    const data = (await response.json()) as NetlifyResponse;

    // Consolidate all models from all providers into a single Netlify provider
    const allModels: string[] = [];

    for (const [providerId, provider] of Object.entries(data.providers)) {
      // Prefix each model with its original provider for clarity
      // e.g., "openai/gpt-4o", "anthropic/claude-3-5-sonnet"
      for (const model of provider.models) {
        allModels.push(`${providerId}/${model}`);
      }
    }

    // Return a single Netlify provider with all models
    const providerConfigs: Record<string, ProviderConfig> = {
      [this.prefix]: {
        // Generic Netlify gateway URL - the actual provider will be determined from the model
        url: 'https://api.netlify.com/api/v1/ai-gateway',
        apiKeyEnvVar: 'NETLIFY_API_KEY',
        apiKeyHeader: 'Authorization',
        name: 'Netlify AI Gateway',
        models: allModels.sort(),
      },
    };

    console.log(
      `Netlify Gateway: consolidated ${allModels.length} models from ${Object.keys(data.providers).length} providers`,
    );
    return providerConfigs;
  }

  buildUrl(modelId: string, envVars: Record<string, string>): string | false {
    // Check if this model ID is for our gateway: "netlify/openai/gpt-4o"
    if (!modelId.startsWith(`${this.prefix}/`)) {
      return false; // Not our prefix
    }

    // Parse the model ID: "netlify/openai/gpt-4o"
    const parts = modelId.split('/');
    if (parts.length < 3) {
      return false; // Invalid format
    }

    const provider = parts[1]; // e.g., "openai"
    if (!provider) {
      return false;
    }

    // Look for the Netlify API key or provider's direct API key
    const netlifyApiKey = envVars['NETLIFY_API_KEY'];
    const providerApiKeyVar = this.getProviderApiKeyVar(provider);
    const providerApiKey = envVars[providerApiKeyVar];

    if (!netlifyApiKey && !providerApiKey) {
      return false; // No API key available
    }

    // Check for custom Netlify base URL (for enterprise/self-hosted)
    const customBaseUrl = envVars['NETLIFY_AI_GATEWAY_URL'];
    const baseUrl = customBaseUrl || 'https://api.netlify.com/api/v1/ai-gateway';

    // Return the Netlify gateway URL with the provider path
    return `${baseUrl}/${provider}/chat/completions`;
  }

  buildHeaders(modelId: string, envVars: Record<string, string>): Record<string, string> {
    // Check if this model ID is for our gateway
    if (!modelId.startsWith(`${this.prefix}/`)) {
      return {};
    }

    const headers: Record<string, string> = {};

    // Try Netlify API key first
    const netlifyApiKey = envVars['NETLIFY_API_KEY'];
    if (netlifyApiKey) {
      headers['Authorization'] = `Bearer ${netlifyApiKey}`;
      return headers;
    }

    // Fall back to provider's direct API key
    const parts = modelId.split('/');
    if (parts.length >= 3) {
      const provider = parts[1];
      if (provider) {
        const providerApiKeyVar = this.getProviderApiKeyVar(provider);
        const apiKey = envVars[providerApiKeyVar];

        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
      }
    }

    return headers;
  }

  private getProviderApiKeyVar(provider: string): string {
    // Map provider names to their standard env var names
    const mapping: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
    };

    return mapping[provider] || `${provider.toUpperCase()}_API_KEY`;
  }
}
