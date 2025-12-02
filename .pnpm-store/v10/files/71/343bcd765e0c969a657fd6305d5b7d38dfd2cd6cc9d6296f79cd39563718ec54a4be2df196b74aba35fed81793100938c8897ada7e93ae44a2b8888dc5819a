import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { InputModality } from "./inputmodality.js";
import { InstructType } from "./instructtype.js";
import { OutputModality } from "./outputmodality.js";
import { PublicEndpoint } from "./publicendpoint.js";
/**
 * Tokenizer type used by the model
 */
export declare const Tokenizer: {
    readonly Router: "Router";
    readonly Media: "Media";
    readonly Other: "Other";
    readonly Gpt: "GPT";
    readonly Claude: "Claude";
    readonly Gemini: "Gemini";
    readonly Grok: "Grok";
    readonly Cohere: "Cohere";
    readonly Nova: "Nova";
    readonly Qwen: "Qwen";
    readonly Yi: "Yi";
    readonly DeepSeek: "DeepSeek";
    readonly Mistral: "Mistral";
    readonly Llama2: "Llama2";
    readonly Llama3: "Llama3";
    readonly Llama4: "Llama4";
    readonly PaLM: "PaLM";
    readonly Rwkv: "RWKV";
    readonly Qwen3: "Qwen3";
};
/**
 * Tokenizer type used by the model
 */
export type Tokenizer = OpenEnum<typeof Tokenizer>;
/**
 * Model architecture information
 */
export type Architecture = {
    tokenizer: Tokenizer | null;
    /**
     * Instruction format type
     */
    instructType: InstructType | null;
    /**
     * Primary modality of the model
     */
    modality: string | null;
    /**
     * Supported input modalities
     */
    inputModalities: Array<InputModality>;
    /**
     * Supported output modalities
     */
    outputModalities: Array<OutputModality>;
};
/**
 * List of available endpoints for a model
 */
export type ListEndpointsResponse = {
    /**
     * Unique identifier for the model
     */
    id: string;
    /**
     * Display name of the model
     */
    name: string;
    /**
     * Unix timestamp of when the model was created
     */
    created: number;
    /**
     * Description of the model
     */
    description: string;
    architecture: Architecture;
    /**
     * List of available endpoints for this model
     */
    endpoints: Array<PublicEndpoint>;
};
/** @internal */
export declare const Tokenizer$inboundSchema: z.ZodType<Tokenizer, unknown>;
/** @internal */
export declare const Architecture$inboundSchema: z.ZodType<Architecture, unknown>;
export declare function architectureFromJSON(jsonString: string): SafeParseResult<Architecture, SDKValidationError>;
/** @internal */
export declare const ListEndpointsResponse$inboundSchema: z.ZodType<ListEndpointsResponse, unknown>;
export declare function listEndpointsResponseFromJSON(jsonString: string): SafeParseResult<ListEndpointsResponse, SDKValidationError>;
//# sourceMappingURL=listendpointsresponse.d.ts.map