import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { ChatStreamOptions, ChatStreamOptions$Outbound } from "./chatstreamoptions.js";
import { Message, Message$Outbound } from "./message.js";
import { ReasoningSummaryVerbosity } from "./reasoningsummaryverbosity.js";
import { ResponseFormatJSONSchema, ResponseFormatJSONSchema$Outbound } from "./responseformatjsonschema.js";
import { ResponseFormatTextGrammar, ResponseFormatTextGrammar$Outbound } from "./responseformattextgrammar.js";
import { ToolDefinitionJson, ToolDefinitionJson$Outbound } from "./tooldefinitionjson.js";
export declare const Effort: {
    readonly None: "none";
    readonly Minimal: "minimal";
    readonly Low: "low";
    readonly Medium: "medium";
    readonly High: "high";
};
export type Effort = OpenEnum<typeof Effort>;
export type Reasoning = {
    effort?: Effort | null | undefined;
    summary?: ReasoningSummaryVerbosity | null | undefined;
};
export type ChatGenerationParamsResponseFormatPython = {
    type: "python";
};
export type ChatGenerationParamsResponseFormatJSONObject = {
    type: "json_object";
};
export type ChatGenerationParamsResponseFormatText = {
    type: "text";
};
export type ChatGenerationParamsResponseFormatUnion = ResponseFormatJSONSchema | ResponseFormatTextGrammar | ChatGenerationParamsResponseFormatText | ChatGenerationParamsResponseFormatJSONObject | ChatGenerationParamsResponseFormatPython;
export type ChatGenerationParamsStop = string | Array<string>;
export type ChatGenerationParams = {
    messages: Array<Message>;
    model?: string | undefined;
    models?: Array<string> | undefined;
    frequencyPenalty?: number | null | undefined;
    logitBias?: {
        [k: string]: number;
    } | null | undefined;
    logprobs?: boolean | null | undefined;
    topLogprobs?: number | null | undefined;
    maxCompletionTokens?: number | null | undefined;
    maxTokens?: number | null | undefined;
    metadata?: {
        [k: string]: string;
    } | undefined;
    presencePenalty?: number | null | undefined;
    reasoning?: Reasoning | undefined;
    responseFormat?: ResponseFormatJSONSchema | ResponseFormatTextGrammar | ChatGenerationParamsResponseFormatText | ChatGenerationParamsResponseFormatJSONObject | ChatGenerationParamsResponseFormatPython | undefined;
    seed?: number | null | undefined;
    stop?: string | Array<string> | null | undefined;
    stream?: boolean | undefined;
    streamOptions?: ChatStreamOptions | null | undefined;
    temperature?: number | null | undefined;
    toolChoice?: any | undefined;
    tools?: Array<ToolDefinitionJson> | undefined;
    topP?: number | null | undefined;
    user?: string | undefined;
};
/** @internal */
export declare const Effort$outboundSchema: z.ZodType<string, Effort>;
/** @internal */
export type Reasoning$Outbound = {
    effort?: string | null | undefined;
    summary?: string | null | undefined;
};
/** @internal */
export declare const Reasoning$outboundSchema: z.ZodType<Reasoning$Outbound, Reasoning>;
export declare function reasoningToJSON(reasoning: Reasoning): string;
/** @internal */
export type ChatGenerationParamsResponseFormatPython$Outbound = {
    type: "python";
};
/** @internal */
export declare const ChatGenerationParamsResponseFormatPython$outboundSchema: z.ZodType<ChatGenerationParamsResponseFormatPython$Outbound, ChatGenerationParamsResponseFormatPython>;
export declare function chatGenerationParamsResponseFormatPythonToJSON(chatGenerationParamsResponseFormatPython: ChatGenerationParamsResponseFormatPython): string;
/** @internal */
export type ChatGenerationParamsResponseFormatJSONObject$Outbound = {
    type: "json_object";
};
/** @internal */
export declare const ChatGenerationParamsResponseFormatJSONObject$outboundSchema: z.ZodType<ChatGenerationParamsResponseFormatJSONObject$Outbound, ChatGenerationParamsResponseFormatJSONObject>;
export declare function chatGenerationParamsResponseFormatJSONObjectToJSON(chatGenerationParamsResponseFormatJSONObject: ChatGenerationParamsResponseFormatJSONObject): string;
/** @internal */
export type ChatGenerationParamsResponseFormatText$Outbound = {
    type: "text";
};
/** @internal */
export declare const ChatGenerationParamsResponseFormatText$outboundSchema: z.ZodType<ChatGenerationParamsResponseFormatText$Outbound, ChatGenerationParamsResponseFormatText>;
export declare function chatGenerationParamsResponseFormatTextToJSON(chatGenerationParamsResponseFormatText: ChatGenerationParamsResponseFormatText): string;
/** @internal */
export type ChatGenerationParamsResponseFormatUnion$Outbound = ResponseFormatJSONSchema$Outbound | ResponseFormatTextGrammar$Outbound | ChatGenerationParamsResponseFormatText$Outbound | ChatGenerationParamsResponseFormatJSONObject$Outbound | ChatGenerationParamsResponseFormatPython$Outbound;
/** @internal */
export declare const ChatGenerationParamsResponseFormatUnion$outboundSchema: z.ZodType<ChatGenerationParamsResponseFormatUnion$Outbound, ChatGenerationParamsResponseFormatUnion>;
export declare function chatGenerationParamsResponseFormatUnionToJSON(chatGenerationParamsResponseFormatUnion: ChatGenerationParamsResponseFormatUnion): string;
/** @internal */
export type ChatGenerationParamsStop$Outbound = string | Array<string>;
/** @internal */
export declare const ChatGenerationParamsStop$outboundSchema: z.ZodType<ChatGenerationParamsStop$Outbound, ChatGenerationParamsStop>;
export declare function chatGenerationParamsStopToJSON(chatGenerationParamsStop: ChatGenerationParamsStop): string;
/** @internal */
export type ChatGenerationParams$Outbound = {
    messages: Array<Message$Outbound>;
    model?: string | undefined;
    models?: Array<string> | undefined;
    frequency_penalty?: number | null | undefined;
    logit_bias?: {
        [k: string]: number;
    } | null | undefined;
    logprobs?: boolean | null | undefined;
    top_logprobs?: number | null | undefined;
    max_completion_tokens?: number | null | undefined;
    max_tokens?: number | null | undefined;
    metadata?: {
        [k: string]: string;
    } | undefined;
    presence_penalty?: number | null | undefined;
    reasoning?: Reasoning$Outbound | undefined;
    response_format?: ResponseFormatJSONSchema$Outbound | ResponseFormatTextGrammar$Outbound | ChatGenerationParamsResponseFormatText$Outbound | ChatGenerationParamsResponseFormatJSONObject$Outbound | ChatGenerationParamsResponseFormatPython$Outbound | undefined;
    seed?: number | null | undefined;
    stop?: string | Array<string> | null | undefined;
    stream: boolean;
    stream_options?: ChatStreamOptions$Outbound | null | undefined;
    temperature?: number | null | undefined;
    tool_choice?: any | undefined;
    tools?: Array<ToolDefinitionJson$Outbound> | undefined;
    top_p?: number | null | undefined;
    user?: string | undefined;
};
/** @internal */
export declare const ChatGenerationParams$outboundSchema: z.ZodType<ChatGenerationParams$Outbound, ChatGenerationParams>;
export declare function chatGenerationParamsToJSON(chatGenerationParams: ChatGenerationParams): string;
//# sourceMappingURL=chatgenerationparams.d.ts.map