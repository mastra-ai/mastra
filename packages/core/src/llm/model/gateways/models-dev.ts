import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createCerebras } from '@ai-sdk/cerebras-v5';
import { createDeepInfra } from '@ai-sdk/deepinfra-v5';
import { createDeepSeek } from '@ai-sdk/deepseek-v5';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { createGroq } from '@ai-sdk/groq-v5';
import { createMistral } from '@ai-sdk/mistral-v5';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { createPerplexity } from '@ai-sdk/perplexity-v5';
import { createTogetherAI } from '@ai-sdk/togetherai-v5';
import { createXai } from '@ai-sdk/xai-v5';
import { createGateway } from '@internal/ai-v6';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v5';
import { parseModelRouterId } from '../gateway-resolver.js';
import { MastraModelGateway } from './base.js';
import type { GatewayLanguageModel, ProviderConfig } from './base.js';
import { EXCLUDED_PROVIDERS, PROVIDERS_WITH_INSTALLED_PACKAGES } from './constants.js';

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

// Provider-specific overrides for URL, npm package, and other config.
// These take priority over what models.dev returns (e.g. correct base URLs, SDK packages).
// This constant is ONLY used during generation in fetchProviders() to determine
// which providers from models.dev should be included in the registry.
// At runtime, buildUrl() and buildHeaders() use the pre-generated PROVIDER_REGISTRY instead.
const PROVIDER_OVERRIDES: Record<string, Partial<ProviderConfig>> = {
  mistral: {
    url: 'https://api.mistral.ai/v1',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1',
  },
  // moonshotai uses Anthropic-compatible API, not OpenAI-compatible
  moonshotai: {
    url: 'https://api.moonshot.ai/anthropic/v1',
    npm: '@ai-sdk/anthropic',
  },
  // moonshotai-cn (China version) also uses Anthropic-compatible API
  'moonshotai-cn': {
    url: 'https://api.moonshot.cn/anthropic/v1',
    npm: '@ai-sdk/anthropic',
  },
};

export class ModelsDevGateway extends MastraModelGateway {
  readonly id = 'models.dev';
  readonly name = 'models.dev';

  private providerConfigs: Record<string, ProviderConfig> = {};

  constructor(providerConfigs?: Record<string, ProviderConfig>) {
    super();
    if (providerConfigs) this.providerConfigs = providerConfigs;
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const response = await fetch('https://models.dev/api.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch from models.dev: ${response.statusText}`);
    }

    const data = (await response.json()) as ModelsDevResponse;

    const providerConfigs: Record<string, ProviderConfig> = {};

    for (const [providerId, providerInfo] of Object.entries(data)) {
      // Skip excluded providers
      if (EXCLUDED_PROVIDERS.includes(providerId)) continue;
      // Skip non-provider entries (if any)
      if (!providerInfo || typeof providerInfo !== 'object' || !providerInfo.models) continue;

      // Use provider ID as-is (keep hyphens for consistency)
      const normalizedId = providerId;

      // Check if this is OpenAI-compatible based on npm package or overrides
      const isOpenAICompatible =
        providerInfo.npm === '@ai-sdk/openai-compatible' ||
        providerInfo.npm === '@ai-sdk/gateway' || // Vercel AI Gateway is OpenAI-compatible
        normalizedId in PROVIDER_OVERRIDES;

      // these have their ai sdk provider package installed and don't use openai-compat
      const hasInstalledPackage = PROVIDERS_WITH_INSTALLED_PACKAGES.includes(providerId);

      // Also include providers that have an API URL and env vars (likely OpenAI-compatible)
      const hasApiAndEnv = providerInfo.api && providerInfo.env && providerInfo.env.length > 0;

      if (isOpenAICompatible || hasInstalledPackage || hasApiAndEnv) {
        // Get model IDs from the models object
        // Filter out deprecated models before collecting model IDs
        const modelIds = Object.entries(providerInfo.models)
          .filter(([, modelInfo]) => modelInfo?.status !== 'deprecated')
          .map(([modelId]) => modelId)
          .sort();

        // Get the API URL - overrides take priority over models.dev data
        const url = PROVIDER_OVERRIDES[normalizedId]?.url || providerInfo.api;

        // Skip if we don't have a URL
        if (!hasInstalledPackage && !url) {
          continue;
        }

        // Get the API key env var from the provider info
        // Convert hyphens to underscores for env var naming convention
        const apiKeyEnvVar = providerInfo.env?.[0] || `${normalizedId.toUpperCase().replace(/-/g, '_')}_API_KEY`;

        // Determine the API key header (special case for Anthropic)
        const apiKeyHeader = !hasInstalledPackage
          ? PROVIDER_OVERRIDES[normalizedId]?.apiKeyHeader || 'Authorization'
          : undefined;

        providerConfigs[normalizedId] = {
          url,
          apiKeyEnvVar,
          apiKeyHeader,
          name: providerInfo.name || providerId.charAt(0).toUpperCase() + providerId.slice(1),
          models: modelIds,
          docUrl: providerInfo.doc, // Include documentation URL if available
          gateway: `models.dev`,
          // Only store npm when it's a non-default SDK (not openai-compatible/gateway) to keep the registry small
          // Overrides take priority (e.g., moonshotai uses @ai-sdk/anthropic, not the openai-compatible listed in models.dev)
          npm:
            PROVIDER_OVERRIDES[normalizedId]?.npm ||
            (providerInfo.npm &&
            providerInfo.npm !== '@ai-sdk/openai-compatible' &&
            providerInfo.npm !== '@ai-sdk/gateway'
              ? providerInfo.npm
              : undefined),
        };
      }
    }

    // Store for later use in buildUrl and buildHeaders
    this.providerConfigs = providerConfigs;

    return providerConfigs;
  }

