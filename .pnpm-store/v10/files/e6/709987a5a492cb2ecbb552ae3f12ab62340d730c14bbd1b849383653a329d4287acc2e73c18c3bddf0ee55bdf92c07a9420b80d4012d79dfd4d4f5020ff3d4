import * as z from "zod/v4";
import { OpenEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
export type GetParametersSecurity = {
    bearer: string;
};
export declare const GetParametersProvider: {
    readonly Ai21: "AI21";
    readonly AionLabs: "AionLabs";
    readonly Alibaba: "Alibaba";
    readonly AmazonBedrock: "Amazon Bedrock";
    readonly Anthropic: "Anthropic";
    readonly Arcee: "Arcee";
    readonly AtlasCloud: "AtlasCloud";
    readonly Avian: "Avian";
    readonly Azure: "Azure";
    readonly BaseTen: "BaseTen";
    readonly BlackForestLabs: "Black Forest Labs";
    readonly Cerebras: "Cerebras";
    readonly Chutes: "Chutes";
    readonly Cirrascale: "Cirrascale";
    readonly Clarifai: "Clarifai";
    readonly Cloudflare: "Cloudflare";
    readonly Cohere: "Cohere";
    readonly Crusoe: "Crusoe";
    readonly DeepInfra: "DeepInfra";
    readonly DeepSeek: "DeepSeek";
    readonly Featherless: "Featherless";
    readonly Fireworks: "Fireworks";
    readonly Friendli: "Friendli";
    readonly GMICloud: "GMICloud";
    readonly Google: "Google";
    readonly GoogleAIStudio: "Google AI Studio";
    readonly Groq: "Groq";
    readonly Hyperbolic: "Hyperbolic";
    readonly Inception: "Inception";
    readonly InferenceNet: "InferenceNet";
    readonly Infermatic: "Infermatic";
    readonly Inflection: "Inflection";
    readonly Liquid: "Liquid";
    readonly Mancer2: "Mancer 2";
    readonly Minimax: "Minimax";
    readonly ModelRun: "ModelRun";
    readonly Mistral: "Mistral";
    readonly Modular: "Modular";
    readonly MoonshotAI: "Moonshot AI";
    readonly Morph: "Morph";
    readonly NCompass: "NCompass";
    readonly Nebius: "Nebius";
    readonly NextBit: "NextBit";
    readonly Novita: "Novita";
    readonly Nvidia: "Nvidia";
    readonly OpenAI: "OpenAI";
    readonly OpenInference: "OpenInference";
    readonly Parasail: "Parasail";
    readonly Perplexity: "Perplexity";
    readonly Phala: "Phala";
    readonly Relace: "Relace";
    readonly SambaNova: "SambaNova";
    readonly SiliconFlow: "SiliconFlow";
    readonly Stealth: "Stealth";
    readonly Switchpoint: "Switchpoint";
    readonly Targon: "Targon";
    readonly Together: "Together";
    readonly Venice: "Venice";
    readonly WandB: "WandB";
    readonly XAI: "xAI";
    readonly ZAi: "Z.AI";
    readonly FakeProvider: "FakeProvider";
};
export type GetParametersProvider = OpenEnum<typeof GetParametersProvider>;
export type GetParametersRequest = {
    author: string;
    slug: string;
    provider?: GetParametersProvider | undefined;
};
export declare const SupportedParameter: {
    readonly Temperature: "temperature";
    readonly TopP: "top_p";
    readonly TopK: "top_k";
    readonly MinP: "min_p";
    readonly TopA: "top_a";
    readonly FrequencyPenalty: "frequency_penalty";
    readonly PresencePenalty: "presence_penalty";
    readonly RepetitionPenalty: "repetition_penalty";
    readonly MaxTokens: "max_tokens";
    readonly LogitBias: "logit_bias";
    readonly Logprobs: "logprobs";
    readonly TopLogprobs: "top_logprobs";
    readonly Seed: "seed";
    readonly ResponseFormat: "response_format";
    readonly StructuredOutputs: "structured_outputs";
    readonly Stop: "stop";
    readonly Tools: "tools";
    readonly ToolChoice: "tool_choice";
    readonly ParallelToolCalls: "parallel_tool_calls";
    readonly IncludeReasoning: "include_reasoning";
    readonly Reasoning: "reasoning";
    readonly WebSearchOptions: "web_search_options";
    readonly Verbosity: "verbosity";
};
export type SupportedParameter = OpenEnum<typeof SupportedParameter>;
/**
 * Parameter analytics data
 */
export type GetParametersData = {
    /**
     * Model identifier
     */
    model: string;
    /**
     * List of parameters supported by this model
     */
    supportedParameters: Array<SupportedParameter>;
};
/**
 * Returns the parameters for the specified model
 */
export type GetParametersResponse = {
    /**
     * Parameter analytics data
     */
    data: GetParametersData;
};
/** @internal */
export type GetParametersSecurity$Outbound = {
    bearer: string;
};
/** @internal */
export declare const GetParametersSecurity$outboundSchema: z.ZodType<GetParametersSecurity$Outbound, GetParametersSecurity>;
export declare function getParametersSecurityToJSON(getParametersSecurity: GetParametersSecurity): string;
/** @internal */
export declare const GetParametersProvider$outboundSchema: z.ZodType<string, GetParametersProvider>;
/** @internal */
export type GetParametersRequest$Outbound = {
    author: string;
    slug: string;
    provider?: string | undefined;
};
/** @internal */
export declare const GetParametersRequest$outboundSchema: z.ZodType<GetParametersRequest$Outbound, GetParametersRequest>;
export declare function getParametersRequestToJSON(getParametersRequest: GetParametersRequest): string;
/** @internal */
export declare const SupportedParameter$inboundSchema: z.ZodType<SupportedParameter, unknown>;
/** @internal */
export declare const GetParametersData$inboundSchema: z.ZodType<GetParametersData, unknown>;
export declare function getParametersDataFromJSON(jsonString: string): SafeParseResult<GetParametersData, SDKValidationError>;
/** @internal */
export declare const GetParametersResponse$inboundSchema: z.ZodType<GetParametersResponse, unknown>;
export declare function getParametersResponseFromJSON(jsonString: string): SafeParseResult<GetParametersResponse, SDKValidationError>;
//# sourceMappingURL=getparameters.d.ts.map