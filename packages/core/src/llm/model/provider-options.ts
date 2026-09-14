/**
 * Provider-specific options for AI SDK models
 *
 * This file imports and re-exports provider options from AI SDK v5 packages
 * to provide type-safe provider options based on the selected provider.
 */

// Import types from AI SDK packages
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic-v6';
import type { DeepSeekChatOptions } from '@ai-sdk/deepseek-v6';
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google-v6';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai-v6';
import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { SharedV3ProviderOptions } from '@ai-sdk/provider-v6';
import type { XaiProviderOptions } from '@ai-sdk/xai-v6';

// Re-export the types
export type {
  AnthropicProviderOptions,
  DeepSeekChatOptions,
  GoogleGenerativeAIProviderOptions,
  OpenAIResponsesProviderOptions,
  XaiProviderOptions,
};

/** Options passed to Google's generative AI provider. */
export type GoogleProviderOptions = GoogleGenerativeAIProviderOptions;
/** Streaming transport selection for the Responses API. */
export type OpenAITransport = 'auto' | 'websocket' | 'fetch';
/** Connection settings for Responses API WebSocket streaming. */
export type ResponsesWebSocketOptions = {
  /**
   * WebSocket endpoint URL.
   * @default 'wss://api.openai.com/v1/responses'
   */
  url?: string;
  /**
   * Additional headers sent when establishing the WebSocket connection.
   * Authorization and OpenAI-Beta are managed internally.
   */
  headers?: Record<string, string>;
  /**
   * Whether to close the WebSocket connection when the stream finishes.
   * @default true
   */
  closeOnFinish?: boolean;
};
/** OpenAI Responses WebSocket connection settings. */
export type OpenAIWebSocketOptions = ResponsesWebSocketOptions;
/** OpenAI Responses options with Mastra's streaming transport configuration. */
export type OpenAIProviderOptions = OpenAIResponsesProviderOptions & {
  /**
   * Select the transport used for streaming responses.
   * - `fetch` uses HTTP streaming.
   * - `websocket` uses the OpenAI Responses WebSocket API when supported.
   * - `auto` chooses WebSocket when supported, otherwise falls back to fetch.
   */
  transport?: OpenAITransport;
  /**
   * WebSocket-specific configuration for OpenAI streaming.
   */
  websocket?: OpenAIWebSocketOptions;
};
/** Azure Responses WebSocket settings with an Azure-specific endpoint override. */
export type AzureWebSocketOptions = Omit<ResponsesWebSocketOptions, 'url'> & {
  /**
   * WebSocket endpoint URL.
   * @default resource-specific Azure OpenAI Responses URL
   */
  url?: string;
};
/** Azure Responses options with Mastra's streaming transport configuration. */
export type AzureProviderOptions = OpenAIResponsesProviderOptions & {
  /**
   * Select the transport used for streaming responses.
   * - `fetch` uses HTTP streaming.
   * - `websocket` uses the Azure OpenAI Responses WebSocket API when supported.
   * - `auto` chooses WebSocket when supported, otherwise falls back to fetch.
   */
  transport?: OpenAITransport;
  /**
   * WebSocket-specific configuration for Azure OpenAI Responses streaming.
   */
  websocket?: AzureWebSocketOptions;
};
/** Provider-specific options for DeepSeek chat models. */
export type DeepSeekProviderOptions = DeepSeekChatOptions;

/**
 * Provider options for AI SDK models.
 *
 * Provider options are keyed by provider ID and contain provider-specific configuration.
 * This type extends SharedV2ProviderOptions to maintain compatibility with AI SDK.
 *
 * Each provider's options can include both known typed options and unknown keys for
 * forward compatibility with new provider features.
 *
 * @example
 * ```ts
 * const result = await agent.generate('hello', {
 *   providerOptions: {
 *     anthropic: {
 *       sendReasoning: true,
 *       thinking: { type: 'enabled', budget: ['low'] }
 *     }
 *   }
 * });
 * ```
 */
export type ProviderOptions = (SharedV2ProviderOptions | SharedV3ProviderOptions) & {
  /** Anthropic options, including additional provider-supported keys. */
  anthropic?: AnthropicProviderOptions & Record<string, any>;
  /** DeepSeek options, including additional provider-supported keys. */
  deepseek?: DeepSeekProviderOptions & Record<string, any>;
  /** Google options, including additional provider-supported keys. */
  google?: GoogleProviderOptions & Record<string, any>;
  /** OpenAI options and streaming transport settings. */
  openai?: OpenAIProviderOptions & Record<string, any>;
  /** Azure OpenAI options and streaming transport settings. */
  azure?: AzureProviderOptions & Record<string, any>;
  /** xAI options, including additional provider-supported keys. */
  xai?: XaiProviderOptions & Record<string, any>;
};

/**
 * Recursively deep-merges provider-options. When both sides have plain objects
 * at the same key, their keys are merged. Arrays and class instances (Date,
 * Map, etc.) are replaced wholesale. Within colliding leaf keys, `override`
 * wins.
 */
export function mergeProviderOptions<T extends ProviderOptions | SharedV2ProviderOptions | SharedV3ProviderOptions>(
  base: T | undefined,
  override: T | undefined,
): T | undefined {
  if (!base) return override;
  if (!override) return base;
  return deepMerge(base, override) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (base === undefined) return override;
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(override)) {
      out[key] = deepMerge(base[key], override[key]);
    }
    return out;
  }
  return override;
}
