/**
 * Provider-specific options for AI SDK models
 * 
 * This file imports and re-exports provider options from AI SDK v5 packages
 * to provide type-safe provider options based on the selected provider.
 */

// Import types from AI SDK v5 packages
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic-v5';
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google-v5';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai-v5';
import type { XaiProviderOptions } from '@ai-sdk/xai-v5';

// Re-export the types
export type { AnthropicProviderOptions, GoogleGenerativeAIProviderOptions, OpenAIResponsesProviderOptions, XaiProviderOptions };

// Alias for consistency
export type GoogleProviderOptions = GoogleGenerativeAIProviderOptions;
export type OpenAIProviderOptions = OpenAIResponsesProviderOptions;

// Map provider IDs to their specific options types
export type ProviderOptionsMap = {
  anthropic?: AnthropicProviderOptions;
  google?: GoogleProviderOptions;
  openai?: OpenAIProviderOptions;
  xai?: XaiProviderOptions;
};

/**
 * Provider options for AI SDK models.
 * 
 * Provider options are keyed by provider ID and contain provider-specific configuration.
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
export type ProviderOptions = ProviderOptionsMap;

// Helper type to get provider options based on provider ID
export type ProviderOptionsFor<T extends keyof ProviderOptionsMap> = ProviderOptionsMap[T];
