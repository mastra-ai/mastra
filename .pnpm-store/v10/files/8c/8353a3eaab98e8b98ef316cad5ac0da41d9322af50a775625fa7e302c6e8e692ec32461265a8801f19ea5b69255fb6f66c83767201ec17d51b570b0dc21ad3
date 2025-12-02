import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
export type GetKeyRequest = {
    /**
     * The hash identifier of the API key to retrieve
     */
    hash: string;
};
/**
 * The API key information
 */
export type GetKeyData = {
    /**
     * Unique hash identifier for the API key
     */
    hash: string;
    /**
     * Name of the API key
     */
    name: string;
    /**
     * Human-readable label for the API key
     */
    label: string;
    /**
     * Whether the API key is disabled
     */
    disabled: boolean;
    /**
     * Spending limit for the API key in USD
     */
    limit: number | null;
    /**
     * Remaining spending limit in USD
     */
    limitRemaining: number | null;
    /**
     * Type of limit reset for the API key
     */
    limitReset: string | null;
    /**
     * Whether to include external BYOK usage in the credit limit
     */
    includeByokInLimit: boolean;
    /**
     * Total OpenRouter credit usage (in USD) for the API key
     */
    usage: number;
    /**
     * OpenRouter credit usage (in USD) for the current UTC day
     */
    usageDaily: number;
    /**
     * OpenRouter credit usage (in USD) for the current UTC week (Monday-Sunday)
     */
    usageWeekly: number;
    /**
     * OpenRouter credit usage (in USD) for the current UTC month
     */
    usageMonthly: number;
    /**
     * Total external BYOK usage (in USD) for the API key
     */
    byokUsage: number;
    /**
     * External BYOK usage (in USD) for the current UTC day
     */
    byokUsageDaily: number;
    /**
     * External BYOK usage (in USD) for the current UTC week (Monday-Sunday)
     */
    byokUsageWeekly: number;
    /**
     * External BYOK usage (in USD) for current UTC month
     */
    byokUsageMonthly: number;
    /**
     * ISO 8601 timestamp of when the API key was created
     */
    createdAt: string;
    /**
     * ISO 8601 timestamp of when the API key was last updated
     */
    updatedAt: string | null;
    /**
     * ISO 8601 UTC timestamp when the API key expires, or null if no expiration
     */
    expiresAt?: Date | null | undefined;
};
/**
 * API key details
 */
export type GetKeyResponse = {
    /**
     * The API key information
     */
    data: GetKeyData;
};
/** @internal */
export type GetKeyRequest$Outbound = {
    hash: string;
};
/** @internal */
export declare const GetKeyRequest$outboundSchema: z.ZodType<GetKeyRequest$Outbound, GetKeyRequest>;
export declare function getKeyRequestToJSON(getKeyRequest: GetKeyRequest): string;
/** @internal */
export declare const GetKeyData$inboundSchema: z.ZodType<GetKeyData, unknown>;
export declare function getKeyDataFromJSON(jsonString: string): SafeParseResult<GetKeyData, SDKValidationError>;
/** @internal */
export declare const GetKeyResponse$inboundSchema: z.ZodType<GetKeyResponse, unknown>;
export declare function getKeyResponseFromJSON(jsonString: string): SafeParseResult<GetKeyResponse, SDKValidationError>;
//# sourceMappingURL=getkey.d.ts.map