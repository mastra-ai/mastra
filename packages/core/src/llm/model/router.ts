import { createHash } from 'node:crypto';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import type { StreamTransport } from '../../stream/types';
import { AISDKV5LanguageModel } from './aisdk/v5/model';
import { AISDKV6LanguageModel } from './aisdk/v6/model';
import { parseModelRouterId } from './gateway-resolver.js';
import type { GatewayLanguageModel, MastraModelGateway } from './gateways/base.js';
import { findGatewayForModel } from './gateways/index.js';

import { ModelsDevGateway } from './gateways/models-dev.js';
import { NetlifyGateway } from './gateways/netlify.js';
import { createOpenAIWebSocketFetch } from './openai-websocket-fetch.js';
import type { OpenAIWebSocketFetch } from './openai-websocket-fetch.js';
import type { OpenAITransport, OpenAIWebSocketOptions, ProviderOptions } from './provider-options.js';
import type { ModelRouterModelId } from './provider-registry.js';
import { PROVIDER_REGISTRY } from './provider-registry.js';
import type { MastraLanguageModelV2, OpenAICompatibleConfig } from './shared.types';

/**
 * Type guard to check if a model is a LanguageModelV3 (AI SDK v6)
 */
function isLanguageModelV3(model: GatewayLanguageModel): model is LanguageModelV3 {
  return model.specificationVersion === 'v3';
}

const OPENAI_WS_ALLOWLIST = new Set(['openai']);
const OPENAI_API_HOST = 'api.openai.com';

function getOpenAITransport(providerOptions?: ProviderOptions): {
  transport: OpenAITransport;
  websocket?: OpenAIWebSocketOptions;
} {
  const openaiOptions = providerOptions?.openai as
    | {
        transport?: OpenAITransport;
        websocket?: OpenAIWebSocketOptions;
      }
    | undefined;

  return {
    transport: openaiOptions?.transport ?? 'fetch',
    websocket: openaiOptions?.websocket,
  };
}

function isOpenAIBaseUrl(baseURL?: string): boolean {
  if (!baseURL) return true;
  try {
    const hostname = new URL(baseURL).hostname;
    return hostname === OPENAI_API_HOST;
  } catch {
    return false;
  }
}

