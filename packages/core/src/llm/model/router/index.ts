import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
  LanguageModelV2CallWarning,
} from '@ai-sdk/provider-v5';
import { findGatewayForModel, resolveModelConfig } from '../gateway-resolver.js';
import type { MastraModelGateway } from '../gateways/base.js';
import { parseModelString, getProviderConfig } from '../provider-registry.generated.js';
import type { ModelRouterModelId } from '../provider-registry.generated.js';
import type { OpenAICompatibleConfig } from '../shared.types';
import type { ModelRouterLanguageModelBase } from './base.js';
import { OpenAICompatibleModel } from './openai-compatible/index.js';

// Helper function to resolve API key from environment
function resolveApiKey({ provider, apiKey }: { provider?: string; apiKey?: string }): string | undefined {
  if (apiKey) return apiKey;

  if (provider) {
    const config = getProviderConfig(provider);
    if (typeof config?.apiKeyEnvVar === `string`) {
      return process.env[config.apiKeyEnvVar];
    }
    if (Array.isArray(config?.apiKeyEnvVar)) {
      for (const key of config.apiKeyEnvVar) {
        if (process.env[key]) return process.env[key];
      }
    }
  }

  return undefined;
}

export class ModelRouterLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly defaultObjectGenerationMode = 'json' as const;
  readonly supportsStructuredOutputs = true;
  readonly supportsImageUrls = true;
  readonly supportedUrls = {} as Record<string, RegExp[]>;

  readonly modelId: string;
  readonly provider: string;

  private base: ModelRouterLanguageModelBase;

  private config: OpenAICompatibleConfig & { fullModelId: string };
  private gateway: MastraModelGateway;

  constructor(config: ModelRouterModelId | OpenAICompatibleConfig) {
    // Parse configuration
    let parsedConfig: OpenAICompatibleConfig & { fullModelId: string };

    if (typeof config === 'string') {
      // First check if it's a valid URL
      let isUrl = false;
      try {
        new URL(config);
        isUrl = true;
      } catch {
        // Not a URL, continue with provider parsing
      }

      if (isUrl) {
        // If it's a direct URL - use as-is
        parsedConfig = {
          id: 'unknown',
          url: config,
          fullModelId: 'unknown',
        };
        this.provider = 'openai-compatible';
        this.config = { id: 'unknown', url: config, fullModelId: 'unknown' };
      } else {
        // Handle magic strings like "openai/gpt-4o" or "netlify/openai/gpt-4o"
        const firstSlashIndex = config.indexOf('/');

        if (firstSlashIndex !== -1) {
          const provider = config.substring(0, firstSlashIndex);
          const modelId = config.substring(firstSlashIndex + 1);

          parsedConfig = {
            id: modelId,
            apiKey: resolveApiKey({ provider }),
            fullModelId: config,
          };
          this.provider = provider;
        } else {
          // No slash at all, treat as direct model ID
          throw new Error(`Invalid model string: "${config}". Use "provider/model" format or a direct URL.`);
        }
      }
    } else {
      // Handle config object
      parsedConfig = { ...config, fullModelId: config.id };

      // Extract provider from id if present
      const parsed = parseModelString(config.id);
      this.provider = parsed.provider || 'openai-compatible';

      if (parsed.provider && parsed.modelId !== config.id) {
        parsedConfig.id = parsed.modelId;
      }

      // Resolve API key if not provided
      if (!parsedConfig.apiKey) {
        parsedConfig.apiKey = resolveApiKey({ provider: parsed.provider || undefined });
      }
    }

    // Store the configuration
    this.modelId = parsedConfig.id;
    this.config = parsedConfig;
    this.gateway = findGatewayForModel(parsedConfig.fullModelId);
    this.base = new OpenAICompatibleModel(
      // TODO: this input string isn't necessary anymore, we'll have separate classes for openai compatible / openai / anthropic / etc
      'openai-compatible',
      this.gateway,
    );
  }

  private validateApiKey(): void {
    // Skip validation for models that will use gateway resolution
    // Gateway handles auth through its own mechanism (e.g., Netlify uses site ID + token)
    const willUseGateway = !this.config.url;
    if (willUseGateway) {
      return;
    }

    // Check if API key is required and missing
    if (!this.config.apiKey && this.provider !== 'openai-compatible') {
      // Get the provider config to find the env var name
      const providerConfig = getProviderConfig(this.provider);
      if (providerConfig?.apiKeyEnvVar) {
        throw new Error(
          `API key not found for provider "${this.provider}". Please set the ${providerConfig.apiKeyEnvVar} environment variable.`,
        );
      } else {
        throw new Error(
          `API key not found for provider "${this.provider}". Please provide an API key in the configuration.`,
        );
      }
    }
  }

  async doGenerate(): Promise<never> {
    throw new Error(
      'doGenerate is not supported by OpenAICompatibleModel. ' +
        'Mastra only uses streaming (doStream) for all LLM calls.',
    );
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    request?: { body: string };
    response?: { headers: Record<string, string> };
    warnings: LanguageModelV2CallWarning[];
  }> {
    // Validate API key and return error stream if validation fails
    try {
      this.validateApiKey();
    } catch (error) {
      // Return an error stream instead of throwing
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'error',
              error: error instanceof Error ? error.message : String(error),
            } as LanguageModelV2StreamPart);
          },
        }),
        warnings: [],
      };
    }

    const apiKey = await this.gateway.getApiKey(this.config.fullModelId);
    const modelConfig = await resolveModelConfig(this.config.fullModelId);
    const requestConfig = await this.base.resolveRequestConfig(modelConfig, apiKey);

    return this.base.doStream(options, requestConfig);
  }
}
