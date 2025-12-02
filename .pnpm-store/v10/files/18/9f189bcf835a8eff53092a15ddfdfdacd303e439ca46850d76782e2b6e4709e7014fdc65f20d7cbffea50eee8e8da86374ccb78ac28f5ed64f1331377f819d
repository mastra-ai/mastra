import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
/**
 * Information about the top provider for this model
 */
export type TopProviderInfo = {
    /**
     * Context length from the top provider
     */
    contextLength?: number | null | undefined;
    /**
     * Maximum completion tokens from the top provider
     */
    maxCompletionTokens?: number | null | undefined;
    /**
     * Whether the top provider moderates content
     */
    isModerated: boolean;
};
/** @internal */
export declare const TopProviderInfo$inboundSchema: z.ZodType<TopProviderInfo, unknown>;
export declare function topProviderInfoFromJSON(jsonString: string): SafeParseResult<TopProviderInfo, SDKValidationError>;
//# sourceMappingURL=topproviderinfo.d.ts.map