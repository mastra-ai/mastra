/**
 * Provider-specific options for AI SDK models
 *
 * This file imports and re-exports provider options from AI SDK v5 packages
 * to provide type-safe provider options based on the selected provider.
 */

// Import types from AI SDK v5 packages
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic-v5';
import type { DeepSeekChatOptions } from '@ai-sdk/deepseek-v5';
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google-v5';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai-v5';
import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { SharedV3ProviderOptions } from '@ai-sdk/provider-v6';
import type { XaiProviderOptions } from '@ai-sdk/xai-v5';

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
