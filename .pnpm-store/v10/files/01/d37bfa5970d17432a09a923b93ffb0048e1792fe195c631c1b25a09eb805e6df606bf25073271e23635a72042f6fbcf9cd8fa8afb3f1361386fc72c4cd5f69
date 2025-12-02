import * as z from "zod/v4";
import { ClosedEnum, OpenEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
import * as models from "../index.js";
export declare const TypeImageURL: {
    readonly ImageUrl: "image_url";
};
export type TypeImageURL = ClosedEnum<typeof TypeImageURL>;
export type ImageUrl = {
    url: string;
};
export type ContentImageURL = {
    type: TypeImageURL;
    imageUrl: ImageUrl;
};
export declare const TypeText: {
    readonly Text: "text";
};
export type TypeText = ClosedEnum<typeof TypeText>;
export type ContentText = {
    type: TypeText;
    text: string;
};
export type Content = ContentText | ContentImageURL;
export type Input = {
    content: Array<ContentText | ContentImageURL>;
};
export type InputUnion = string | Array<string> | Array<number> | Array<Array<number>> | Array<Input>;
export declare const EncodingFormat: {
    readonly Float: "float";
    readonly Base64: "base64";
};
export type EncodingFormat = OpenEnum<typeof EncodingFormat>;
export type Order = models.ProviderName | string;
export type Only = models.ProviderName | string;
export type Ignore = models.ProviderName | string;
/**
 * The object specifying the maximum price you want to pay for this request. USD price per million tokens, for prompt and completion.
 */
export type MaxPrice = {
    /**
     * A value in string or number format that is a large number
     */
    prompt?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    completion?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    image?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    audio?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    request?: any | undefined;
};
export type CreateEmbeddingsProvider = {
    /**
     * Whether to allow backup providers to serve requests
     *
     * @remarks
     * - true: (default) when the primary provider (or your custom providers in "order") is unavailable, use the next best provider.
     * - false: use only the primary/custom provider, and return the upstream error if it's unavailable.
     */
    allowFallbacks?: boolean | null | undefined;
    /**
     * Whether to filter providers to only those that support the parameters you've provided. If this setting is omitted or set to false, then providers will receive only the parameters they support, and ignore the rest.
     */
    requireParameters?: boolean | null | undefined;
    /**
     * Data collection setting. If no available model provider meets the requirement, your request will return an error.
     *
     * @remarks
     * - allow: (default) allow providers which store user data non-transiently and may train on it
     *
     * - deny: use only providers which do not collect user data.
     */
    dataCollection?: models.DataCollection | null | undefined;
    /**
     * Whether to restrict routing to only ZDR (Zero Data Retention) endpoints. When true, only endpoints that do not retain prompts will be used.
     */
    zdr?: boolean | null | undefined;
    /**
     * Whether to restrict routing to only models that allow text distillation. When true, only models where the author has allowed distillation will be used.
     */
    enforceDistillableText?: boolean | null | undefined;
    /**
     * An ordered list of provider slugs. The router will attempt to use the first provider in the subset of this list that supports your requested model, and fall back to the next if it is unavailable. If no providers are available, the request will fail with an error message.
     */
    order?: Array<models.ProviderName | string> | null | undefined;
    /**
     * List of provider slugs to allow. If provided, this list is merged with your account-wide allowed provider settings for this request.
     */
    only?: Array<models.ProviderName | string> | null | undefined;
    /**
     * List of provider slugs to ignore. If provided, this list is merged with your account-wide ignored provider settings for this request.
     */
    ignore?: Array<models.ProviderName | string> | null | undefined;
    /**
     * A list of quantization levels to filter the provider by.
     */
    quantizations?: Array<models.Quantization> | null | undefined;
    /**
     * The sorting strategy to use for this request, if "order" is not specified. When set, no load balancing is performed.
     */
    sort?: models.ProviderSort | null | undefined;
    /**
     * The object specifying the maximum price you want to pay for this request. USD price per million tokens, for prompt and completion.
     */
    maxPrice?: MaxPrice | undefined;
};
export type CreateEmbeddingsRequest = {
    input: string | Array<string> | Array<number> | Array<Array<number>> | Array<Input>;
    model: string;
    encodingFormat?: EncodingFormat | undefined;
    dimensions?: number | undefined;
    user?: string | undefined;
    provider?: CreateEmbeddingsProvider | undefined;
    inputType?: string | undefined;
};
export declare const ObjectT: {
    readonly List: "list";
};
export type ObjectT = ClosedEnum<typeof ObjectT>;
export declare const ObjectEmbedding: {
    readonly Embedding: "embedding";
};
export type ObjectEmbedding = ClosedEnum<typeof ObjectEmbedding>;
export type Embedding = Array<number> | string;
export type CreateEmbeddingsData = {
    object: ObjectEmbedding;
    embedding: Array<number> | string;
    index?: number | undefined;
};
export type Usage = {
    promptTokens: number;
    totalTokens: number;
    cost?: number | undefined;
};
/**
 * Embedding response
 */
export type CreateEmbeddingsResponseBody = {
    id?: string | undefined;
    object: ObjectT;
    data: Array<CreateEmbeddingsData>;
    model: string;
    usage?: Usage | undefined;
};
export type CreateEmbeddingsResponse = CreateEmbeddingsResponseBody | string;
/** @internal */
export declare const TypeImageURL$outboundSchema: z.ZodEnum<typeof TypeImageURL>;
/** @internal */
export type ImageUrl$Outbound = {
    url: string;
};
/** @internal */
export declare const ImageUrl$outboundSchema: z.ZodType<ImageUrl$Outbound, ImageUrl>;
export declare function imageUrlToJSON(imageUrl: ImageUrl): string;
/** @internal */
export type ContentImageURL$Outbound = {
    type: string;
    image_url: ImageUrl$Outbound;
};
/** @internal */
export declare const ContentImageURL$outboundSchema: z.ZodType<ContentImageURL$Outbound, ContentImageURL>;
export declare function contentImageURLToJSON(contentImageURL: ContentImageURL): string;
/** @internal */
export declare const TypeText$outboundSchema: z.ZodEnum<typeof TypeText>;
/** @internal */
export type ContentText$Outbound = {
    type: string;
    text: string;
};
/** @internal */
export declare const ContentText$outboundSchema: z.ZodType<ContentText$Outbound, ContentText>;
export declare function contentTextToJSON(contentText: ContentText): string;
/** @internal */
export type Content$Outbound = ContentText$Outbound | ContentImageURL$Outbound;
/** @internal */
export declare const Content$outboundSchema: z.ZodType<Content$Outbound, Content>;
export declare function contentToJSON(content: Content): string;
/** @internal */
export type Input$Outbound = {
    content: Array<ContentText$Outbound | ContentImageURL$Outbound>;
};
/** @internal */
export declare const Input$outboundSchema: z.ZodType<Input$Outbound, Input>;
export declare function inputToJSON(input: Input): string;
/** @internal */
export type InputUnion$Outbound = string | Array<string> | Array<number> | Array<Array<number>> | Array<Input$Outbound>;
/** @internal */
export declare const InputUnion$outboundSchema: z.ZodType<InputUnion$Outbound, InputUnion>;
export declare function inputUnionToJSON(inputUnion: InputUnion): string;
/** @internal */
export declare const EncodingFormat$outboundSchema: z.ZodType<string, EncodingFormat>;
/** @internal */
export type Order$Outbound = string | string;
/** @internal */
export declare const Order$outboundSchema: z.ZodType<Order$Outbound, Order>;
export declare function orderToJSON(order: Order): string;
/** @internal */
export type Only$Outbound = string | string;
/** @internal */
export declare const Only$outboundSchema: z.ZodType<Only$Outbound, Only>;
export declare function onlyToJSON(only: Only): string;
/** @internal */
export type Ignore$Outbound = string | string;
/** @internal */
export declare const Ignore$outboundSchema: z.ZodType<Ignore$Outbound, Ignore>;
export declare function ignoreToJSON(ignore: Ignore): string;
/** @internal */
export type MaxPrice$Outbound = {
    prompt?: any | undefined;
    completion?: any | undefined;
    image?: any | undefined;
    audio?: any | undefined;
    request?: any | undefined;
};
/** @internal */
export declare const MaxPrice$outboundSchema: z.ZodType<MaxPrice$Outbound, MaxPrice>;
export declare function maxPriceToJSON(maxPrice: MaxPrice): string;
/** @internal */
export type CreateEmbeddingsProvider$Outbound = {
    allow_fallbacks?: boolean | null | undefined;
    require_parameters?: boolean | null | undefined;
    data_collection?: string | null | undefined;
    zdr?: boolean | null | undefined;
    enforce_distillable_text?: boolean | null | undefined;
    order?: Array<string | string> | null | undefined;
    only?: Array<string | string> | null | undefined;
    ignore?: Array<string | string> | null | undefined;
    quantizations?: Array<string> | null | undefined;
    sort?: string | null | undefined;
    max_price?: MaxPrice$Outbound | undefined;
};
/** @internal */
export declare const CreateEmbeddingsProvider$outboundSchema: z.ZodType<CreateEmbeddingsProvider$Outbound, CreateEmbeddingsProvider>;
export declare function createEmbeddingsProviderToJSON(createEmbeddingsProvider: CreateEmbeddingsProvider): string;
/** @internal */
export type CreateEmbeddingsRequest$Outbound = {
    input: string | Array<string> | Array<number> | Array<Array<number>> | Array<Input$Outbound>;
    model: string;
    encoding_format?: string | undefined;
    dimensions?: number | undefined;
    user?: string | undefined;
    provider?: CreateEmbeddingsProvider$Outbound | undefined;
    input_type?: string | undefined;
};
/** @internal */
export declare const CreateEmbeddingsRequest$outboundSchema: z.ZodType<CreateEmbeddingsRequest$Outbound, CreateEmbeddingsRequest>;
export declare function createEmbeddingsRequestToJSON(createEmbeddingsRequest: CreateEmbeddingsRequest): string;
/** @internal */
export declare const ObjectT$inboundSchema: z.ZodEnum<typeof ObjectT>;
/** @internal */
export declare const ObjectEmbedding$inboundSchema: z.ZodEnum<typeof ObjectEmbedding>;
/** @internal */
export declare const Embedding$inboundSchema: z.ZodType<Embedding, unknown>;
export declare function embeddingFromJSON(jsonString: string): SafeParseResult<Embedding, SDKValidationError>;
/** @internal */
export declare const CreateEmbeddingsData$inboundSchema: z.ZodType<CreateEmbeddingsData, unknown>;
export declare function createEmbeddingsDataFromJSON(jsonString: string): SafeParseResult<CreateEmbeddingsData, SDKValidationError>;
/** @internal */
export declare const Usage$inboundSchema: z.ZodType<Usage, unknown>;
export declare function usageFromJSON(jsonString: string): SafeParseResult<Usage, SDKValidationError>;
/** @internal */
export declare const CreateEmbeddingsResponseBody$inboundSchema: z.ZodType<CreateEmbeddingsResponseBody, unknown>;
export declare function createEmbeddingsResponseBodyFromJSON(jsonString: string): SafeParseResult<CreateEmbeddingsResponseBody, SDKValidationError>;
/** @internal */
export declare const CreateEmbeddingsResponse$inboundSchema: z.ZodType<CreateEmbeddingsResponse, unknown>;
export declare function createEmbeddingsResponseFromJSON(jsonString: string): SafeParseResult<CreateEmbeddingsResponse, SDKValidationError>;
//# sourceMappingURL=createembeddings.d.ts.map