  buildUrl(routerId: string, envVars?: typeof process.env): string | undefined {
    const { providerId } = parseModelRouterId(routerId);

    const config = this.providerConfigs[providerId];

    if (!config?.url) {
      return;
    }

    // Check for custom base URL from env vars
    const baseUrlEnvVar = `${providerId.toUpperCase().replace(/-/g, '_')}_BASE_URL`;
    const customBaseUrl = envVars?.[baseUrlEnvVar] || process.env[baseUrlEnvVar];

    return customBaseUrl || config.url;
  }

  getApiKey(modelId: string): Promise<string> {
    const [provider, model] = modelId.split('/');
    if (!provider || !model) {
      throw new Error(`Could not identify provider from model id ${modelId}`);
    }
    const config = this.providerConfigs[provider];

    if (!config) {
      throw new Error(`Could not find config for provider ${provider} with model id ${modelId}`);
    }

    const apiKey = typeof config.apiKeyEnvVar === `string` ? process.env[config.apiKeyEnvVar] : undefined; // we only use single string env var for models.dev for now

    if (!apiKey) {
      throw new Error(`Could not find API key process.env.${config.apiKeyEnvVar} for model id ${modelId}`);
    }

    return Promise.resolve(apiKey);
  }

  async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): Promise<GatewayLanguageModel> {
    const baseURL = this.buildUrl(`${providerId}/${modelId}`);

    switch (providerId) {
      case 'openai':
        return createOpenAI({ apiKey }).responses(modelId);
      case 'gemini':
      case 'google':
        return createGoogleGenerativeAI({
          apiKey,
        }).chat(modelId);
      case 'anthropic':
        return createAnthropic({ apiKey })(modelId);
      case 'mistral':
        return createMistral({ apiKey })(modelId);
      case 'groq':
        return createGroq({ apiKey })(modelId);
      case 'openrouter':
        return createOpenRouter({ apiKey, headers })(modelId);
      case 'xai':
        return createXai({
          apiKey,
        })(modelId);
      case 'deepseek':
        return createDeepSeek({
          apiKey,
        })(modelId);
      case 'perplexity':
        return createPerplexity({ apiKey })(modelId);
      case 'cerebras':
        return createCerebras({ apiKey })(modelId);
      case 'togetherai':
        return createTogetherAI({ apiKey })(modelId);
      case 'deepinfra':
        return createDeepInfra({ apiKey })(modelId);
      case 'vercel':
        return createGateway({ apiKey, headers })(modelId);
      case 'moonshotai':
      case 'moonshotai-cn': {
        // moonshotai uses Anthropic-compatible API endpoint
        if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
        return createAnthropic({ apiKey, baseURL })(modelId);
      }
      default: {
        // Check if this provider uses a specific SDK package (e.g., kimi-for-coding uses @ai-sdk/anthropic)
        const config = this.providerConfigs[providerId];
        const npm = config?.npm;

        if (npm === '@ai-sdk/anthropic') {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createAnthropic({ apiKey, baseURL })(modelId);
        }

        if (npm === '@ai-sdk/openai') {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createOpenAI({ apiKey, baseURL }).chat(modelId);
        }

        if (npm === '@ai-sdk/google') {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createGoogleGenerativeAI({ apiKey, baseURL }).chat(modelId);
        }

        if (npm === '@ai-sdk/mistral') {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createMistral({ apiKey, baseURL })(modelId);
        }

        if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
        return createOpenAICompatible({ name: providerId, apiKey, baseURL, supportsStructuredOutputs: true }).chatModel(
          modelId,
        );
      }
    }
  }
}
