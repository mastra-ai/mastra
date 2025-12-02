/**
 * Provider-specific options for AI SDK models
 *
 * This file imports and re-exports provider options from AI SDK v5 packages
 * to provide type-safe provider options based on the selected provider.
 */
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic-v5';
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google-v5';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai-v5';
import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { XaiProviderOptions } from '@ai-sdk/xai-v5';
export type { AnthropicProviderOptions, GoogleGenerativeAIProviderOptions, OpenAIResponsesProviderOptions, XaiProviderOptions, };
export type GoogleProviderOptions = GoogleGenerativeAIProviderOptions;
export type OpenAIProviderOptions = OpenAIResponsesProviderOptions;
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
export type ProviderOptions = SharedV2ProviderOptions & {
    anthropic?: AnthropicProviderOptions & Record<string, any>;
    google?: GoogleProviderOptions & Record<string, any>;
    openai?: OpenAIProviderOptions & Record<string, any>;
    xai?: XaiProviderOptions & Record<string, any>;
};
//# sourceMappingURL=provider-options.d.ts.map