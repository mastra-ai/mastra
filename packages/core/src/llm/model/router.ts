import { createHash } from 'node:crypto';
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { parseModelRouterId } from './gateway-resolver.js';
import type { MastraModelGateway } from './gateways/base.js';
import { findGatewayForModel } from './gateways/index.js';

import { ModelsDevGateway } from './gateways/models-dev.js';
import { NetlifyGateway } from './gateways/netlify.js';
import type { ModelRouterModelId } from './provider-registry.generated.js';
import { parseModelString, getProviderConfig, PROVIDER_REGISTRY } from './provider-registry.generated.js';
import type { OpenAICompatibleConfig } from './shared.types';

function getStaticProvidersByGateway(name: string) {
  return Object.fromEntries(Object.entries(PROVIDER_REGISTRY).filter(([_provider, config]) => config.gateway === name));
}

export const gateways = [new NetlifyGateway(), new ModelsDevGateway(getStaticProvidersByGateway(`models.dev`))];

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
        this.gateway = findGatewayForModel(config, gateways);
        // Extract provider from id if present
        const parsed = parseModelString(
          this.gateway.prefix && config.startsWith(`${this.gateway.prefix}/`)
            ? config.substring(`${this.gateway.prefix}/`.length)
            : config,
        );

        // Handle magic strings like "openai/gpt-4o" or "netlify/openai/gpt-4o"
        parsedConfig = {
          id: this.gateway.prefix ? `${parsed.provider}/${parsed.modelId}` : parsed.modelId,
          apiKey: resolveApiKey({ provider: parsed.provider || config }),
          fullModelId: config,
        };
        this.provider = this.gateway.prefix || parsed.provider || config;
      }
    } else {
      // Handle config object
      parsedConfig = { ...config, fullModelId: config.id };

      this.gateway = findGatewayForModel(config.id, gateways);
      // Extract provider from id if present
      const parsed = parseModelString(
        this.gateway.prefix && config.id.startsWith(`${this.gateway.prefix}/`)
          ? config.id.substring(`${this.gateway.prefix}/`.length)
          : config.id,
      );
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
    this.gateway = findGatewayForModel(parsedConfig.fullModelId, gateways);
  }

  async doGenerate(): Promise<never> {
    throw new Error(
      'doGenerate is not supported by Mastra model router. ' +
        'Mastra only uses streaming (doStream) for all LLM calls.',
    );
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>> {
    // Validate API key and return error stream if validation fails
    let apiKey: string;
    try {
      apiKey = await this.gateway.getApiKey(this.config.fullModelId);
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
      };
    }

    const model = await this.resolveLanguageModel({
      apiKey,
      ...parseModelRouterId(this.config.fullModelId, this.gateway.prefix),
    });

    return model.doStream(options);
  }

  private async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const key = createHash('sha256')
      .update(this.gateway.name + modelId + providerId + apiKey)
      .digest('hex');
    if (ModelRouterLanguageModel.modelInstances.has(key)) return ModelRouterLanguageModel.modelInstances.get(key)!;
    const modelInstance = await this.gateway.resolveLanguageModel({ modelId, providerId, apiKey });
    ModelRouterLanguageModel.modelInstances.set(key, modelInstance);
    return modelInstance;
  }
  private static modelInstances = new Map<string, LanguageModelV2>();
}
