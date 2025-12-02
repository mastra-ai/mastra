import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
/**
 * Legacy rate limit information about a key. Will always return -1.
 *
 * @deprecated class: This will be removed in a future release, please migrate away from it as soon as possible.
 */
export type RateLimit = {
    /**
     * Number of requests allowed per interval
     */
    requests: number;
    /**
     * Rate limit interval
     */
    interval: string;
    /**
     * Note about the rate limit
     */
    note: string;
};
/**
 * Current API key information
 */
export type GetCurrentKeyData = {
    /**
     * Human-readable label for the API key
     */
    label: string;
    /**
     * Spending limit for the API key in USD
     */
    limit: number | null;
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
     * Whether this is a free tier API key
     */
    isFreeTier: boolean;
    /**
     * Whether this is a provisioning key
     */
    isProvisioningKey: boolean;
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
     * ISO 8601 UTC timestamp when the API key expires, or null if no expiration
     */
    expiresAt?: Date | null | undefined;
    /**
     * Legacy rate limit information about a key. Will always return -1.
     *
     * @deprecated field: This will be removed in a future release, please migrate away from it as soon as possible.
     */
    rateLimit: RateLimit;
};
/**
 * API key details
 */
export type GetCurrentKeyResponse = {
    /**
     * Current API key information
     */
    data: GetCurrentKeyData;
};
/** @internal */
export declare const RateLimit$inboundSchema: z.ZodType<RateLimit, unknown>;
export declare function rateLimitFromJSON(jsonString: string): SafeParseResult<RateLimit, SDKValidationError>;
/** @internal */
export declare const GetCurrentKeyData$inboundSchema: z.ZodType<GetCurrentKeyData, unknown>;
export declare function getCurrentKeyDataFromJSON(jsonString: string): SafeParseResult<GetCurrentKeyData, SDKValidationError>;
/** @internal */
export declare const GetCurrentKeyResponse$inboundSchema: z.ZodType<GetCurrentKeyResponse, unknown>;
export declare function getCurrentKeyResponseFromJSON(jsonString: string): SafeParseResult<GetCurrentKeyResponse, SDKValidationError>;
//# sourceMappingURL=getcurrentkey.d.ts.map