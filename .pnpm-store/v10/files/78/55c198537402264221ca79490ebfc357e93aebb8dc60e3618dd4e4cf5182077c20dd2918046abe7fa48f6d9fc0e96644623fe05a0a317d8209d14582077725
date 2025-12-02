import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { InputModality } from "./inputmodality.js";
import { ModelGroup } from "./modelgroup.js";
import { OutputModality } from "./outputmodality.js";
/**
 * Instruction format type
 */
export declare const ModelArchitectureInstructType: {
    readonly None: "none";
    readonly Airoboros: "airoboros";
    readonly Alpaca: "alpaca";
    readonly AlpacaModif: "alpaca-modif";
    readonly Chatml: "chatml";
    readonly Claude: "claude";
    readonly CodeLlama: "code-llama";
    readonly Gemma: "gemma";
    readonly Llama2: "llama2";
    readonly Llama3: "llama3";
    readonly Mistral: "mistral";
    readonly Nemotron: "nemotron";
    readonly Neural: "neural";
    readonly Openchat: "openchat";
    readonly Phi3: "phi3";
    readonly Rwkv: "rwkv";
    readonly Vicuna: "vicuna";
    readonly Zephyr: "zephyr";
    readonly DeepseekR1: "deepseek-r1";
    readonly DeepseekV31: "deepseek-v3.1";
    readonly Qwq: "qwq";
    readonly Qwen3: "qwen3";
};
/**
 * Instruction format type
 */
export type ModelArchitectureInstructType = OpenEnum<typeof ModelArchitectureInstructType>;
/**
 * Model architecture information
 */
export type ModelArchitecture = {
    /**
     * Tokenizer type used by the model
     */
    tokenizer?: ModelGroup | undefined;
    /**
     * Instruction format type
     */
    instructType?: ModelArchitectureInstructType | null | undefined;
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
/** @internal */
export declare const ModelArchitectureInstructType$inboundSchema: z.ZodType<ModelArchitectureInstructType, unknown>;
/** @internal */
export declare const ModelArchitecture$inboundSchema: z.ZodType<ModelArchitecture, unknown>;
export declare function modelArchitectureFromJSON(jsonString: string): SafeParseResult<ModelArchitecture, SDKValidationError>;
//# sourceMappingURL=modelarchitecture.d.ts.map