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
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v5';
import { PROVIDER_REGISTRY } from '../provider-registry.js';
import { MastraModelGateway } from './base.js';
import type { GatewayLanguageModel, ProviderConfig } from './base.js';
import { MASTRA_USER_AGENT } from './constants.js';

export interface MastraProxyGatewayConfig {
  /** Base URL to route all model requests through. */
  baseUrl: string;
  /** Custom headers to inject into all requests. */
  headers?: Record<string, string>;
  /**
   * Resolve the API key for a given model ID.
   * When omitted, falls back to standard env var lookup (e.g., OPENAI_API_KEY).
   */
  getApiKey?: (modelId: string) => string | Promise<string>;
}

/**
 * A catch-all gateway that routes all model requests through a proxy server
 * while preserving native SDK resolution per provider.
 *
 * @example
 * ```ts
 * new ModelRouterLanguageModel('openai/gpt-4o', [
 *   new MastraProxyGateway({
 *     baseUrl: 'https://my-proxy.example.com/v1',
 *     headers: { 'X-Proxy-Token': 'secret' },
 *   }),
 * ]);
 * ```
 */
export class MastraProxyGateway extends MastraModelGateway {
  readonly id = 'proxy';
  readonly name = 'Proxy Gateway';

  constructor(private config: MastraProxyGatewayConfig) {
    super();
  }

  override matchesModel(_modelId: string): boolean {
    return true;
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    // Proxy gateway doesn't have its own provider list — it wraps all providers
    return {};
  }

  buildUrl(_modelId: string): string {
    return this.config.baseUrl;
  }

  async getApiKey(modelId: string): Promise<string> {
    if (this.config.getApiKey) {
      return this.config.getApiKey(modelId);
    }
    return this.resolveApiKeyFromEnv(modelId);
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
    const baseURL = this.config.baseUrl;
    const mastraHeaders = {
      'User-Agent': MASTRA_USER_AGENT,
      ...this.config.headers,
      ...headers,
    };

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
      default:
        return createOpenAICompatible({
          name: providerId,
          apiKey,
          baseURL,
          headers: mastraHeaders,
          supportsStructuredOutputs: true,
        }).chatModel(modelId);
    }
  }

  /**
   * Fall back to env var lookup using the provider registry config.
   * Uses the same convention as ModelsDevGateway (e.g., OPENAI_API_KEY).
   */
  private resolveApiKeyFromEnv(modelId: string): string {
    const [provider] = modelId.split('/');
    if (!provider) {
      throw new Error(`Could not identify provider from model id ${modelId}`);
    }

    const config = PROVIDER_REGISTRY[provider as keyof typeof PROVIDER_REGISTRY];
    const envVar = config && typeof config.apiKeyEnvVar === 'string' ? config.apiKeyEnvVar : undefined;

    if (envVar) {
      const key = process.env[envVar];
      if (key) return key;
    }

    // Standard fallback: PROVIDER_API_KEY
    const fallbackEnvVar = `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
    const key = process.env[fallbackEnvVar];
    if (key) return key;

    throw new Error(
      `No API key found for ${modelId}. Set ${envVar ?? fallbackEnvVar} or provide a getApiKey function.`,
    );
  }
}
