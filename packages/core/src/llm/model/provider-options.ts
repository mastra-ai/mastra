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
  xai?: XaiProviderOptions & Record<string, any>;
};

/**
 * Shallow-merges provider-options per provider key. `override` wins at the leaf
 * within the same provider; providers only in `base` are preserved.
 */
export function mergeProviderOptions<T extends ProviderOptions | SharedV2ProviderOptions | SharedV3ProviderOptions>(
  base: T | undefined,
  override: T | undefined,
): T | undefined {
  if (!base) return override;
  if (!override) return base;

  const out: Record<string, Record<string, unknown>> = {};
  for (const [provider, opts] of Object.entries(base)) {
    if (opts && typeof opts === 'object') {
      out[provider] = { ...(opts as Record<string, unknown>) };
    }
  }
  for (const [provider, opts] of Object.entries(override)) {
    if (opts && typeof opts === 'object') {
      out[provider] = { ...(out[provider] ?? {}), ...(opts as Record<string, unknown>) };
    }
  }
  return out as T;
}
