/**
 * Base class for model gateway providers
 * Gateways fetch provider configurations and build URLs for model access
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import type { LanguageModelV4 } from '@ai-sdk/provider-v7';
import type { StreamTransport } from '../../../stream/types';
import type { OpenAITransport, ResponsesWebSocketOptions } from '../provider-options.js';

export interface ProviderConfig {
  url?: string;
  apiKeyHeader?: string;
  apiKeyEnvVar: string | string[];
  name: string;
  models: string[];
  docUrl?: string; // Optional documentation URL
  gateway: string;
  npm?: string; // NPM package name from models.dev (e.g., "@ai-sdk/anthropic")
}

/**
 * Compact capability data collected from gateways during generation.
 * Each provider maps to a list of model IDs that support a capability.
 */
export type AttachmentCapabilities = Record<string, string[]>;
export type TemperatureCapabilities = Record<string, string[]>;

/**
 * Union type for language models that can be returned by gateways.
 * Supports AI SDK v5 (LanguageModelV2), v6 (LanguageModelV3), and v7 (LanguageModelV4).
 */
export type GatewayLanguageModel = LanguageModelV2 | LanguageModelV3 | LanguageModelV4;
export type GatewayStreamTransportHandle = Pick<StreamTransport, 'type' | 'close'>;

/** @internal Stream transport handle attached by gateways that own custom streaming transports. */
export const MASTRA_GATEWAY_STREAM_TRANSPORT = Symbol.for('@mastra/core.gatewayStreamTransport');

export type GatewayLanguageModelWithStreamTransport = GatewayLanguageModel & {
  [MASTRA_GATEWAY_STREAM_TRANSPORT]?: GatewayStreamTransportHandle;
};

export type GatewayAuthSource = 'explicit' | 'gateway' | 'legacy';

export type GatewayAuthRequest = {
  gatewayId: string;
  providerId: string;
  modelId: string;
  routerId: string;
};

export type GatewayAuthResult = {
  apiKey?: string;
  bearerToken?: string;
  headers?: Record<string, string>;
  source?: GatewayAuthSource;
};

export interface MastraModelGatewayInterface {
  /**
   * Unique identifier for the gateway
   * This ID is used as the prefix for all providers from this gateway (e.g., "netlify/anthropic")
   * Exception: models.dev is a provider registry and doesn't use a prefix
   */
  readonly id: string;

  /**
   * Name of the gateway provider
   */
  readonly name: string;

  /**
   * Get the gateway ID. Optional for plain object gateways; defaults to `id`.
   * @deprecated Use `id` instead.
   * @returns The gateway ID.
   */
  getId?(): string;

  /**
   * Whether this gateway should be enabled for the current runtime.
   * Disabled gateways are skipped when syncing and filtered out when reading cached registry data.
   * Optional for plain object gateways; defaults to `true`.
   */
  shouldEnable?(): boolean;

  /**
   * Whether this gateway claims the given model/router id even when the id is
   * not prefixed with the gateway's own id (e.g. a bare `anthropic/...` id that
   * this gateway can authenticate via OAuth/stored credentials).
   * Checked after exact prefix matching but before the models.dev registry
   * fallback. Optional; defaults to `false`.
   */
  handlesModel?(modelId: string): boolean;

  /**
   * Fetch provider configurations from the gateway.
   * Should return providers in the standard format.
   */
  fetchProviders(): Promise<Record<string, ProviderConfig>>;

  /**
   * Build the URL for a specific model/provider combination
   * @param modelId Full model ID (e.g., "openai/gpt-4o" or "netlify/openai/gpt-4o")
   * @param envVars Environment variables available
   * @returns URL string if this gateway can handle the model, false otherwise
   */
  buildUrl(modelId: string, envVars: Record<string, string>): string | undefined | Promise<string | undefined>;

  getApiKey(modelId: string): Promise<string>;

  /**
   * Resolve auth before falling back to getApiKey/env behavior.
   */
  resolveAuth?(request: GatewayAuthRequest): Promise<GatewayAuthResult | undefined> | GatewayAuthResult | undefined;

  /**
   * Resolve a language model from the gateway.
   * Supports returning LanguageModelV2 (AI SDK v5), LanguageModelV3 (AI SDK v6), or LanguageModelV4 (AI SDK v7).
   */
  resolveLanguageModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: OpenAITransport;
    responsesWebSocket?: ResponsesWebSocketOptions;
  }): Promise<GatewayLanguageModel> | GatewayLanguageModel;

  /**
   * Custom serialization for tracing/observability spans.
   * Gateways typically hold credentials (apiKey, OAuth tokens, customFetch
   * closures that capture secrets). The base implementation exposes only
   * the gateway identity so subclasses are safe by default.
   */
  serializeForSpan?(): { id: string; name: string } & Record<string, unknown>;
}

export abstract class MastraModelGateway implements MastraModelGatewayInterface {
  abstract readonly id: string;
  abstract readonly name: string;

  getId(): string {
    return this.id;
  }

  shouldEnable(): boolean {
    return true;
  }

  handlesModel(_modelId: string): boolean {
    return false;
  }

  abstract fetchProviders(): Promise<Record<string, ProviderConfig>>;

  abstract buildUrl(modelId: string, envVars: Record<string, string>): string | undefined | Promise<string | undefined>;

  abstract getApiKey(modelId: string): Promise<string>;

  abstract resolveLanguageModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: OpenAITransport;
    responsesWebSocket?: ResponsesWebSocketOptions;
  }): Promise<GatewayLanguageModel> | GatewayLanguageModel;

  serializeForSpan(): { id: string; name: string } {
    return { id: this.id, name: this.name };
  }
}
