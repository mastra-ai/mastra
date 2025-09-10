/**
 * Dynamic provider registry that fetches OpenAI-compatible providers from models.dev
 */

export interface ModelsDevProvider {
  id: string;
  env: string[];
  npm: string;
  api: string;
  name: string;
  doc: string;
  models: Record<string, any>;
}

export interface ProviderConfig {
  url: string;
  defaultHeaders?: Record<string, string>;
  apiKeyEnvVar?: string;
  apiKeyHeader?: string;
}

// Cache the provider registry to avoid repeated fetches
let cachedRegistry: Record<string, ProviderConfig> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the provider registry from models.dev and filters for OpenAI-compatible providers
 */
export async function fetchProviderRegistry(): Promise<Record<string, ProviderConfig>> {
  // Return cached registry if it's still valid
  if (cachedRegistry && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedRegistry;
  }

  try {
    const response = await fetch('https://models.dev/api.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch models.dev API: ${response.statusText}`);
    }

    const data: Record<string, ModelsDevProvider> = await response.json();
    const registry: Record<string, ProviderConfig> = {};

    // Filter for OpenAI-compatible providers
    for (const [providerId, provider] of Object.entries(data)) {
      if (provider.npm === '@ai-sdk/openai-compatible' && provider.api) {
        // Build the URL - add /v1/chat/completions if not already there
        let url = provider.api;
        if (!url.endsWith('/chat/completions')) {
          url = url.endsWith('/') ? url + 'v1/chat/completions' : url + '/v1/chat/completions';
        }

        registry[providerId] = {
          url,
          apiKeyEnvVar: provider.env?.[0], // Use the first env var as the API key
          apiKeyHeader: 'Authorization', // Default for OpenAI-compatible
        };
      }
    }

    // Add special cases that might not be marked as OpenAI-compatible but are known to work
    const knownCompatible: Record<string, ProviderConfig> = {
      openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        apiKeyHeader: 'Authorization',
      },
      groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKeyEnvVar: 'GROQ_API_KEY',
        apiKeyHeader: 'Authorization',
      },
      together: {
        url: 'https://api.together.xyz/v1/chat/completions',
        apiKeyEnvVar: 'TOGETHER_API_KEY',
        apiKeyHeader: 'Authorization',
      },
      perplexity: {
        url: 'https://api.perplexity.ai/chat/completions',
        apiKeyEnvVar: 'PERPLEXITY_API_KEY',
        apiKeyHeader: 'Authorization',
      },
      mistral: {
        url: 'https://api.mistral.ai/v1/chat/completions',
        apiKeyEnvVar: 'MISTRAL_API_KEY',
        apiKeyHeader: 'Authorization',
      },
    };

    // Merge known compatible providers with fetched ones (fetched ones take precedence)
    const finalRegistry = { ...knownCompatible, ...registry };

    // Cache the result
    cachedRegistry = finalRegistry;
    cacheTimestamp = Date.now();

    return finalRegistry;
  } catch (error) {
    console.warn('Failed to fetch dynamic provider registry, falling back to static registry:', error);

    // Fallback to a minimal static registry
    return getStaticFallbackRegistry();
  }
}

/**
 * Static fallback registry in case the API is unavailable
 */
export function getStaticFallbackRegistry(): Record<string, ProviderConfig> {
  return {
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      apiKeyHeader: 'Authorization',
    },
    anthropic: {
      url: 'https://api.anthropic.com/v1/messages',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      apiKeyHeader: 'x-api-key',
    },
    groq: {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKeyEnvVar: 'GROQ_API_KEY',
      apiKeyHeader: 'Authorization',
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
    perplexity: {
      url: 'https://api.perplexity.ai/chat/completions',
      apiKeyEnvVar: 'PERPLEXITY_API_KEY',
      apiKeyHeader: 'Authorization',
    },
    mistral: {
      url: 'https://api.mistral.ai/v1/chat/completions',
      apiKeyEnvVar: 'MISTRAL_API_KEY',
      apiKeyHeader: 'Authorization',
    },
  };
}

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
 * Get provider configuration by ID
 * This is an async function that will try to fetch the dynamic registry first
 */
export async function getProviderConfig(providerId: string): Promise<ProviderConfig | undefined> {
  const registry = await fetchProviderRegistry();
  debugger;
  return registry[providerId];
}

/**
 * Get provider configuration synchronously (uses static fallback only)
 */
export function getProviderConfigSync(providerId: string): ProviderConfig | undefined {
  const registry = getStaticFallbackRegistry();
  return registry[providerId];
}
