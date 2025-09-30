import { PROVIDER_REGISTRY } from '../provider-registry.generated';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';

interface ModelsDevProviderInfo {
  id: string;
  name: string;
  models: Record<string, any>;
  env?: string[]; // Array of env var names
  api?: string; // Base API URL
  npm?: string; // NPM package name
  doc?: string; // Documentation URL
}

interface ModelsDevResponse {
  [providerId: string]: ModelsDevProviderInfo;
}

// Special cases: providers that are OpenAI-compatible but have their own SDKs
// These providers work with OpenAI-compatible endpoints even though models.dev
// might list them with their own SDK packages
// This constant is ONLY used during generation in fetchProviders() to determine
// which providers from models.dev should be included in the registry.
// At runtime, buildUrl() and buildHeaders() use the pre-generated PROVIDER_REGISTRY instead.
const OPENAI_COMPATIBLE_OVERRIDES: Record<string, Partial<ProviderConfig>> = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/chat/completions',
    apiKeyHeader: 'x-api-key',
  },
  cerebras: {
    url: 'https://api.cerebras.ai/v1/chat/completions',
  },
  xai: {
    url: 'https://api.x.ai/v1/chat/completions',
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
  },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/chat/completions',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
  },
  togetherai: {
    url: 'https://api.together.xyz/v1/chat/completions',
  },
  deepinfra: {
    url: 'https://api.deepinfra.com/v1/openai/chat/completions',
  },
  perplexity: {
    url: 'https://api.perplexity.ai/chat/completions',
  },
  vercel: {
    url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
    apiKeyEnvVar: 'AI_GATEWAY_API_KEY',
  },
};

export class ModelsDevGateway extends MastraModelGateway {
  readonly name = 'models.dev';
  readonly prefix = undefined; // No prefix for registry gateway

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    console.info('Fetching providers from models.dev API...');

    const response = await fetch('https://models.dev/api.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch from models.dev: ${response.statusText}`);
    }

    const data = (await response.json()) as ModelsDevResponse;

    const providerConfigs: Record<string, ProviderConfig> = {};

    for (const [providerId, providerInfo] of Object.entries(data)) {
      // Skip non-provider entries (if any)
      if (!providerInfo || typeof providerInfo !== 'object' || !providerInfo.models) continue;

      // Use provider ID as-is (keep hyphens for consistency)
      const normalizedId = providerId;

      // Check if this is OpenAI-compatible based on npm package or overrides
      const isOpenAICompatible =
        providerInfo.npm === '@ai-sdk/openai-compatible' ||
        providerInfo.npm === '@ai-sdk/gateway' || // Vercel AI Gateway is OpenAI-compatible
        normalizedId in OPENAI_COMPATIBLE_OVERRIDES;

      // Also include providers that have an API URL and env vars (likely OpenAI-compatible)
      const hasApiAndEnv = providerInfo.api && providerInfo.env && providerInfo.env.length > 0;

      if (isOpenAICompatible || hasApiAndEnv) {
        // Get model IDs from the models object
        const modelIds = Object.keys(providerInfo.models).sort();

        // Get the API URL from the provider info or overrides
        let url = providerInfo.api || OPENAI_COMPATIBLE_OVERRIDES[normalizedId]?.url;

        // Ensure the URL ends with /chat/completions if it doesn't already
        if (url && !url.includes('/chat/completions') && !url.includes('/messages')) {
          url = url.replace(/\/$/, '') + '/chat/completions';
        }

        // Skip if we don't have a URL
        if (!url) {
          console.info(`Skipping ${normalizedId}: No API URL available`);
          continue;
        }

        // Get the API key env var from the provider info
        // Convert hyphens to underscores for env var naming convention
        const apiKeyEnvVar = providerInfo.env?.[0] || `${normalizedId.toUpperCase().replace(/-/g, '_')}_API_KEY`;

        // Determine the API key header (special case for Anthropic)
        const apiKeyHeader = OPENAI_COMPATIBLE_OVERRIDES[normalizedId]?.apiKeyHeader || 'Authorization';

        providerConfigs[normalizedId] = {
          url,
          apiKeyEnvVar,
          apiKeyHeader,
          name: providerInfo.name || providerId.charAt(0).toUpperCase() + providerId.slice(1),
          models: modelIds,
          docUrl: providerInfo.doc, // Include documentation URL if available
        };
      } else {
        console.info(`Skipped provider ${providerInfo.name}`);
      }
    }

    // No need to store anymore - we use the static registry

    console.info(`Found ${Object.keys(providerConfigs).length} OpenAI-compatible providers`);
    console.info('Providers:', Object.keys(providerConfigs).sort());
    return providerConfigs;
  }

  buildUrl(modelId: string, envVars: Record<string, string>): string | false | Promise<string | false> {
    // Parse model ID to get provider
    const [provider, ...modelParts] = modelId.split('/');

    // This gateway only handles models without a prefix (since we have no prefix)
    // and only if we know about the provider
    if (!provider || !modelParts.length) {
      return false; // Not a full model ID
    }

    // Get config from the static registry
    const config = PROVIDER_REGISTRY[provider as keyof typeof PROVIDER_REGISTRY];

    if (!config?.url) {
      return false; // We don't know how to handle this provider
    }

    // Check for custom base URL from env vars
    const baseUrlEnvVar = `${provider.toUpperCase().replace(/-/g, '_')}_BASE_URL`;
    const customBaseUrl = envVars[baseUrlEnvVar];

    // Always return the URL - let the model handle API key validation
    return customBaseUrl || config.url;
  }

  buildHeaders(
    modelId: string,
    envVars: Record<string, string>,
  ): Record<string, string> | Promise<Record<string, string>> {
    const [provider] = modelId.split('/');
    if (!provider) {
      return {};
    }

    // Get config from the static registry
    const config = PROVIDER_REGISTRY[provider as keyof typeof PROVIDER_REGISTRY];

    if (!config) {
      return {};
    }

    const apiKey = envVars[config.apiKeyEnvVar];
    if (!apiKey) {
      return {};
    }

    const headers: Record<string, string> = {};

    if (config.apiKeyHeader === 'Authorization' || !config.apiKeyHeader) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers[config.apiKeyHeader] = apiKey;
    }

    // Special handling for Anthropic
    if (provider === 'anthropic') {
      headers['anthropic-version'] = '2023-06-01';
    }

    return headers;
  }
}
