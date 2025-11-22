import { createHash } from 'node:crypto';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { AISDKV5LanguageModel } from './aisdk/v5/model';
import { parseModelRouterId } from './gateway-resolver.js';
import type { MastraModelGateway } from './gateways/base.js';
import { findGatewayForModel } from './gateways/index.js';

import { ModelsDevGateway } from './gateways/models-dev.js';
import { NetlifyGateway } from './gateways/netlify.js';
import type { ModelRouterModelId } from './provider-registry.js';
import { PROVIDER_REGISTRY } from './provider-registry.js';
import type { MastraLanguageModelV2, OpenAICompatibleConfig } from './shared.types';

type StreamResult = Awaited<ReturnType<LanguageModelV2['doStream']>>;

function getStaticProvidersByGateway(name: string) {
  return Object.fromEntries(Object.entries(PROVIDER_REGISTRY).filter(([_provider, config]) => config.gateway === name));
}

export const defaultGateways = [new NetlifyGateway(), new ModelsDevGateway(getStaticProvidersByGateway(`models.dev`))];

/**
 * @deprecated Use defaultGateways instead. This export will be removed in a future version.
 */
export const gateways = defaultGateways;

export class ModelRouterLanguageModel implements MastraLanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly defaultObjectGenerationMode = 'json' as const;
  readonly supportsStructuredOutputs = true;
  readonly supportsImageUrls = true;
  readonly supportedUrls = {} as Record<string, RegExp[]>;

  readonly modelId: string;
  readonly provider: string;

  private config: OpenAICompatibleConfig & { routerId: string };
  private gateway: MastraModelGateway;

  constructor(config: ModelRouterModelId | OpenAICompatibleConfig, customGateways?: MastraModelGateway[]) {
    // Normalize config to always have an 'id' field for routing
    let normalizedConfig: {
      id: `${string}/${string}`;
      url?: string;
      apiKey?: string;
      headers?: Record<string, string>;
    };

    if (typeof config === 'string') {
      normalizedConfig = { id: config as `${string}/${string}` };
    } else if ('providerId' in config && 'modelId' in config) {
      // Convert providerId/modelId to id format
      normalizedConfig = {
        id: `${config.providerId}/${config.modelId}` as `${string}/${string}`,
        url: config.url,
        apiKey: config.apiKey,
        headers: config.headers,
      };
    } else {
      // config has 'id' field
      normalizedConfig = {
        id: config.id,
        url: config.url,
        apiKey: config.apiKey,
        headers: config.headers,
      };
    }

    const parsedConfig: {
      id: `${string}/${string}`;
      routerId: string;
      url?: string;
      apiKey?: string;
      headers?: Record<string, string>;
    } = {
      ...normalizedConfig,
      routerId: normalizedConfig.id,
    };

    // Resolve gateway once using the normalized ID
    this.gateway = findGatewayForModel(normalizedConfig.id, [...(customGateways || []), ...defaultGateways]);
    // Extract provider from id if present
    // Gateway ID is used as prefix (except for models.dev which is a provider registry)
    const gatewayPrefix = this.gateway.id === 'models.dev' ? undefined : this.gateway.id;
    const parsed = parseModelRouterId(normalizedConfig.id, gatewayPrefix);

    this.provider = parsed.providerId || 'openai-compatible';

    if (parsed.providerId && parsed.modelId !== normalizedConfig.id) {
      parsedConfig.id = parsed.modelId as `${string}/${string}`;
    }

    this.modelId = parsedConfig.id;
    this.config = parsedConfig;
  }

  async doGenerate(options: LanguageModelV2CallOptions): Promise<StreamResult> {
    let apiKey: string;
    try {
      // If custom URL is provided, skip gateway API key resolution
      // The provider might not be in the registry (e.g., custom providers like ollama)
      if (this.config.url) {
        apiKey = this.config.apiKey || '';
      } else {
        apiKey = this.config.apiKey || (await this.gateway.getApiKey(this.config.routerId));
      }
    } catch (error) {
      // Return an error stream instead of throwing
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'error',
              error: error,
            } as LanguageModelV2StreamPart);
            controller.close();
          },
        }),
      };
    }

    const gatewayPrefix = this.gateway.id === 'models.dev' ? undefined : this.gateway.id;
    const model = await this.resolveLanguageModel({
      apiKey,
      ...parseModelRouterId(this.config.routerId, gatewayPrefix),
    });

    const aiSDKV5Model = new AISDKV5LanguageModel(model);
    return aiSDKV5Model.doGenerate(options);
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<StreamResult> {
    // Validate API key and return error stream if validation fails
    let apiKey: string;
    try {
      // If custom URL is provided, skip gateway API key resolution
      // The provider might not be in the registry (e.g., custom providers like ollama)
      if (this.config.url) {
        apiKey = this.config.apiKey || '';
      } else {
        apiKey = this.config.apiKey || (await this.gateway.getApiKey(this.config.routerId));
      }
    } catch (error) {
      // Return an error stream instead of throwing
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'error',
              error: error,
            } as LanguageModelV2StreamPart);
            controller.close();
          },
        }),
      };
    }

    const gatewayPrefix = this.gateway.id === 'models.dev' ? undefined : this.gateway.id;
    const model = await this.resolveLanguageModel({
      apiKey,
      ...parseModelRouterId(this.config.routerId, gatewayPrefix),
    });

    const aiSDKV5Model = new AISDKV5LanguageModel(model);
    return aiSDKV5Model.doStream(options);
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
      .update(this.gateway.id + modelId + providerId + apiKey + (this.config.url || ''))
      .digest('hex');
    if (ModelRouterLanguageModel.modelInstances.has(key)) return ModelRouterLanguageModel.modelInstances.get(key)!;

    // If custom URL is provided, use it directly with openai-compatible
    if (this.config.url) {
      const modelInstance = createOpenAICompatible({
        name: providerId,
        apiKey,
        baseURL: this.config.url,
        headers: this.config.headers,
        supportsStructuredOutputs: true,
      }).chatModel(modelId);
      ModelRouterLanguageModel.modelInstances.set(key, modelInstance);
      return modelInstance;
    }

    const modelInstance = await this.gateway.resolveLanguageModel({ modelId, providerId, apiKey });
    ModelRouterLanguageModel.modelInstances.set(key, modelInstance);
    return modelInstance;
  }
  private static modelInstances = new Map<string, LanguageModelV2>();
}
