import { createAlibaba } from '@ai-sdk/alibaba-v6';
import { createAnthropic } from '@ai-sdk/anthropic-v6';
import { createCerebras } from '@ai-sdk/cerebras-v6';
import { createDeepInfra } from '@ai-sdk/deepinfra-v6';
import { createDeepSeek } from '@ai-sdk/deepseek-v6';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v6';
import { createGroq } from '@ai-sdk/groq-v6';
import { createMistral } from '@ai-sdk/mistral-v6';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v6';
import { createOpenAI } from '@ai-sdk/openai-v6';
import { createPerplexity } from '@ai-sdk/perplexity-v6';
import { createTogetherAI } from '@ai-sdk/togetherai-v6';
import { createXai } from '@ai-sdk/xai-v6';
import { createGateway } from '@internal/ai-v6';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v6';
import { parseModelRouterId } from '../gateway-resolver.js';
import { MastraModelGateway } from './base.js';
import type {
  AttachmentCapabilities,
  GatewayLanguageModel,
  ModelProviderOverride,
  ProviderConfig,
  StructuredOutputCapabilities,
  TemperatureCapabilities,
} from './base.js';
import { EXCLUDED_PROVIDERS, MASTRA_USER_AGENT, PROVIDERS_WITH_INSTALLED_PACKAGES } from './constants.js';

interface ModelsDevModelInfo {
  id: string;
  name?: string;
  status?: string;
  modalities?: { input?: string[]; output?: string[] };
  attachment?: boolean;
  temperature?: boolean;
  structured_output?: boolean;
  // Per-model endpoint/shape/SDK override (models.dev model `provider` block).
  provider?: { api?: string; shape?: 'responses' | 'completions'; npm?: string };
  [key: string]: unknown;
}

interface ModelsDevProviderInfo {
  id: string;
  name: string;
  models: Record<string, ModelsDevModelInfo>;
  env?: string[]; // Array of env var names
  api?: string; // Base API URL
  npm?: string; // NPM package name
  doc?: string; // Documentation URL
}

interface ModelsDevResponse {
  [providerId: string]: ModelsDevProviderInfo;
}

