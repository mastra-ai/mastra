import { createHash } from 'node:crypto';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v6';
import { createOpenAI } from '@ai-sdk/openai-v6';
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import type { LanguageModelV4 } from '@ai-sdk/provider-v7';
import { attachModelStreamTransport } from '../../stream/types';
import type { StreamTransport } from '../../stream/types';
import { AISDKV5LanguageModel } from './aisdk/v5/model';
import { AISDKV6LanguageModel } from './aisdk/v6/model';
import { AISDKV7LanguageModel } from './aisdk/v7/model';
import { MASTRA_GATEWAY_STREAM_TRANSPORT } from './gateways/base.js';
import type {
  GatewayAuthResult,
  GatewayLanguageModel,
  GatewayLanguageModelWithStreamTransport,
  GatewayStreamTransportHandle,
  MastraModelGatewayInterface,
} from './gateways/base.js';
import { defaultGateways } from './gateways/defaults.js';
import { GatewayManager } from './gateways/index.js';

import { createOpenAIWebSocketFetch } from './openai-websocket-fetch.js';
import type { OpenAIWebSocketFetch } from './openai-websocket-fetch.js';
import type { OpenAITransport, ProviderOptions, ResponsesWebSocketOptions } from './provider-options.js';
import type { ModelRouterModelId } from './provider-registry.js';
import { modelSupportsTemperature } from './provider-registry.js';
import type { MastraLanguageModelV2, OpenAICompatibleConfig } from './shared.types';

export { defaultGateways, gateways } from './gateways/defaults.js';

/**
 * Type guard to check if a model is a LanguageModelV4 (AI SDK v7)
 */
function isLanguageModelV4(model: GatewayLanguageModel): model is LanguageModelV4 {
  return model.specificationVersion === 'v4';
}

/**
 * Type guard to check if a model is a LanguageModelV3 (AI SDK v6)
 */
function isLanguageModelV3(model: GatewayLanguageModel): model is LanguageModelV3 {
  return model.specificationVersion === 'v3';
}

const OPENAI_WS_ALLOWLIST = new Set(['openai']);
const OPENAI_API_HOST = 'api.openai.com';

type GatewayModelCache = {
  modelInstances: Map<string, GatewayLanguageModel>;
  webSocketFetches: Map<string, OpenAIWebSocketFetch>;
  gatewayStreamTransports: Map<string, GatewayStreamTransportHandle>;
};

function createGatewayModelCache(): GatewayModelCache {
  return {
    modelInstances: new Map(),
    webSocketFetches: new Map(),
    gatewayStreamTransports: new Map(),
  };
}