function stableHeaderKey(headers?: Record<string, string>): string {
  if (!headers) return '';
  const entries = Object.entries(headers);
  if (entries.length === 0) return '';
  return JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
}

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

  /**
   * Supported URL patterns by media type for the provider.
   * This is a lazy promise that resolves the underlying model's supportedUrls.
   * Models like Mistral define which URL patterns they support (e.g., application/pdf for https URLs).
   *
   * @see https://github.com/mastra-ai/mastra/issues/12152
   */
  readonly supportedUrls: PromiseLike<Record<string, RegExp[]>>;

  readonly modelId: string;
  readonly provider: string;

  private config: OpenAICompatibleConfig & { routerId: string };
  private gateway: MastraModelGateway;
  private _supportedUrlsPromise: Promise<Record<string, RegExp[]>> | null = null;
  #lastStreamTransport: StreamTransport | undefined;

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

    // Create a lazy PromiseLike for supportedUrls that resolves the underlying model's supportedUrls
    // This allows providers like Mistral to expose their native URL support (e.g., PDF URLs)
    // See: https://github.com/mastra-ai/mastra/issues/12152
    const self = this;
    this.supportedUrls = {
      then<TResult1 = Record<string, RegExp[]>, TResult2 = never>(
        onfulfilled?: ((value: Record<string, RegExp[]>) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        return self._resolveSupportedUrls().then(onfulfilled, onrejected);
      },
    };
  }

  /**
   * Lazily resolves the underlying model's supportedUrls.
   * This is cached to avoid multiple model resolutions.
   * @internal
   */
  private async _resolveSupportedUrls(): Promise<Record<string, RegExp[]>> {
    if (this._supportedUrlsPromise) {
      return this._supportedUrlsPromise;
    }

    this._supportedUrlsPromise = this._fetchSupportedUrls();
    return this._supportedUrlsPromise;
  }

  /**
   * Fetches supportedUrls from the underlying model.
   * @internal
   */
  private async _fetchSupportedUrls(): Promise<Record<string, RegExp[]>> {
    let apiKey: string;
    try {
      if (this.config.url) {
        apiKey = this.config.apiKey || '';
      } else {
        apiKey = this.config.apiKey || (await this.gateway.getApiKey(this.config.routerId));
      }
    } catch {
      // If we can't get the API key, return empty supportedUrls
      // This gracefully degrades - URLs will be downloaded instead
      return {};
    }

    try {
      const gatewayPrefix = this.gateway.id === 'models.dev' ? undefined : this.gateway.id;
      const model = await this.resolveLanguageModel({
        apiKey,
        headers: this.config.headers,
        ...parseModelRouterId(this.config.routerId, gatewayPrefix),
      });

      // Get supportedUrls from the underlying model
      const modelSupportedUrls = model.supportedUrls;
      if (!modelSupportedUrls) {
        return {};
      }

      // Handle both Promise and plain object supportedUrls
      if (typeof (modelSupportedUrls as PromiseLike<unknown>).then === 'function') {
        const resolved = await (modelSupportedUrls as PromiseLike<Record<string, RegExp[]>>);
        return resolved ?? {};
      }

      return (modelSupportedUrls as Record<string, RegExp[]>) ?? {};
    } catch {
      // If model resolution fails, return empty supportedUrls
      return {};
    }
  }

  /** @internal */
  _getStreamTransport(): StreamTransport | undefined {
    return this.#lastStreamTransport;
  }

  private setStreamTransport({
    resolvedTransport,
    key,
    openaiWebSocket,
  }: {
    resolvedTransport: OpenAITransport;
    key: string;
    openaiWebSocket?: OpenAIWebSocketOptions;
  }) {
    if (resolvedTransport !== 'websocket') {
      this.#lastStreamTransport = undefined;
      return;
    }

    const wsFetch = ModelRouterLanguageModel.webSocketFetches.get(key);
    if (!wsFetch) {
      this.#lastStreamTransport = undefined;
      return;
    }

    this.#lastStreamTransport = {
      type: 'openai-websocket',
      close: () => wsFetch.close(),
      closeOnFinish: openaiWebSocket?.closeOnFinish ?? true,
    };
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
      headers: this.config.headers,
      ...parseModelRouterId(this.config.routerId, gatewayPrefix),
    });

    // Handle both V2 and V3 models
    if (isLanguageModelV3(model)) {
      const aiSDKV6Model = new AISDKV6LanguageModel(model);
      // Cast V3 stream result to V2 format - the stream contents are compatible at runtime
      return aiSDKV6Model.doGenerate(options as any) as unknown as Promise<StreamResult>;
    }
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
    const { transport, websocket } = getOpenAITransport(options.providerOptions as ProviderOptions | undefined);
    const requestedTransport: OpenAITransport = transport === 'auto' ? 'websocket' : transport;
    const allowWebSocket =
      requestedTransport === 'websocket' &&
      OPENAI_WS_ALLOWLIST.has(this.provider) &&
      !this.config.url &&
      this.gateway.id === 'models.dev';
    const resolvedTransport: OpenAITransport = allowWebSocket ? 'websocket' : 'fetch';

    const model = await this.resolveLanguageModel({
      apiKey,
      headers: this.config.headers,
      transport: resolvedTransport,
      openaiWebSocket: websocket,
      ...parseModelRouterId(this.config.routerId, gatewayPrefix),
    });

    // Handle both V2 and V3 models
    if (isLanguageModelV3(model)) {
      const aiSDKV6Model = new AISDKV6LanguageModel(model);
      // Cast V3 stream result to V2 format - the stream contents are compatible at runtime
      return aiSDKV6Model.doStream(options as any) as unknown as Promise<StreamResult>;
    }
    const aiSDKV5Model = new AISDKV5LanguageModel(model);
    return aiSDKV5Model.doStream(options);
  }

  private async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
    transport,
    openaiWebSocket,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: OpenAITransport;
    openaiWebSocket?: OpenAIWebSocketOptions;
  }): Promise<GatewayLanguageModel> {
    const resolvedTransport: OpenAITransport = transport ?? 'fetch';
    const websocketKey =
      resolvedTransport === 'websocket'
        ? `${openaiWebSocket?.url ?? ''}:${stableHeaderKey(openaiWebSocket?.headers)}`
        : '';
    const key = createHash('sha256')
      .update(
        this.gateway.id +
          modelId +
          providerId +
          apiKey +
          (this.config.url || '') +
          stableHeaderKey(headers) +
          resolvedTransport +
          websocketKey,
      )
      .digest('hex');
    if (ModelRouterLanguageModel.modelInstances.has(key)) {
      this.setStreamTransport({ resolvedTransport, key, openaiWebSocket });
      return ModelRouterLanguageModel.modelInstances.get(key)!;
    }

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
      this.setStreamTransport({ resolvedTransport, key, openaiWebSocket });
      return modelInstance;
    }

    if (resolvedTransport === 'websocket' && providerId === 'openai' && this.gateway.id === 'models.dev') {
      const baseURL = await this.gateway.buildUrl(this.config.routerId, process.env as Record<string, string>);

      if (isOpenAIBaseUrl(baseURL)) {
        const { modelInstance, wsFetch } = this.resolveOpenAIWebSocketModel({
          modelId,
          apiKey,
          baseURL,
          headers,
          openaiWebSocket,
        });
        ModelRouterLanguageModel.modelInstances.set(key, modelInstance);
        ModelRouterLanguageModel.webSocketFetches.set(key, wsFetch);
        this.setStreamTransport({ resolvedTransport, key, openaiWebSocket });
        return modelInstance;
      }
    }

    const modelInstance = await this.gateway.resolveLanguageModel({ modelId, providerId, apiKey, headers });
    ModelRouterLanguageModel.modelInstances.set(key, modelInstance);
    this.setStreamTransport({ resolvedTransport, key, openaiWebSocket });
    return modelInstance;
  }

  private resolveOpenAIWebSocketModel({
    modelId,
    apiKey,
    baseURL,
    headers,
    openaiWebSocket,
  }: {
    modelId: string;
    apiKey: string;
    baseURL?: string;
    headers?: Record<string, string>;
    openaiWebSocket?: OpenAIWebSocketOptions;
  }): { modelInstance: GatewayLanguageModel; wsFetch: OpenAIWebSocketFetch } {
    const wsFetch = createOpenAIWebSocketFetch({
      url: openaiWebSocket?.url,
      headers: openaiWebSocket?.headers,
    });

    const modelInstance = createOpenAI({
      apiKey,
      baseURL,
      headers,
      fetch: wsFetch,
    }).responses(modelId);
    return { modelInstance, wsFetch };
  }
  private static modelInstances = new Map<string, GatewayLanguageModel>();
  private static webSocketFetches = new Map<string, OpenAIWebSocketFetch>();
}
