import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
export type ListRequest = {
    /**
     * Whether to include disabled API keys in the response
     */
    includeDisabled?: string | undefined;
    /**
     * Number of API keys to skip for pagination
     */
    offset?: string | undefined;
};
export type ListData = {
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
 * List of API keys
 */
export type ListResponse = {
    /**
     * List of API keys
     */
    data: Array<ListData>;
};
/** @internal */
export type ListRequest$Outbound = {
    include_disabled?: string | undefined;
    offset?: string | undefined;
};
/** @internal */
export declare const ListRequest$outboundSchema: z.ZodType<ListRequest$Outbound, ListRequest>;
export declare function listRequestToJSON(listRequest: ListRequest): string;
/** @internal */
export declare const ListData$inboundSchema: z.ZodType<ListData, unknown>;
export declare function listDataFromJSON(jsonString: string): SafeParseResult<ListData, SDKValidationError>;
/** @internal */
export declare const ListResponse$inboundSchema: z.ZodType<ListResponse, unknown>;
export declare function listResponseFromJSON(jsonString: string): SafeParseResult<ListResponse, SDKValidationError>;
//# sourceMappingURL=list.d.ts.map