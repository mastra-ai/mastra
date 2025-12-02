import * as z from "zod/v4";
import { ResponseFormatJSONSchema, ResponseFormatJSONSchema$Outbound } from "./responseformatjsonschema.js";
import { ResponseFormatTextGrammar, ResponseFormatTextGrammar$Outbound } from "./responseformattextgrammar.js";
export type Prompt = string | Array<string> | Array<number> | Array<Array<number>>;
export type CompletionCreateParamsStop = string | Array<string>;
export type StreamOptions = {
    includeUsage?: boolean | null | undefined;
};
export type CompletionCreateParamsResponseFormatPython = {
    type: "python";
};
export type CompletionCreateParamsResponseFormatJSONObject = {
    type: "json_object";
};
export type CompletionCreateParamsResponseFormatText = {
    type: "text";
};
export type CompletionCreateParamsResponseFormatUnion = ResponseFormatJSONSchema | ResponseFormatTextGrammar | CompletionCreateParamsResponseFormatText | CompletionCreateParamsResponseFormatJSONObject | CompletionCreateParamsResponseFormatPython;
export type CompletionCreateParams = {
    model?: string | undefined;
    models?: Array<string> | undefined;
    prompt: string | Array<string> | Array<number> | Array<Array<number>>;
    bestOf?: number | null | undefined;
    echo?: boolean | null | undefined;
    frequencyPenalty?: number | null | undefined;
    logitBias?: {
        [k: string]: number;
    } | null | undefined;
    logprobs?: number | null | undefined;
    maxTokens?: number | null | undefined;
    n?: number | null | undefined;
    presencePenalty?: number | null | undefined;
    seed?: number | null | undefined;
    stop?: string | Array<string> | null | undefined;
    stream?: boolean | undefined;
    streamOptions?: StreamOptions | null | undefined;
    suffix?: string | null | undefined;
    temperature?: number | null | undefined;
    topP?: number | null | undefined;
    user?: string | undefined;
    metadata?: {
        [k: string]: string;
    } | null | undefined;
    responseFormat?: ResponseFormatJSONSchema | ResponseFormatTextGrammar | CompletionCreateParamsResponseFormatText | CompletionCreateParamsResponseFormatJSONObject | CompletionCreateParamsResponseFormatPython | null | undefined;
};
/** @internal */
export type Prompt$Outbound = string | Array<string> | Array<number> | Array<Array<number>>;
/** @internal */
export declare const Prompt$outboundSchema: z.ZodType<Prompt$Outbound, Prompt>;
export declare function promptToJSON(prompt: Prompt): string;
/** @internal */
export type CompletionCreateParamsStop$Outbound = string | Array<string>;
/** @internal */
export declare const CompletionCreateParamsStop$outboundSchema: z.ZodType<CompletionCreateParamsStop$Outbound, CompletionCreateParamsStop>;
export declare function completionCreateParamsStopToJSON(completionCreateParamsStop: CompletionCreateParamsStop): string;
/** @internal */
export type StreamOptions$Outbound = {
    include_usage?: boolean | null | undefined;
};
/** @internal */
export declare const StreamOptions$outboundSchema: z.ZodType<StreamOptions$Outbound, StreamOptions>;
export declare function streamOptionsToJSON(streamOptions: StreamOptions): string;
/** @internal */
export type CompletionCreateParamsResponseFormatPython$Outbound = {
    type: "python";
};
/** @internal */
export declare const CompletionCreateParamsResponseFormatPython$outboundSchema: z.ZodType<CompletionCreateParamsResponseFormatPython$Outbound, CompletionCreateParamsResponseFormatPython>;
export declare function completionCreateParamsResponseFormatPythonToJSON(completionCreateParamsResponseFormatPython: CompletionCreateParamsResponseFormatPython): string;
/** @internal */
export type CompletionCreateParamsResponseFormatJSONObject$Outbound = {
    type: "json_object";
};
/** @internal */
export declare const CompletionCreateParamsResponseFormatJSONObject$outboundSchema: z.ZodType<CompletionCreateParamsResponseFormatJSONObject$Outbound, CompletionCreateParamsResponseFormatJSONObject>;
export declare function completionCreateParamsResponseFormatJSONObjectToJSON(completionCreateParamsResponseFormatJSONObject: CompletionCreateParamsResponseFormatJSONObject): string;
/** @internal */
export type CompletionCreateParamsResponseFormatText$Outbound = {
    type: "text";
};
/** @internal */
export declare const CompletionCreateParamsResponseFormatText$outboundSchema: z.ZodType<CompletionCreateParamsResponseFormatText$Outbound, CompletionCreateParamsResponseFormatText>;
export declare function completionCreateParamsResponseFormatTextToJSON(completionCreateParamsResponseFormatText: CompletionCreateParamsResponseFormatText): string;
/** @internal */
export type CompletionCreateParamsResponseFormatUnion$Outbound = ResponseFormatJSONSchema$Outbound | ResponseFormatTextGrammar$Outbound | CompletionCreateParamsResponseFormatText$Outbound | CompletionCreateParamsResponseFormatJSONObject$Outbound | CompletionCreateParamsResponseFormatPython$Outbound;
/** @internal */
export declare const CompletionCreateParamsResponseFormatUnion$outboundSchema: z.ZodType<CompletionCreateParamsResponseFormatUnion$Outbound, CompletionCreateParamsResponseFormatUnion>;
export declare function completionCreateParamsResponseFormatUnionToJSON(completionCreateParamsResponseFormatUnion: CompletionCreateParamsResponseFormatUnion): string;
/** @internal */
export type CompletionCreateParams$Outbound = {
    model?: string | undefined;
    models?: Array<string> | undefined;
    prompt: string | Array<string> | Array<number> | Array<Array<number>>;
    best_of?: number | null | undefined;
    echo?: boolean | null | undefined;
    frequency_penalty?: number | null | undefined;
    logit_bias?: {
        [k: string]: number;
    } | null | undefined;
    logprobs?: number | null | undefined;
    max_tokens?: number | null | undefined;
    n?: number | null | undefined;
    presence_penalty?: number | null | undefined;
    seed?: number | null | undefined;
    stop?: string | Array<string> | null | undefined;
    stream: boolean;
    stream_options?: StreamOptions$Outbound | null | undefined;
    suffix?: string | null | undefined;
    temperature?: number | null | undefined;
    top_p?: number | null | undefined;
    user?: string | undefined;
    metadata?: {
        [k: string]: string;
    } | null | undefined;
    response_format?: ResponseFormatJSONSchema$Outbound | ResponseFormatTextGrammar$Outbound | CompletionCreateParamsResponseFormatText$Outbound | CompletionCreateParamsResponseFormatJSONObject$Outbound | CompletionCreateParamsResponseFormatPython$Outbound | null | undefined;
};
/** @internal */
export declare const CompletionCreateParams$outboundSchema: z.ZodType<CompletionCreateParams$Outbound, CompletionCreateParams>;
export declare function completionCreateParamsToJSON(completionCreateParams: CompletionCreateParams): string;
//# sourceMappingURL=completioncreateparams.d.ts.map