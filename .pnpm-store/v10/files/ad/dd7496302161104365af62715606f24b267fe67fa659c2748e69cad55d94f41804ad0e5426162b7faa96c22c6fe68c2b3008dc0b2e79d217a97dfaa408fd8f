import * as z from "zod/v4";
import { ClosedEnum, OpenEnum } from "../types/enums.js";
import { DataCollection } from "./datacollection.js";
import { OpenAIResponsesIncludable } from "./openairesponsesincludable.js";
import { OpenAIResponsesPrompt, OpenAIResponsesPrompt$Outbound } from "./openairesponsesprompt.js";
import { OpenAIResponsesToolChoiceUnion, OpenAIResponsesToolChoiceUnion$Outbound } from "./openairesponsestoolchoiceunion.js";
import { OpenResponsesInput, OpenResponsesInput$Outbound } from "./openresponsesinput.js";
import { OpenResponsesReasoningConfig, OpenResponsesReasoningConfig$Outbound } from "./openresponsesreasoningconfig.js";
import { OpenResponsesResponseText, OpenResponsesResponseText$Outbound } from "./openresponsesresponsetext.js";
import { OpenResponsesWebSearch20250826Tool, OpenResponsesWebSearch20250826Tool$Outbound } from "./openresponseswebsearch20250826tool.js";
import { OpenResponsesWebSearchPreview20250311Tool, OpenResponsesWebSearchPreview20250311Tool$Outbound } from "./openresponseswebsearchpreview20250311tool.js";
import { OpenResponsesWebSearchPreviewTool, OpenResponsesWebSearchPreviewTool$Outbound } from "./openresponseswebsearchpreviewtool.js";
import { OpenResponsesWebSearchTool, OpenResponsesWebSearchTool$Outbound } from "./openresponseswebsearchtool.js";
import { ProviderName } from "./providername.js";
import { ProviderSort } from "./providersort.js";
import { Quantization } from "./quantization.js";
export declare const OpenResponsesRequestType: {
    readonly Function: "function";
};
export type OpenResponsesRequestType = ClosedEnum<typeof OpenResponsesRequestType>;
/**
 * Function tool definition
 */
export type OpenResponsesRequestToolFunction = {
    type: OpenResponsesRequestType;
    name: string;
    description?: string | null | undefined;
    strict?: boolean | null | undefined;
    parameters: {
        [k: string]: any | null;
    } | null;
};
export type OpenResponsesRequestToolUnion = OpenResponsesRequestToolFunction | OpenResponsesWebSearchPreviewTool | OpenResponsesWebSearchPreview20250311Tool | OpenResponsesWebSearchTool | OpenResponsesWebSearch20250826Tool;
export declare const ServiceTier: {
    readonly Auto: "auto";
    readonly Default: "default";
    readonly Flex: "flex";
    readonly Priority: "priority";
    readonly Scale: "scale";
};
export type ServiceTier = OpenEnum<typeof ServiceTier>;
export declare const Truncation: {
    readonly Auto: "auto";
    readonly Disabled: "disabled";
};
export type Truncation = OpenEnum<typeof Truncation>;
export type Order = ProviderName | string;
export type Only = ProviderName | string;
export type Ignore = ProviderName | string;
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
/**
 * When multiple model providers are available, optionally indicate your routing preference.
 */
export type Provider = {
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
    dataCollection?: DataCollection | null | undefined;
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
    order?: Array<ProviderName | string> | null | undefined;
    /**
     * List of provider slugs to allow. If provided, this list is merged with your account-wide allowed provider settings for this request.
     */
    only?: Array<ProviderName | string> | null | undefined;
    /**
     * List of provider slugs to ignore. If provided, this list is merged with your account-wide ignored provider settings for this request.
     */
    ignore?: Array<ProviderName | string> | null | undefined;
    /**
     * A list of quantization levels to filter the provider by.
     */
    quantizations?: Array<Quantization> | null | undefined;
    /**
     * The sorting strategy to use for this request, if "order" is not specified. When set, no load balancing is performed.
     */
    sort?: ProviderSort | null | undefined;
    /**
     * The object specifying the maximum price you want to pay for this request. USD price per million tokens, for prompt and completion.
     */
    maxPrice?: MaxPrice | undefined;
};
export declare const IdFileParser: {
    readonly FileParser: "file-parser";
};
export type IdFileParser = ClosedEnum<typeof IdFileParser>;
export declare const PdfEngine: {
    readonly MistralOcr: "mistral-ocr";
    readonly PdfText: "pdf-text";
    readonly Native: "native";
};
export type PdfEngine = OpenEnum<typeof PdfEngine>;
export type Pdf = {
    engine?: PdfEngine | undefined;
};
export type PluginFileParser = {
    id: IdFileParser;
    maxFiles?: number | undefined;
    pdf?: Pdf | undefined;
};
export declare const IdWeb: {
    readonly Web: "web";
};
export type IdWeb = ClosedEnum<typeof IdWeb>;
export declare const Engine: {
    readonly Native: "native";
    readonly Exa: "exa";
};
export type Engine = OpenEnum<typeof Engine>;
export type PluginWeb = {
    id: IdWeb;
    maxResults?: number | undefined;
    searchPrompt?: string | undefined;
    engine?: Engine | undefined;
};
export declare const IdModeration: {
    readonly Moderation: "moderation";
};
export type IdModeration = ClosedEnum<typeof IdModeration>;
export type PluginModeration = {
    id: IdModeration;
};
export type Plugin = PluginModeration | PluginWeb | PluginFileParser;
/**
 * Request schema for Responses endpoint
 */
