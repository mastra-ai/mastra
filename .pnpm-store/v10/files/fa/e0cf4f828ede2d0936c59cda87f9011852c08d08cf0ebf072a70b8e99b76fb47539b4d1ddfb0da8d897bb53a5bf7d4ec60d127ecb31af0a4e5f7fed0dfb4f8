import { ProviderV1, LanguageModelV1, TranscriptionModelV1 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';

type GroqChatModelId = 'gemma2-9b-it' | 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'llama-guard-3-8b' | 'llama3-70b-8192' | 'llama3-8b-8192' | 'mixtral-8x7b-32768' | 'meta-llama/llama-4-scout-17b-16e-instruct' | 'qwen-qwq-32b' | 'mistral-saba-24b' | 'qwen-2.5-32b' | 'deepseek-r1-distill-qwen-32b' | 'deepseek-r1-distill-llama-70b' | (string & {});
interface GroqChatSettings {
    /**
  Whether to enable parallel function calling during tool use. Default to true.
     */
    parallelToolCalls?: boolean;
    /**
  A unique identifier representing your end-user, which can help OpenAI to
  monitor and detect abuse. Learn more.
  */
    user?: string;
    /**
  Automatically download images and pass the image as data to the model.
  Groq supports image URLs for public models, so this is only needed for
  private models or when the images are not publicly accessible.
  
  Defaults to `false`.
     */
    downloadImages?: boolean;
}

type GroqTranscriptionModelId = 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en' | 'whisper-large-v3' | (string & {});

interface GroqProvider extends ProviderV1 {
    /**
  Creates a model for text generation.
  */
    (modelId: GroqChatModelId, settings?: GroqChatSettings): LanguageModelV1;
    /**
  Creates an Groq chat model for text generation.
     */
    languageModel(modelId: GroqChatModelId, settings?: GroqChatSettings): LanguageModelV1;
    /**
  Creates a model for transcription.
     */
    transcription(modelId: GroqTranscriptionModelId): TranscriptionModelV1;
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

export { type GroqProvider, type GroqProviderSettings, createGroq, groq };
