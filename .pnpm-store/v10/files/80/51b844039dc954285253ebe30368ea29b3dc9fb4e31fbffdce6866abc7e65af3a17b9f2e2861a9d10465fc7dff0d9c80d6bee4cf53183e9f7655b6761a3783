import * as z from "zod/v4";
import { OpenEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
/**
 * New limit reset type for the API key (daily, weekly, monthly, or null for no reset). Resets happen automatically at midnight UTC, and weeks are Monday through Sunday.
 */
export declare const UpdateKeysLimitReset: {
    readonly Daily: "daily";
    readonly Weekly: "weekly";
    readonly Monthly: "monthly";
};
/**
 * New limit reset type for the API key (daily, weekly, monthly, or null for no reset). Resets happen automatically at midnight UTC, and weeks are Monday through Sunday.
 */
export type UpdateKeysLimitReset = OpenEnum<typeof UpdateKeysLimitReset>;
export type UpdateKeysRequestBody = {
    /**
     * New name for the API key
     */
    name?: string | undefined;
    /**
     * Whether to disable the API key
     */
    disabled?: boolean | undefined;
    /**
     * New spending limit for the API key in USD
     */
    limit?: number | null | undefined;
    /**
     * New limit reset type for the API key (daily, weekly, monthly, or null for no reset). Resets happen automatically at midnight UTC, and weeks are Monday through Sunday.
     */
    limitReset?: UpdateKeysLimitReset | null | undefined;
    /**
     * Whether to include BYOK usage in the limit
     */
    includeByokInLimit?: boolean | undefined;
};
export type UpdateKeysRequest = {
    /**
     * The hash identifier of the API key to update
     */
    hash: string;
    requestBody: UpdateKeysRequestBody;
};
/**
 * The updated API key information
 */
export type UpdateKeysData = {
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
 * API key updated successfully
 */
export type UpdateKeysResponse = {
    /**
     * The updated API key information
     */
    data: UpdateKeysData;
};
/** @internal */
export declare const UpdateKeysLimitReset$outboundSchema: z.ZodType<string, UpdateKeysLimitReset>;
/** @internal */
export type UpdateKeysRequestBody$Outbound = {
    name?: string | undefined;
    disabled?: boolean | undefined;
    limit?: number | null | undefined;
    limit_reset?: string | null | undefined;
    include_byok_in_limit?: boolean | undefined;
};
/** @internal */
export declare const UpdateKeysRequestBody$outboundSchema: z.ZodType<UpdateKeysRequestBody$Outbound, UpdateKeysRequestBody>;
export declare function updateKeysRequestBodyToJSON(updateKeysRequestBody: UpdateKeysRequestBody): string;
/** @internal */
export type UpdateKeysRequest$Outbound = {
    hash: string;
    RequestBody: UpdateKeysRequestBody$Outbound;
};
/** @internal */
export declare const UpdateKeysRequest$outboundSchema: z.ZodType<UpdateKeysRequest$Outbound, UpdateKeysRequest>;
export declare function updateKeysRequestToJSON(updateKeysRequest: UpdateKeysRequest): string;
/** @internal */
export declare const UpdateKeysData$inboundSchema: z.ZodType<UpdateKeysData, unknown>;
export declare function updateKeysDataFromJSON(jsonString: string): SafeParseResult<UpdateKeysData, SDKValidationError>;
/** @internal */
export declare const UpdateKeysResponse$inboundSchema: z.ZodType<UpdateKeysResponse, unknown>;
export declare function updateKeysResponseFromJSON(jsonString: string): SafeParseResult<UpdateKeysResponse, SDKValidationError>;
//# sourceMappingURL=updatekeys.d.ts.map