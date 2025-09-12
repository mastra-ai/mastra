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
    const providerConfigs: Record<string, ProviderConfig> = {};

    // Convert Netlify format to our standard format
    for (const [providerId, provider] of Object.entries(data.providers)) {
      // Since we have a prefix, the provider ID will be "netlify/openai" etc.
      const prefixedId = `${this.prefix}/${providerId}`;

      providerConfigs[prefixedId] = {
        // Netlify handles the actual URL routing, we just need to point to their gateway
        url: `https://api.netlify.com/api/v1/ai-gateway/${providerId}/chat/completions`,
        apiKeyEnvVar: provider.token_env_var,
        apiKeyHeader: 'Authorization', // Netlify uses standard Bearer auth
        name: `${providerId.charAt(0).toUpperCase() + providerId.slice(1)} (via Netlify)`,
        models: provider.models.sort(),
      };
    }

    console.log(`Found ${Object.keys(providerConfigs).length} providers via Netlify Gateway`);
    return providerConfigs;
  }

  buildUrl(modelId: string, envVars: Record<string, string>): string | false {
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

    // Look for the Netlify API key
    const netlifyApiKey = envVars['NETLIFY_API_KEY'];
    if (!netlifyApiKey) {
      // Also check if we have the provider's direct API key
      const providerApiKeyVar = this.getProviderApiKeyVar(provider);
      if (!envVars[providerApiKeyVar]) {
        return false; // No API key available
      }
    }

    // Check for custom Netlify base URL (for enterprise/self-hosted)
    const customBaseUrl = envVars['NETLIFY_AI_GATEWAY_URL'];
    const baseUrl = customBaseUrl || 'https://api.netlify.com/api/v1/ai-gateway';

    // Return the Netlify gateway URL
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

    return mapping[provider] || `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  }
}
