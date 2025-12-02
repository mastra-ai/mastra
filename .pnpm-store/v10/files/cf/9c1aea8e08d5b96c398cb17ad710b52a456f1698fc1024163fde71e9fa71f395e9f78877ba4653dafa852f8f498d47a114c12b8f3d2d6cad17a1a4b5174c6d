import * as z from "zod/v4";
import { OpenEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
export type GetGenerationRequest = {
    id: string;
};
/**
 * Type of API used for the generation
 */
export declare const ApiType: {
    readonly Completions: "completions";
    readonly Embeddings: "embeddings";
};
/**
 * Type of API used for the generation
 */
export type ApiType = OpenEnum<typeof ApiType>;
/**
 * Generation data
 */
export type GetGenerationData = {
    /**
     * Unique identifier for the generation
     */
    id: string;
    /**
     * Upstream provider's identifier for this generation
     */
    upstreamId: string | null;
    /**
     * Total cost of the generation in USD
     */
    totalCost: number;
    /**
     * Discount applied due to caching
     */
    cacheDiscount: number | null;
    /**
     * Cost charged by the upstream provider
     */
    upstreamInferenceCost: number | null;
    /**
     * ISO 8601 timestamp of when the generation was created
     */
    createdAt: string;
    /**
     * Model used for the generation
     */
    model: string;
    /**
     * ID of the app that made the request
     */
    appId: number | null;
    /**
     * Whether the response was streamed
     */
    streamed: boolean | null;
    /**
     * Whether the generation was cancelled
     */
    cancelled: boolean | null;
    /**
     * Name of the provider that served the request
     */
    providerName: string | null;
    /**
     * Total latency in milliseconds
     */
    latency: number | null;
    /**
     * Moderation latency in milliseconds
     */
    moderationLatency: number | null;
    /**
     * Time taken for generation in milliseconds
     */
    generationTime: number | null;
    /**
     * Reason the generation finished
     */
    finishReason: string | null;
    /**
     * Number of tokens in the prompt
     */
    tokensPrompt: number | null;
    /**
     * Number of tokens in the completion
     */
    tokensCompletion: number | null;
    /**
     * Native prompt tokens as reported by provider
     */
    nativeTokensPrompt: number | null;
    /**
     * Native completion tokens as reported by provider
     */
    nativeTokensCompletion: number | null;
    /**
     * Native completion image tokens as reported by provider
     */
    nativeTokensCompletionImages: number | null;
    /**
     * Native reasoning tokens as reported by provider
     */
    nativeTokensReasoning: number | null;
    /**
     * Native cached tokens as reported by provider
     */
    nativeTokensCached: number | null;
    /**
     * Number of media items in the prompt
     */
    numMediaPrompt: number | null;
    /**
     * Number of audio inputs in the prompt
     */
    numInputAudioPrompt: number | null;
    /**
     * Number of media items in the completion
     */
    numMediaCompletion: number | null;
    /**
     * Number of search results included
     */
    numSearchResults: number | null;
    /**
     * Origin URL of the request
     */
    origin: string;
    /**
     * Usage amount in USD
     */
    usage: number;
    /**
     * Whether this used bring-your-own-key
     */
    isByok: boolean;
    /**
     * Native finish reason as reported by provider
     */
    nativeFinishReason: string | null;
    /**
     * External user identifier
     */
    externalUser: string | null;
    /**
     * Type of API used for the generation
     */
    apiType: ApiType | null;
};
/**
 * Generation response
 */
export type GetGenerationResponse = {
    /**
     * Generation data
     */
    data: GetGenerationData;
};
/** @internal */
export type GetGenerationRequest$Outbound = {
    id: string;
};
/** @internal */
export declare const GetGenerationRequest$outboundSchema: z.ZodType<GetGenerationRequest$Outbound, GetGenerationRequest>;
export declare function getGenerationRequestToJSON(getGenerationRequest: GetGenerationRequest): string;
/** @internal */
export declare const ApiType$inboundSchema: z.ZodType<ApiType, unknown>;
/** @internal */
export declare const GetGenerationData$inboundSchema: z.ZodType<GetGenerationData, unknown>;
export declare function getGenerationDataFromJSON(jsonString: string): SafeParseResult<GetGenerationData, SDKValidationError>;
/** @internal */
export declare const GetGenerationResponse$inboundSchema: z.ZodType<GetGenerationResponse, unknown>;
export declare function getGenerationResponseFromJSON(jsonString: string): SafeParseResult<GetGenerationResponse, SDKValidationError>;
//# sourceMappingURL=getgeneration.d.ts.map