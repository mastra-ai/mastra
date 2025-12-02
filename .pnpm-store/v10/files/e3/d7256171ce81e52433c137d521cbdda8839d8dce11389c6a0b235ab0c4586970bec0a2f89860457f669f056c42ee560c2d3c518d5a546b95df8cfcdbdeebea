import { ProviderV2, LanguageModelV2, EmbeddingModelV2, ImageModelV2, TranscriptionModelV2, SpeechModelV2 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';
import { codeInterpreter, fileSearch, imageGeneration, webSearchPreview } from '@ai-sdk/openai/internal';

declare const azureOpenaiTools: {
    codeInterpreter: typeof codeInterpreter;
    fileSearch: typeof fileSearch;
    imageGeneration: typeof imageGeneration;
    webSearchPreview: typeof webSearchPreview;
};

interface AzureOpenAIProvider extends ProviderV2 {
    (deploymentId: string): LanguageModelV2;
    /**
  Creates an Azure OpenAI chat model for text generation.
     */
    languageModel(deploymentId: string): LanguageModelV2;
    /**
  Creates an Azure OpenAI chat model for text generation.
     */
    chat(deploymentId: string): LanguageModelV2;
    /**
  Creates an Azure OpenAI responses API model for text generation.
     */
    responses(deploymentId: string): LanguageModelV2;
    /**
  Creates an Azure OpenAI completion model for text generation.
     */
    completion(deploymentId: string): LanguageModelV2;
    /**
  @deprecated Use `textEmbedding` instead.
     */
    embedding(deploymentId: string): EmbeddingModelV2<string>;
    /**
     * Creates an Azure OpenAI DALL-E model for image generation.
     */
    image(deploymentId: string): ImageModelV2;
    /**
     * Creates an Azure OpenAI DALL-E model for image generation.
     */
    imageModel(deploymentId: string): ImageModelV2;
    textEmbedding(deploymentId: string): EmbeddingModelV2<string>;
    /**
  Creates an Azure OpenAI model for text embeddings.
     */
    textEmbeddingModel(deploymentId: string): EmbeddingModelV2<string>;
    /**
     * Creates an Azure OpenAI model for audio transcription.
     */
    transcription(deploymentId: string): TranscriptionModelV2;
    /**
     * Creates an Azure OpenAI model for speech generation.
     */
    speech(deploymentId: string): SpeechModelV2;
    /**
     * AzureOpenAI-specific tools.
     */
    tools: typeof azureOpenaiTools;
}
interface AzureOpenAIProviderSettings {
    /**
  Name of the Azure OpenAI resource. Either this or `baseURL` can be used.
  
  The resource name is used in the assembled URL: `https://{resourceName}.openai.azure.com/openai/v1{path}`.
       */
    resourceName?: string;
    /**
  Use a different URL prefix for API calls, e.g. to use proxy servers. Either this or `resourceName` can be used.
  When a baseURL is provided, the resourceName is ignored.
  
  With a baseURL, the resolved URL is `{baseURL}/v1{path}`.
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
    /**
  Custom api version to use. Defaults to `preview`.
      */
    apiVersion?: string;
    /**
  Use deployment-based URLs for specific model types. Set to true to use legacy deployment format:
  `{baseURL}/deployments/{deploymentId}{path}?api-version={apiVersion}` instead of
  `{baseURL}/v1{path}?api-version={apiVersion}`.
     */
    useDeploymentBasedUrls?: boolean;
}
/**
Create an Azure OpenAI provider instance.
 */
declare function createAzure(options?: AzureOpenAIProviderSettings): AzureOpenAIProvider;
/**
Default Azure OpenAI provider instance.
 */
declare const azure: AzureOpenAIProvider;

declare const VERSION: string;

export { type AzureOpenAIProvider, type AzureOpenAIProviderSettings, VERSION, azure, createAzure };
