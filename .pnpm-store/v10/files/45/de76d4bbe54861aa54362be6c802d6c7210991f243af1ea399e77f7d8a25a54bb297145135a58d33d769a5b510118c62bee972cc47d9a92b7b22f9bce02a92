import { JSONValue, LanguageModelV2Prompt, LanguageModelV2FinishReason, SharedV2ProviderMetadata, LanguageModelV2 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';
import { ZodType } from 'zod/v4';

type OpenAICompatibleChatPrompt = Array<OpenAICompatibleMessage>;
type OpenAICompatibleMessage = OpenAICompatibleSystemMessage | OpenAICompatibleUserMessage | OpenAICompatibleAssistantMessage | OpenAICompatibleToolMessage;
type JsonRecord<T = never> = Record<string, JSONValue | JSONValue[] | T | T[] | undefined>;
interface OpenAICompatibleSystemMessage extends JsonRecord {
    role: 'system';
    content: string;
}
interface OpenAICompatibleUserMessage extends JsonRecord<OpenAICompatibleContentPart> {
    role: 'user';
    content: string | Array<OpenAICompatibleContentPart>;
}
type OpenAICompatibleContentPart = OpenAICompatibleContentPartText | OpenAICompatibleContentPartImage;
interface OpenAICompatibleContentPartImage extends JsonRecord {
    type: 'image_url';
    image_url: {
        url: string;
    };
}
interface OpenAICompatibleContentPartText extends JsonRecord {
    type: 'text';
    text: string;
}
interface OpenAICompatibleAssistantMessage extends JsonRecord<OpenAICompatibleMessageToolCall> {
    role: 'assistant';
    content?: string | null;
    tool_calls?: Array<OpenAICompatibleMessageToolCall>;
}
interface OpenAICompatibleMessageToolCall extends JsonRecord {
    type: 'function';
    id: string;
    function: {
        arguments: string;
        name: string;
    };
}
interface OpenAICompatibleToolMessage extends JsonRecord {
    role: 'tool';
    content: string;
    tool_call_id: string;
}

declare function convertToOpenAICompatibleChatMessages(prompt: LanguageModelV2Prompt): OpenAICompatibleChatPrompt;

declare function mapOpenAICompatibleFinishReason(finishReason: string | null | undefined): LanguageModelV2FinishReason;

declare function getResponseMetadata({ id, model, created, }: {
    id?: string | undefined | null;
    created?: number | undefined | null;
    model?: string | undefined | null;
}): {
    id: string | undefined;
    modelId: string | undefined;
    timestamp: Date | undefined;
};

type ProviderErrorStructure<T> = {
    errorSchema: ZodType<T>;
    errorToMessage: (error: T) => string;
    isRetryable?: (response: Response, error?: T) => boolean;
};

/**
Extracts provider-specific metadata from API responses.
Used to standardize metadata handling across different LLM providers while allowing
provider-specific metadata to be captured.
*/
type MetadataExtractor = {
    /**
     * Extracts provider metadata from a complete, non-streaming response.
     *
     * @param parsedBody - The parsed response JSON body from the provider's API.
     *
     * @returns Provider-specific metadata or undefined if no metadata is available.
     *          The metadata should be under a key indicating the provider id.
     */
    extractMetadata: ({ parsedBody, }: {
        parsedBody: unknown;
    }) => Promise<SharedV2ProviderMetadata | undefined>;
    /**
     * Creates an extractor for handling streaming responses. The returned object provides
     * methods to process individual chunks and build the final metadata from the accumulated
     * stream data.
     *
     * @returns An object with methods to process chunks and build metadata from a stream
     */
    createStreamExtractor: () => {
        /**
         * Process an individual chunk from the stream. Called for each chunk in the response stream
         * to accumulate metadata throughout the streaming process.
         *
         * @param parsedChunk - The parsed JSON response chunk from the provider's API
         */
        processChunk(parsedChunk: unknown): void;
        /**
         * Builds the metadata object after all chunks have been processed.
         * Called at the end of the stream to generate the complete provider metadata.
         *
         * @returns Provider-specific metadata or undefined if no metadata is available.
         *          The metadata should be under a key indicating the provider id.
         */
        buildMetadata(): SharedV2ProviderMetadata | undefined;
    };
};

type OpenAICompatibleChatConfig = {
    provider: string;
    headers: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: FetchFunction;
    includeUsage?: boolean;
    errorStructure?: ProviderErrorStructure<any>;
    metadataExtractor?: MetadataExtractor;
    /**
     * Whether the model supports structured outputs.
     */
    supportsStructuredOutputs?: boolean;
    /**
     * The supported URLs for the model.
     */
    supportedUrls?: () => LanguageModelV2['supportedUrls'];
};

export { type OpenAICompatibleChatConfig, convertToOpenAICompatibleChatMessages, getResponseMetadata, mapOpenAICompatibleFinishReason };