export type OpenResponsesRequest = {
    /**
     * Input for a response request - can be a string or array of items
     */
    input?: OpenResponsesInput | undefined;
    instructions?: string | null | undefined;
    /**
     * Metadata key-value pairs for the request. Keys must be ≤64 characters and cannot contain brackets. Values must be ≤512 characters. Maximum 16 pairs allowed.
     */
    metadata?: {
        [k: string]: string;
    } | null | undefined;
    tools?: Array<OpenResponsesRequestToolFunction | OpenResponsesWebSearchPreviewTool | OpenResponsesWebSearchPreview20250311Tool | OpenResponsesWebSearchTool | OpenResponsesWebSearch20250826Tool> | undefined;
    toolChoice?: OpenAIResponsesToolChoiceUnion | undefined;
    parallelToolCalls?: boolean | null | undefined;
    model?: string | undefined;
    models?: Array<string> | undefined;
    /**
     * Text output configuration including format and verbosity
     */
    text?: OpenResponsesResponseText | undefined;
    /**
     * Configuration for reasoning mode in the response
     */
    reasoning?: OpenResponsesReasoningConfig | null | undefined;
    maxOutputTokens?: number | null | undefined;
    temperature?: number | null | undefined;
    topP?: number | null | undefined;
    topK?: number | undefined;
    promptCacheKey?: string | null | undefined;
    previousResponseId?: string | null | undefined;
    prompt?: OpenAIResponsesPrompt | null | undefined;
    include?: Array<OpenAIResponsesIncludable> | null | undefined;
    background?: boolean | null | undefined;
    safetyIdentifier?: string | null | undefined;
    store?: boolean | null | undefined;
    serviceTier?: ServiceTier | null | undefined;
    truncation?: Truncation | null | undefined;
    stream?: boolean | undefined;
    /**
     * When multiple model providers are available, optionally indicate your routing preference.
     */
    provider?: Provider | null | undefined;
    /**
     * Plugins you want to enable for this request, including their settings.
     */
    plugins?: Array<PluginModeration | PluginWeb | PluginFileParser> | undefined;
    /**
     * A unique identifier representing your end-user, which helps distinguish between different users of your app. This allows your app to identify specific users in case of abuse reports, preventing your entire app from being affected by the actions of individual users. Maximum of 128 characters.
     */
    user?: string | undefined;
};
/** @internal */
export declare const OpenResponsesRequestType$outboundSchema: z.ZodEnum<typeof OpenResponsesRequestType>;
/** @internal */
export type OpenResponsesRequestToolFunction$Outbound = {
    type: string;
    name: string;
    description?: string | null | undefined;
    strict?: boolean | null | undefined;
    parameters: {
        [k: string]: any | null;
    } | null;
};
/** @internal */
export declare const OpenResponsesRequestToolFunction$outboundSchema: z.ZodType<OpenResponsesRequestToolFunction$Outbound, OpenResponsesRequestToolFunction>;
export declare function openResponsesRequestToolFunctionToJSON(openResponsesRequestToolFunction: OpenResponsesRequestToolFunction): string;
/** @internal */
export type OpenResponsesRequestToolUnion$Outbound = OpenResponsesRequestToolFunction$Outbound | OpenResponsesWebSearchPreviewTool$Outbound | OpenResponsesWebSearchPreview20250311Tool$Outbound | OpenResponsesWebSearchTool$Outbound | OpenResponsesWebSearch20250826Tool$Outbound;
/** @internal */
export declare const OpenResponsesRequestToolUnion$outboundSchema: z.ZodType<OpenResponsesRequestToolUnion$Outbound, OpenResponsesRequestToolUnion>;
export declare function openResponsesRequestToolUnionToJSON(openResponsesRequestToolUnion: OpenResponsesRequestToolUnion): string;
/** @internal */
export declare const ServiceTier$outboundSchema: z.ZodType<string, ServiceTier>;
/** @internal */
export declare const Truncation$outboundSchema: z.ZodType<string, Truncation>;
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
export type Provider$Outbound = {
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
export declare const Provider$outboundSchema: z.ZodType<Provider$Outbound, Provider>;
export declare function providerToJSON(provider: Provider): string;
/** @internal */
export declare const IdFileParser$outboundSchema: z.ZodEnum<typeof IdFileParser>;
/** @internal */
export declare const PdfEngine$outboundSchema: z.ZodType<string, PdfEngine>;
/** @internal */
export type Pdf$Outbound = {
    engine?: string | undefined;
};
/** @internal */
export declare const Pdf$outboundSchema: z.ZodType<Pdf$Outbound, Pdf>;
export declare function pdfToJSON(pdf: Pdf): string;
/** @internal */
export type PluginFileParser$Outbound = {
    id: string;
    max_files?: number | undefined;
    pdf?: Pdf$Outbound | undefined;
};
/** @internal */
export declare const PluginFileParser$outboundSchema: z.ZodType<PluginFileParser$Outbound, PluginFileParser>;
export declare function pluginFileParserToJSON(pluginFileParser: PluginFileParser): string;
/** @internal */
export declare const IdWeb$outboundSchema: z.ZodEnum<typeof IdWeb>;
/** @internal */
export declare const Engine$outboundSchema: z.ZodType<string, Engine>;
/** @internal */
export type PluginWeb$Outbound = {
    id: string;
    max_results?: number | undefined;
    search_prompt?: string | undefined;
    engine?: string | undefined;
};
/** @internal */
export declare const PluginWeb$outboundSchema: z.ZodType<PluginWeb$Outbound, PluginWeb>;
export declare function pluginWebToJSON(pluginWeb: PluginWeb): string;
/** @internal */
export declare const IdModeration$outboundSchema: z.ZodEnum<typeof IdModeration>;
/** @internal */
export type PluginModeration$Outbound = {
    id: string;
};
/** @internal */
export declare const PluginModeration$outboundSchema: z.ZodType<PluginModeration$Outbound, PluginModeration>;
export declare function pluginModerationToJSON(pluginModeration: PluginModeration): string;
/** @internal */
export type Plugin$Outbound = PluginModeration$Outbound | PluginWeb$Outbound | PluginFileParser$Outbound;
/** @internal */
export declare const Plugin$outboundSchema: z.ZodType<Plugin$Outbound, Plugin>;
export declare function pluginToJSON(plugin: Plugin): string;
/** @internal */
export type OpenResponsesRequest$Outbound = {
    input?: OpenResponsesInput$Outbound | undefined;
    instructions?: string | null | undefined;
    metadata?: {
        [k: string]: string;
    } | null | undefined;
    tools?: Array<OpenResponsesRequestToolFunction$Outbound | OpenResponsesWebSearchPreviewTool$Outbound | OpenResponsesWebSearchPreview20250311Tool$Outbound | OpenResponsesWebSearchTool$Outbound | OpenResponsesWebSearch20250826Tool$Outbound> | undefined;
    tool_choice?: OpenAIResponsesToolChoiceUnion$Outbound | undefined;
    parallel_tool_calls?: boolean | null | undefined;
    model?: string | undefined;
    models?: Array<string> | undefined;
    text?: OpenResponsesResponseText$Outbound | undefined;
    reasoning?: OpenResponsesReasoningConfig$Outbound | null | undefined;
    max_output_tokens?: number | null | undefined;
    temperature?: number | null | undefined;
    top_p?: number | null | undefined;
    top_k?: number | undefined;
    prompt_cache_key?: string | null | undefined;
    previous_response_id?: string | null | undefined;
    prompt?: OpenAIResponsesPrompt$Outbound | null | undefined;
    include?: Array<string> | null | undefined;
    background?: boolean | null | undefined;
    safety_identifier?: string | null | undefined;
    store?: boolean | null | undefined;
    service_tier?: string | null | undefined;
    truncation?: string | null | undefined;
    stream: boolean;
    provider?: Provider$Outbound | null | undefined;
    plugins?: Array<PluginModeration$Outbound | PluginWeb$Outbound | PluginFileParser$Outbound> | undefined;
    user?: string | undefined;
};
/** @internal */
export declare const OpenResponsesRequest$outboundSchema: z.ZodType<OpenResponsesRequest$Outbound, OpenResponsesRequest>;
export declare function openResponsesRequestToJSON(openResponsesRequest: OpenResponsesRequest): string;
//# sourceMappingURL=openresponsesrequest.d.ts.map