/**
 * Provider-specific options for AI SDK models
 *
 * This file imports and re-exports provider options from AI SDK v5 packages
 * to provide type-safe provider options based on the selected provider.
 */

// Import types from AI SDK packages
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic-v6';
import type { DeepSeekChatOptions } from '@ai-sdk/deepseek-v5';
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

// Alias for consistency
export type GoogleProviderOptions = GoogleGenerativeAIProviderOptions;
export type OpenAITransport = 'auto' | 'websocket' | 'fetch';
export type OpenAIWebSocketOptions = {
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
export type AzureWebSocketOptions = Omit<OpenAIWebSocketOptions, 'url'> & {
  /**
   * WebSocket endpoint URL.
   * @default resource-specific Azure OpenAI Responses URL
   */
  url?: string;
};
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
  anthropic?: AnthropicProviderOptions & Record<string, any>;
  deepseek?: DeepSeekProviderOptions & Record<string, any>;
  google?: GoogleProviderOptions & Record<string, any>;
  openai?: OpenAIProviderOptions & Record<string, any>;
  azure?: AzureProviderOptions & Record<string, any>;
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