function getOpenAITransport(
  providerOptions?: ProviderOptions,
  providerId?: string,
): {
  transport: OpenAITransport;
  websocket?: ResponsesWebSocketOptions;
} {
  const transportOptions = (providerId === 'azure-openai' ? providerOptions?.azure : providerOptions?.openai) as
    | {
        transport?: OpenAITransport;
        websocket?: ResponsesWebSocketOptions;
      }
    | undefined;

  return {
    transport: transportOptions?.transport ?? 'fetch',
    websocket: transportOptions?.websocket,
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

function mergeHeaders(
  baseHeaders?: Record<string, string>,
  authHeaders?: Record<string, string>,
): Record<string, string> | undefined {
  if (!baseHeaders && !authHeaders) return undefined;
  return { ...baseHeaders, ...authHeaders };
}

type StreamResult = Awaited<ReturnType<LanguageModelV2['doStream']>>;

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
  readonly gatewayId: string;

  private config: OpenAICompatibleConfig & { routerId: string };
  private gateway: MastraModelGatewayInterface;
  private _supportedUrlsPromise: Promise<Record<string, RegExp[]>> | null = null;
  private readonly instanceGatewayCache = createGatewayModelCache();
  #lastStreamTransport: StreamTransport | undefined;
  #manager: GatewayManager;

  constructor(config: ModelRouterModelId | OpenAICompatibleConfig, customGateways?: MastraModelGatewayInterface[]) {
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

    // Resolve gateway once using the normalized ID. The manager deduplicates
    // the gateway chain (custom-before-default, first-wins) and centralises
    // gateway selection + id parsing in a single resolveModelId call.
    this.#manager = new GatewayManager([...(customGateways ?? []), ...defaultGateways]);
    const resolved = this.#manager.resolveModelId(normalizedConfig.id);
    this.gateway = resolved.gateway;
    this.gatewayId = resolved.gatewayId;
    this.provider = resolved.providerId || 'openai-compatible';

    if (resolved.providerId && resolved.modelId !== normalizedConfig.id) {
      parsedConfig.id = resolved.modelId as `${string}/${string}`;
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
      const resolved = this.#manager.resolveModelId(this.config.routerId);
      const auth = await this.resolveAuth(resolved.providerId, resolved.modelId);
      apiKey = auth.apiKey ?? '';
      const model = await this.resolveLanguageModel({
        apiKey,
        auth,
        headers: mergeHeaders(this.config.headers, auth.headers),
        ...resolved,
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

  /**
   * Custom serialization for tracing/observability spans.
   * Excludes `config` (holds apiKey, headers, url) and `gateway`
   * (may hold proxy credentials or cached tokens) so they cannot leak
   * into telemetry backends.
   */
  serializeForSpan(): {
    specificationVersion: 'v2';
    modelId: string;
    provider: string;
    gatewayId: string;
  } {
    return {
      specificationVersion: this.specificationVersion,
      modelId: this.modelId,
      provider: this.provider,
      gatewayId: this.gatewayId,
    };
  }

  private getGatewayCache(): GatewayModelCache {
    let cache = ModelRouterLanguageModel.gatewayCaches.get(this.gateway);

    if (!cache) {
      cache = createGatewayModelCache();
      ModelRouterLanguageModel.gatewayCaches.set(this.gateway, cache);
    }

    return cache;
  }

  private shouldUseInstanceGatewayCache(auth: GatewayAuthResult): boolean {
    return this.config.apiKey !== undefined || auth.source === 'explicit' || auth.source === 'gateway';
  }

  private setStreamTransportHandle({
    resolvedTransport,
    transport,
    responsesWebSocket,
  }: {
    resolvedTransport: OpenAITransport;
    transport?: GatewayStreamTransportHandle;
    responsesWebSocket?: ResponsesWebSocketOptions;
  }) {
    if (resolvedTransport !== 'websocket') {
      this.#lastStreamTransport = undefined;
      return;
    }

    if (!transport) {
      this.#lastStreamTransport = undefined;
      return;
    }

    this.#lastStreamTransport = {
      type: transport.type,
      close: transport.close,
      closeOnFinish: responsesWebSocket?.closeOnFinish ?? true,
    };
  }

  private async resolveAuth(_providerId: string, _modelId: string): Promise<GatewayAuthResult> {
    if (this.config.url) {
      return { apiKey: this.config.apiKey ?? '', headers: this.config.headers, source: 'explicit' };
    }

    const explicitHeaders = this.config.headers;

    // explicit apiKey takes precedence
    if (this.config.apiKey) {
      return { apiKey: this.config.apiKey, headers: explicitHeaders, source: 'explicit' };
    }

    // delegate gateway-chain resolution (resolveAuth → getApiKey) to the manager
    const gatewayAuth = await this.#manager.resolveAuth(this.config.routerId);

    // merge any per-instance explicit headers on top of gateway-resolved auth
    return explicitHeaders ? { ...gatewayAuth, headers: { ...explicitHeaders, ...gatewayAuth.headers } } : gatewayAuth;
  }

  private setStreamTransportFromCache({
    cache,
    resolvedTransport,
    key,
    responsesWebSocket,
  }: {
    cache: GatewayModelCache;
    resolvedTransport: OpenAITransport;
    key: string;
    responsesWebSocket?: ResponsesWebSocketOptions;
  }) {
    const wsFetch = cache.webSocketFetches.get(key);
    const gatewayTransport = cache.gatewayStreamTransports.get(key);
    const transport = wsFetch ? { type: 'openai-websocket' as const, close: () => wsFetch.close() } : gatewayTransport;

    this.setStreamTransportHandle({ resolvedTransport, transport, responsesWebSocket });
  }

  private stripUnsupportedSamplingParams(options: LanguageModelV2CallOptions): LanguageModelV2CallOptions {
    const supports = modelSupportsTemperature(this.config.routerId);
    if (supports !== false) return options;

    const { temperature, topP, topK, ...rest } = options;
    if (temperature === undefined && topP === undefined && topK === undefined) return options;
    return rest;
  }

  async doGenerate(options: LanguageModelV2CallOptions): Promise<StreamResult> {
    const resolved = this.#manager.resolveModelId(this.config.routerId);
    let auth: GatewayAuthResult;
    try {
      // If custom URL is provided, skip gateway API key resolution
      // The provider might not be in the registry (e.g., custom providers like ollama)
      auth = await this.resolveAuth(resolved.providerId, resolved.modelId);
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

    const sanitizedOptions = this.stripUnsupportedSamplingParams(options);

    const model = await this.resolveLanguageModel({
      apiKey: auth.apiKey ?? '',
      auth,
      headers: mergeHeaders(this.config.headers, auth.headers),
      ...resolved,
    });

    // Handle V2, V3, and V4 models
    if (isLanguageModelV4(model)) {
      const aiSDKV7Model = new AISDKV7LanguageModel(model);
      return aiSDKV7Model.doGenerate(sanitizedOptions as any) as unknown as Promise<StreamResult>;
    }
    if (isLanguageModelV3(model)) {
      const aiSDKV6Model = new AISDKV6LanguageModel(model);
      return aiSDKV6Model.doGenerate(sanitizedOptions as any) as unknown as Promise<StreamResult>;
    }
    const aiSDKV5Model = new AISDKV5LanguageModel(model);
    return aiSDKV5Model.doGenerate(sanitizedOptions);
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<StreamResult> {
    // Validate API key and return error stream if validation fails
    const resolved = this.#manager.resolveModelId(this.config.routerId);
    let auth: GatewayAuthResult;
    try {
      // If custom URL is provided, skip gateway API key resolution
      // The provider might not be in the registry (e.g., custom providers like ollama)
      auth = await this.resolveAuth(resolved.providerId, resolved.modelId);
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

    const sanitizedOptions = this.stripUnsupportedSamplingParams(options);

    const { transport, websocket } = getOpenAITransport(
      sanitizedOptions.providerOptions as ProviderOptions | undefined,
      resolved.providerId,
    );
    const requestedTransport: OpenAITransport = transport === 'auto' ? 'websocket' : transport;
    const allowWebSocket =
      requestedTransport === 'websocket' &&
      !this.config.url &&
      ((this.gatewayId === 'models.dev' && OPENAI_WS_ALLOWLIST.has(this.provider)) ||
        this.gatewayId === 'azure-openai');
    const resolvedTransport: OpenAITransport = allowWebSocket ? 'websocket' : 'fetch';

    const model = await this.resolveLanguageModel({
      apiKey: auth.apiKey ?? '',
      auth,
      headers: mergeHeaders(this.config.headers, auth.headers),
      transport: resolvedTransport,
      responsesWebSocket: websocket,
      ...resolved,
    });

    // Handle V2, V3, and V4 models
    const streamTransport = this.#lastStreamTransport;
    if (isLanguageModelV4(model)) {
      const aiSDKV7Model = new AISDKV7LanguageModel(model);
      // Cast V4 stream result to V2 format - the stream contents are compatible at runtime
      const streamResult = (await aiSDKV7Model.doStream(sanitizedOptions as any)) as unknown as StreamResult;
      attachModelStreamTransport(streamResult, streamTransport);
      return streamResult;
    }
    if (isLanguageModelV3(model)) {
      const aiSDKV6Model = new AISDKV6LanguageModel(model);
      // Cast V3 stream result to V2 format - the stream contents are compatible at runtime
      const streamResult = (await aiSDKV6Model.doStream(sanitizedOptions as any)) as unknown as StreamResult;
      attachModelStreamTransport(streamResult, streamTransport);
      return streamResult;
    }
    const aiSDKV5Model = new AISDKV5LanguageModel(model);
    const streamResult = await aiSDKV5Model.doStream(sanitizedOptions);
    attachModelStreamTransport(streamResult, streamTransport);
    return streamResult;
  }

  private async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    auth,
    headers,
    transport,
    responsesWebSocket,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    auth: GatewayAuthResult;
    headers?: Record<string, string>;
    transport?: OpenAITransport;
    responsesWebSocket?: ResponsesWebSocketOptions;
  }): Promise<GatewayLanguageModel> {
    const resolvedTransport: OpenAITransport = transport ?? 'fetch';
    const websocketKey =
      resolvedTransport === 'websocket'
        ? `${responsesWebSocket?.url ?? ''}:${stableHeaderKey(responsesWebSocket?.headers)}`
        : '';
    const useInstanceCache = this.shouldUseInstanceGatewayCache(auth);
    const cache = useInstanceCache ? this.instanceGatewayCache : this.getGatewayCache();
    const authScopeKey = useInstanceCache ? `${auth.source ?? ''}` : '';
    const key = createHash('sha256')
      .update(
        JSON.stringify([
          this.gatewayId,
          modelId,
          providerId,
          this.config.url || '',
          stableHeaderKey(headers),
          resolvedTransport,
          websocketKey,
          authScopeKey,
        ]),
      )
      .digest('hex');
    if (cache.modelInstances.has(key)) {
      this.setStreamTransportFromCache({ cache, resolvedTransport, key, responsesWebSocket });
      return cache.modelInstances.get(key)!;
    }

    // If custom URL is provided, use it directly with openai-compatible
    if (this.config.url) {
      const modelInstance = createOpenAICompatible({
        name: providerId,
        apiKey,
        baseURL: this.config.url,
        headers,
        supportsStructuredOutputs: true,
      }).chatModel(modelId);
      cache.modelInstances.set(key, modelInstance);
      this.setStreamTransportHandle({ resolvedTransport, responsesWebSocket });
      return modelInstance;
    }

    if (resolvedTransport === 'websocket' && providerId === 'openai' && this.gatewayId === 'models.dev') {
      const baseURL = await this.gateway.buildUrl(this.config.routerId, process.env as Record<string, string>);

      if (isOpenAIBaseUrl(baseURL)) {
        const { modelInstance, wsFetch } = this.resolveOpenAIWebSocketModel({
          modelId,
          apiKey,
          baseURL,
          headers,
          responsesWebSocket,
        });
        cache.modelInstances.set(key, modelInstance);
        cache.webSocketFetches.set(key, wsFetch);
        this.setStreamTransportFromCache({ cache, resolvedTransport, key, responsesWebSocket });
        return modelInstance;
      }
    }

    const modelInstance = await this.gateway.resolveLanguageModel({
      modelId,
      providerId,
      apiKey,
      headers,
      transport: resolvedTransport,
      responsesWebSocket,
    });
    const gatewayTransport = readGatewayStreamTransport(modelInstance);
    cache.modelInstances.set(key, modelInstance);
    if (gatewayTransport) {
      cache.gatewayStreamTransports.set(key, gatewayTransport);
    }
    this.setStreamTransportHandle({ resolvedTransport, transport: gatewayTransport, responsesWebSocket });
    return modelInstance;
  }

  private resolveOpenAIWebSocketModel({
    modelId,
    apiKey,
    baseURL,
    headers,
    responsesWebSocket,
  }: {
    modelId: string;
    apiKey: string;
    baseURL?: string;
    headers?: Record<string, string>;
    responsesWebSocket?: ResponsesWebSocketOptions;
  }): { modelInstance: GatewayLanguageModel; wsFetch: OpenAIWebSocketFetch } {
    const wsFetch = createOpenAIWebSocketFetch({
      url: responsesWebSocket?.url,
      headers: responsesWebSocket?.headers,
    });

    const modelInstance = createOpenAI({
      apiKey,
      baseURL,
      headers,
      fetch: wsFetch,
    }).responses(modelId);
    return { modelInstance, wsFetch };
  }
  private static _clearCachesForTests() {
    ModelRouterLanguageModel.gatewayCaches = new WeakMap();
  }

  private static gatewayCaches = new WeakMap<MastraModelGatewayInterface, GatewayModelCache>();
}

function readGatewayStreamTransport(model: GatewayLanguageModel): GatewayStreamTransportHandle | undefined {
  return (model as GatewayLanguageModelWithStreamTransport)[MASTRA_GATEWAY_STREAM_TRANSPORT];
}
