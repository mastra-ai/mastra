import { createHash } from 'node:crypto';
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { parseModelRouterId } from './gateway-resolver.js';
import type { MastraModelGateway } from './gateways/base.js';
import { findGatewayForModel } from './gateways/index.js';

import { ModelsDevGateway } from './gateways/models-dev.js';
import { NetlifyGateway } from './gateways/netlify.js';
import type { ModelRouterModelId } from './provider-registry.js';
import { PROVIDER_REGISTRY } from './provider-registry.js';
import type { OpenAICompatibleConfig } from './shared.types';

function getStaticProvidersByGateway(name: string) {
  return Object.fromEntries(Object.entries(PROVIDER_REGISTRY).filter(([_provider, config]) => config.gateway === name));
}

export const gateways = [new NetlifyGateway(), new ModelsDevGateway(getStaticProvidersByGateway(`models.dev`))];

export class ModelRouterLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly defaultObjectGenerationMode = 'json' as const;
  readonly supportsStructuredOutputs = true;
  readonly supportsImageUrls = true;
  readonly supportedUrls = {} as Record<string, RegExp[]>;

  readonly modelId: string;
  readonly provider: string;

  private config: OpenAICompatibleConfig & { routerId: string };
  private gateway: MastraModelGateway;

  constructor(config: ModelRouterModelId | OpenAICompatibleConfig) {
    if (typeof config === `string`) config = { id: config };

    const parsedConfig: OpenAICompatibleConfig & { routerId: string } = { ...config, routerId: config.id };

    this.gateway = findGatewayForModel(config.id, gateways);
    // Extract provider from id if present
    const parsed = parseModelRouterId(config.id, this.gateway.prefix);

    this.provider = parsed.providerId || 'openai-compatible';

    if (parsed.providerId && parsed.modelId !== config.id) {
      parsedConfig.id = parsed.modelId;
    }

    this.modelId = parsedConfig.id;
    this.config = parsedConfig;
    this.gateway = findGatewayForModel(parsedConfig.routerId, gateways);
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
      apiKey = await this.gateway.getApiKey(this.config.routerId);
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
      ...parseModelRouterId(this.config.routerId, this.gateway.prefix),
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
