/**
 * Provider-specific options for AI SDK models
 *
 * This file imports and re-exports provider options from AI SDK v5 packages
 * to provide type-safe provider options based on the selected provider.
 */

// Import types from AI SDK v5 packages
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import type { DeepSeekChatOptions } from '@ai-sdk/deepseek';
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { SharedV3ProviderOptions } from '@ai-sdk/provider-v6';
import type { XaiProviderSettings } from '@ai-sdk/xai';

// Re-export the types
export type {
  AnthropicProviderOptions,
  DeepSeekChatOptions,
  GoogleGenerativeAIProviderOptions,
  OpenAIResponsesProviderOptions,
  XaiProviderSettings,
};

// Alias for consistency
export type GoogleProviderOptions = GoogleGenerativeAIProviderOptions;
export type OpenAIProviderOptions = OpenAIResponsesProviderOptions;
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
  xai?: XaiProviderSettings & Record<string, any>;
};
