import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { EndpointStatus } from "./endpointstatus.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { Parameter } from "./parameter.js";
import { ProviderName } from "./providername.js";
export type Pricing = {
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
    request?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    image?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    imageToken?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    imageOutput?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    audio?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    inputAudioCache?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    webSearch?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    internalReasoning?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    inputCacheRead?: any | undefined;
    /**
     * A value in string or number format that is a large number
     */
    inputCacheWrite?: any | undefined;
    discount?: number | undefined;
};
export declare const PublicEndpointQuantization: {
    readonly Int4: "int4";
    readonly Int8: "int8";
    readonly Fp4: "fp4";
    readonly Fp6: "fp6";
    readonly Fp8: "fp8";
    readonly Fp16: "fp16";
    readonly Bf16: "bf16";
    readonly Fp32: "fp32";
    readonly Unknown: "unknown";
};
export type PublicEndpointQuantization = OpenEnum<typeof PublicEndpointQuantization>;
/**
 * Information about a specific model endpoint
 */
export type PublicEndpoint = {
    name: string;
    modelName: string;
    contextLength: number;
    pricing: Pricing;
    providerName: ProviderName;
    tag: string;
    quantization: PublicEndpointQuantization | null;
    maxCompletionTokens: number | null;
    maxPromptTokens: number | null;
    supportedParameters: Array<Parameter>;
    status?: EndpointStatus | undefined;
    uptimeLast30m: number | null;
    supportsImplicitCaching: boolean;
};
/** @internal */
export declare const Pricing$inboundSchema: z.ZodType<Pricing, unknown>;
export declare function pricingFromJSON(jsonString: string): SafeParseResult<Pricing, SDKValidationError>;
/** @internal */
export declare const PublicEndpointQuantization$inboundSchema: z.ZodType<PublicEndpointQuantization, unknown>;
/** @internal */
export declare const PublicEndpoint$inboundSchema: z.ZodType<PublicEndpoint, unknown>;
export declare function publicEndpointFromJSON(jsonString: string): SafeParseResult<PublicEndpoint, SDKValidationError>;
//# sourceMappingURL=publicendpoint.d.ts.map