function selectApiKeyEnvVar({ envVars, providerId }: { envVars?: string[]; providerId: string }): string {
  const fallbackEnvVar = `${providerId.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  if (!envVars?.length) return fallbackEnvVar;

  const suffixPreferences = ['_API_TOKEN', '_API_KEY', '_TOKEN', '_KEY', '_PAT'];

  for (const suffix of suffixPreferences) {
    const preferredEnvVar = envVars.find(envVar => envVar.endsWith(suffix));
    if (preferredEnvVar) return preferredEnvVar;
  }

  return envVars[0] || fallbackEnvVar;
}

function interpolateUrlTemplate(url: string, envVars?: typeof process.env): string {
  return url.replace(/\$\{([^}]+)\}/g, (_match, envVarName: string) => {
    const key = envVarName.trim();
    const value = envVars?.[key] ?? process.env[key];

    if (value === undefined || value === null) {
      throw new Error(`Missing environment variable ${envVarName} required to build provider URL`);
    }

    return value;
  });
}

function resolveApiKeyFromEnv(apiKeyEnvVar: ProviderConfig['apiKeyEnvVar']): string | undefined {
  const envVars = Array.isArray(apiKeyEnvVar) ? apiKeyEnvVar : [apiKeyEnvVar];

  for (const envVar of envVars) {
    const apiKey = process.env[envVar];
    if (apiKey) return apiKey;
  }
}

// Provider-specific overrides for URL, npm package, and other config.
// These take priority over what models.dev returns (e.g. correct base URLs, SDK packages).
// This constant is ONLY used during generation in fetchProviders() to determine
// which providers from models.dev should be included in the registry.
// At runtime, buildUrl() and buildHeaders() use the pre-generated PROVIDER_REGISTRY instead.
const PROVIDER_OVERRIDES: Record<string, Partial<ProviderConfig>> = {
  google: {
    apiKeyEnvVar: ['GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
  },
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
  private attachmentCapabilities: AttachmentCapabilities = {};
  private temperatureCapabilities: TemperatureCapabilities = {};
  private structuredOutputCapabilities: StructuredOutputCapabilities = {};

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

    // Reset capability maps so removed providers/models are not retained across syncs
    this.attachmentCapabilities = {};
    this.temperatureCapabilities = {};
    this.structuredOutputCapabilities = {};

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
        const activeModels = Object.entries(providerInfo.models).filter(
          ([, modelInfo]) => modelInfo?.status !== 'deprecated',
        );
        const modelIds = activeModels.map(([modelId]) => modelId).sort();

        // Collect model IDs that support attachments
        const attachmentModels = activeModels
          .filter(([, modelInfo]) => modelInfo?.attachment === true)
          .map(([modelId]) => modelId)
          .sort();

        // Collect model IDs that support temperature sampling
        const temperatureModels = activeModels
          .filter(([, modelInfo]) => modelInfo?.temperature === true)
          .map(([modelId]) => modelId)
          .sort();

        const structuredOutputModels = activeModels
          .filter(([, modelInfo]) => modelInfo?.structured_output === true)
          .map(([modelId]) => modelId)
          .sort();

        // Collect per-model endpoint/shape/SDK overrides. Some providers serve
        // individual models over a different endpoint or request shape than the
        // provider default (e.g. OpenAI Responses vs chat-completions).
        const modelOverrides: Record<string, ModelProviderOverride> = {};
        for (const [modelId, modelInfo] of activeModels) {
          const ov = modelInfo?.provider;
          if (ov && (ov.api || ov.shape || ov.npm)) {
            modelOverrides[modelId] = { api: ov.api, shape: ov.shape, npm: ov.npm };
          }
        }

        // Get the API URL - overrides take priority over models.dev data
        const url = PROVIDER_OVERRIDES[normalizedId]?.url || providerInfo.api;

        // Skip if we don't have a URL
        if (!hasInstalledPackage && !url) {
          continue;
        }

        // Prefer auth-like env vars over identifiers already consumed by the URL template.
        const apiKeyEnvVar =
          PROVIDER_OVERRIDES[normalizedId]?.apiKeyEnvVar ||
          selectApiKeyEnvVar({
            envVars: providerInfo.env,
            providerId: normalizedId,
          });

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
          modelOverrides: Object.keys(modelOverrides).length > 0 ? modelOverrides : undefined,
        };
        if (attachmentModels.length > 0) {
          this.attachmentCapabilities[normalizedId] = attachmentModels;
        }
        if (temperatureModels.length > 0) {
          this.temperatureCapabilities[normalizedId] = temperatureModels;
        }
        if (structuredOutputModels.length > 0) {
          this.structuredOutputCapabilities[normalizedId] = structuredOutputModels;
        }
      }
    }

    // Store for later use in buildUrl and buildHeaders
    this.providerConfigs = providerConfigs;

    return providerConfigs;
  }

  /**
   * Return attachment capabilities collected during the last `fetchProviders()` call.
   * Maps provider ID → list of model IDs that support attachments.
   */
  getAttachmentCapabilities(): AttachmentCapabilities {
    return this.attachmentCapabilities;
  }

  getTemperatureCapabilities(): TemperatureCapabilities {
    return this.temperatureCapabilities;
  }

  getStructuredOutputCapabilities(): StructuredOutputCapabilities {
    return this.structuredOutputCapabilities;
  }

  buildUrl(routerId: string, envVars?: typeof process.env): string | undefined {
    const { providerId, modelId } = parseModelRouterId(routerId);

    const config = this.providerConfigs[providerId];

    // A per-model override may point this model at a different endpoint than the
    // provider default; prefer it when present.
    const perModelApi = config?.modelOverrides?.[modelId]?.api;
    const template = perModelApi ?? config?.url;

    if (!template) {
      return;
    }

    // Check for custom base URL from env vars (explicit override still wins)
    const baseUrlEnvVar = `${providerId.toUpperCase().replace(/-/g, '_')}_BASE_URL`;
    const customBaseUrl = envVars?.[baseUrlEnvVar] || process.env[baseUrlEnvVar];

    return customBaseUrl || interpolateUrlTemplate(template, envVars);
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

    const apiKey = resolveApiKeyFromEnv(config.apiKeyEnvVar);

    if (!apiKey) {
      const envVarDisplay = Array.isArray(config.apiKeyEnvVar) ? config.apiKeyEnvVar.join(' or ') : config.apiKeyEnvVar;
      throw new Error(`Could not find API key process.env.${envVarDisplay} for model id ${modelId}`);
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

    const mastraHeaders = { 'User-Agent': MASTRA_USER_AGENT, ...headers };

    // Per-model override: a model may be served over a different request shape
    // than its provider default (e.g. the OpenAI Responses API while the provider
    // default is chat-completions). Honor `shape` for any provider.
    const override = this.providerConfigs[providerId]?.modelOverrides?.[modelId];
    if (override?.shape === 'responses') {
      return createOpenAI({ apiKey, baseURL, headers: mastraHeaders }).responses(modelId);
    }

    switch (providerId) {
      case 'openai':
        return createOpenAI({ apiKey, baseURL, headers: mastraHeaders }).responses(modelId);
      case 'gemini':
      case 'google':
        return createGoogleGenerativeAI({ apiKey, baseURL, headers: mastraHeaders }).chat(modelId);
      case 'anthropic':
        return createAnthropic({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'mistral':
        return createMistral({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'groq':
        return createGroq({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'openrouter':
        return createOpenRouter({ apiKey, baseURL, headers: mastraHeaders })(
          modelId,
        ) as unknown as GatewayLanguageModel;
      case 'xai':
        return createXai({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'deepseek':
        return createDeepSeek({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'perplexity':
        return createPerplexity({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'cerebras':
        return createCerebras({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'togetherai':
        return createTogetherAI({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'deepinfra':
        return createDeepInfra({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'vercel':
        return createGateway({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      case 'moonshotai':
      case 'moonshotai-cn': {
        // moonshotai uses Anthropic-compatible API endpoint
        if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
        return createAnthropic({ apiKey, baseURL, headers: mastraHeaders })(modelId);
      }
      default: {
        // Check if this provider uses a specific SDK package (e.g., kimi-for-coding uses @ai-sdk/anthropic).
        // A per-model override wins over the provider default.
        const config = this.providerConfigs[providerId];
        const npm = override?.npm ?? config?.npm;

        // Pattern match for any alibaba variant (alibaba, alibaba-cn, alibaba-coding-plan, etc.)
        if (providerId.includes('alibaba')) {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createAlibaba({ apiKey, baseURL, headers: mastraHeaders })(modelId);
        }

        if (npm === '@ai-sdk/anthropic') {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createAnthropic({ apiKey, baseURL, headers: mastraHeaders })(modelId);
        }

        if (npm === '@ai-sdk/openai') {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createOpenAI({ apiKey, baseURL, headers: mastraHeaders }).chat(modelId);
        }

        if (npm === '@ai-sdk/google') {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createGoogleGenerativeAI({ apiKey, baseURL, headers: mastraHeaders }).chat(modelId);
        }

        if (npm === '@ai-sdk/mistral') {
          if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
          return createMistral({ apiKey, baseURL, headers: mastraHeaders })(modelId);
        }

        if (!baseURL) throw new Error(`No API URL found for ${providerId}/${modelId}`);
        return createOpenAICompatible({
          name: providerId,
          apiKey,
          baseURL,
          headers: mastraHeaders,
          supportsStructuredOutputs: true,
        }).chatModel(modelId);
      }
    }
  }
}
