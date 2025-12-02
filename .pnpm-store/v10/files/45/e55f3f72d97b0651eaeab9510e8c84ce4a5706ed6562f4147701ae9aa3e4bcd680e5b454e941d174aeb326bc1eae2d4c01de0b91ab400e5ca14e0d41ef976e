import { ProviderV2, LanguageModelV2, TranscriptionModelV2 } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { FetchFunction } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

type GroqChatModelId = 'gemma2-9b-it' | 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile' | 'meta-llama/llama-guard-4-12b' | 'openai/gpt-oss-120b' | 'openai/gpt-oss-20b' | 'deepseek-r1-distill-llama-70b' | 'meta-llama/llama-4-maverick-17b-128e-instruct' | 'meta-llama/llama-4-scout-17b-16e-instruct' | 'meta-llama/llama-prompt-guard-2-22m' | 'meta-llama/llama-prompt-guard-2-86m' | 'mistral-saba-24b' | 'moonshotai/kimi-k2-instruct' | 'qwen/qwen3-32b' | 'llama-guard-3-8b' | 'llama3-70b-8192' | 'llama3-8b-8192' | 'mixtral-8x7b-32768' | 'qwen-qwq-32b' | 'qwen-2.5-32b' | 'deepseek-r1-distill-qwen-32b' | (string & {});
declare const groqProviderOptions: z.ZodObject<{
    reasoningFormat: z.ZodOptional<z.ZodEnum<{
        parsed: "parsed";
        raw: "raw";
        hidden: "hidden";
    }>>;
    reasoningEffort: z.ZodOptional<z.ZodString>;
    parallelToolCalls: z.ZodOptional<z.ZodBoolean>;
    user: z.ZodOptional<z.ZodString>;
    structuredOutputs: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type GroqProviderOptions = z.infer<typeof groqProviderOptions>;

type GroqTranscriptionModelId = 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en' | 'whisper-large-v3' | (string & {});

declare const groqTools: {
    browserSearch: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{}, {}>;
};

interface GroqProvider extends ProviderV2 {
    /**
  Creates a model for text generation.
  */
    (modelId: GroqChatModelId): LanguageModelV2;
    /**
  Creates an Groq chat model for text generation.
     */
    languageModel(modelId: GroqChatModelId): LanguageModelV2;
    /**
  Creates a model for transcription.
     */
    transcription(modelId: GroqTranscriptionModelId): TranscriptionModelV2;
    /**
     * Tools provided by Groq.
     */
    tools: typeof groqTools;
}
interface GroqProviderSettings {
    /**
  Base URL for the Groq API calls.
       */
    baseURL?: string;
    /**
  API key for authenticating requests.
       */
    apiKey?: string;
    /**
  Custom headers to include in the requests.
       */
    headers?: Record<string, string>;
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
}
/**
Create an Groq provider instance.
 */
declare function createGroq(options?: GroqProviderSettings): GroqProvider;
/**
Default Groq provider instance.
 */
declare const groq: GroqProvider;

/**
 * Browser search tool for Groq models.
 *
 * Provides interactive browser search capabilities that go beyond traditional web search
 * by navigating websites interactively and providing more detailed results.
 *
 * Currently supported on:
 * - openai/gpt-oss-20b
 * - openai/gpt-oss-120b
 *
 * @see https://console.groq.com/docs/browser-search
 */
declare const browserSearch: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{}, {}>;

export { type GroqProvider, type GroqProviderOptions, type GroqProviderSettings, browserSearch, createGroq, groq };
