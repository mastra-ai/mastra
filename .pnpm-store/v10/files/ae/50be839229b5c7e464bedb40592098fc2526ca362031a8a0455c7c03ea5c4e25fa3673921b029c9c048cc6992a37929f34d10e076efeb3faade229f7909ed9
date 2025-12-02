import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { DefaultParameters } from "./defaultparameters.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ModelArchitecture } from "./modelarchitecture.js";
import { Parameter } from "./parameter.js";
import { PerRequestLimits } from "./perrequestlimits.js";
import { PublicPricing } from "./publicpricing.js";
import { TopProviderInfo } from "./topproviderinfo.js";
/**
 * Information about an AI model available on OpenRouter
 */
export type Model = {
    /**
     * Unique identifier for the model
     */
    id: string;
    /**
     * Canonical slug for the model
     */
    canonicalSlug: string;
    /**
     * Hugging Face model identifier, if applicable
     */
    huggingFaceId?: string | null | undefined;
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
    description?: string | undefined;
    /**
     * Pricing information for the model
     */
    pricing: PublicPricing;
    /**
     * Maximum context length in tokens
     */
    contextLength: number | null;
    /**
     * Model architecture information
     */
    architecture: ModelArchitecture;
    /**
     * Information about the top provider for this model
     */
    topProvider: TopProviderInfo;
    /**
     * Per-request token limits
     */
    perRequestLimits: PerRequestLimits | null;
    /**
     * List of supported parameters for this model
     */
    supportedParameters: Array<Parameter>;
    /**
     * Default parameters for this model
     */
    defaultParameters: DefaultParameters | null;
};
/** @internal */
export declare const Model$inboundSchema: z.ZodType<Model, unknown>;
export declare function modelFromJSON(jsonString: string): SafeParseResult<Model, SDKValidationError>;
//# sourceMappingURL=model.d.ts.map