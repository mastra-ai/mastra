/**
 * Provider registry for OpenAI-compatible endpoints
 */

import { MastraError } from '../../error';
import { PROVIDER_REGISTRY as GENERATED_REGISTRY } from './provider-registry.generated';

export interface ProviderConfig {
  url: string;
  defaultHeaders?: Record<string, string>;
  apiKeyEnvVar?: string; // Environment variable name for API key
  apiKeyHeader?: string; // Header name for API key (default: Authorization)
}

export interface ProviderInfo {
  id: string;
  name: string;
  url: string;
  apiKeyEnvVar?: string;
  apiKeyHeader?: string;
  models: string[];
}

export interface ModelWithProvider {
  provider: string;
  model: string;
  providerName: string;
}

// `${T extends providers ? something??}/${model<T>}` | `openai/gpt-4o` | `openai/o3`

export const PROVIDER_REGISTRY: Record<string, ProviderConfig> = {
  moonshot: {
    url: 'https://api.moonshot.ai/v1/chat/completions',
    apiKeyEnvVar: 'MOONSHOT_API_KEY',
    apiKeyHeader: 'Authorization',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    apiKeyHeader: 'Authorization',
  },
  netlify: {
    url: 'https://nifty-murdock-9a8a4c.netlify.app/.netlify/ai/chat/completions',
    apiKeyEnvVar: 'NETLIFY_API_KEY',
    apiKeyHeader: 'Authorization',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    apiKeyHeader: 'x-api-key',
  },
  together: {
    url: 'https://api.together.xyz/v1/chat/completions',
    apiKeyEnvVar: 'TOGETHER_API_KEY',
    apiKeyHeader: 'Authorization',
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    apiKeyHeader: 'Authorization',
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    apiKeyEnvVar: 'MISTRAL_API_KEY',
    apiKeyHeader: 'Authorization',
  },
};

/**
 * Parse a model string to extract provider and model ID
 * Examples:
 * - "openai/gpt-4o" -> { provider: "openai", modelId: "gpt-4o" }
 * - "gpt-4o" -> { provider: null, modelId: "gpt-4o" }
 */
export function parseModelString(modelString: string): { provider: string | null; modelId: string } {
  const parts = modelString.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { provider: parts[0], modelId: parts[1] };
  }
  return { provider: null, modelId: modelString };
}

/**
 * Get the configuration for a provider
 */
export function getProviderConfig(provider: string): ProviderConfig | null {
  return PROVIDER_REGISTRY[provider.toLowerCase()] || null;
}

/**
 * Build headers for API requests
 */
export function buildHeaders(config: {
  provider?: string | null;
  apiKey?: string;
  headers?: Record<string, string>;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  if (config.apiKey) {
    // Determine the header format based on provider
    const providerConfig = config.provider ? getProviderConfig(config.provider) : null;
    const headerName = providerConfig?.apiKeyHeader || 'Authorization';

    if (headerName === 'Authorization' && !config.apiKey.startsWith('Bearer ')) {
      headers[headerName] = `Bearer ${config.apiKey}`;
    } else {
      headers[headerName] = config.apiKey;
    }
  }

  return headers;
}

/**
 * Resolve API key from config or environment
 */
export function resolveApiKey(config: { provider?: string | null; apiKey?: string }): string | undefined {
  // If API key is explicitly provided, use it
  if (config.apiKey) {
    return config.apiKey;
  }

  // Try to get from environment based on provider
  if (config.provider) {
    const providerConfig = getProviderConfig(config.provider);
    if (providerConfig?.apiKeyEnvVar) {
      const key = process.env[providerConfig.apiKeyEnvVar];
      if (!key) {
        throw new MastraError({
          id: 'MASTRA_MODEL_ROUTING_MISSING_API_KEY',
          text: `API Key missing for model ${config.provider}. Expected env var ${providerConfig.apiKeyEnvVar}`,
          category: 'USER',
          domain: 'MASTRA',
          details: {
            provider: config.provider,
            apiKeyEnvVar: providerConfig.apiKeyEnvVar,
            providerUrl: providerConfig.url,
          },
        });
      }
      return key;
    }
  }

  throw new MastraError({
    id: 'MASTRA_MODEL_ROUTING_MISSING_API_KEY',
    text: `API Key missing for model ${config.provider}. We couldn't identify a model provider for this model.`,
    category: 'USER',
    domain: 'MASTRA',
  });
}

/**
 * Get all available provider IDs
 */
export function getAllProviders(): string[] {
  return Object.keys(GENERATED_REGISTRY);
}

/**
 * Get all models for a specific provider
 */
export function getProviderModels(provider: string): string[] {
  const providerData = GENERATED_REGISTRY[provider as keyof typeof GENERATED_REGISTRY];
  if (!providerData) {
    return [];
  }
  return [...(providerData.models || [])];
}

/**
 * Get detailed information about a provider
 */
export function getProviderInfo(provider: string): ProviderInfo | null {
  const providerData = GENERATED_REGISTRY[provider as keyof typeof GENERATED_REGISTRY];
  if (!providerData) {
    return null;
  }

  return {
    id: provider,
    name: providerData.name || provider,
    url: providerData.url,
    apiKeyEnvVar: providerData.apiKeyEnvVar,
    apiKeyHeader: providerData.apiKeyHeader,
    models: [...(providerData.models || [])],
  };
}

/**
 * Get all models with their provider information
 */
export function getAllModelsWithProvider(): ModelWithProvider[] {
  const result: ModelWithProvider[] = [];

  for (const [providerId, providerData] of Object.entries(GENERATED_REGISTRY)) {
    const models = providerData.models || [];
    for (const model of models) {
      result.push({
        provider: providerId,
        model,
        providerName: providerData.name || providerId,
      });
    }
  }

  return result;
}
