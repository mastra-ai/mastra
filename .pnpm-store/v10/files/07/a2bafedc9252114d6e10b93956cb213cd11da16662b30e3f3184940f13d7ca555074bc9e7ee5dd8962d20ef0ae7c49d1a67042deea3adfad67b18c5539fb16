import * as z from "zod/v4";
import { OpenEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
/**
 * Type of limit reset for the API key (daily, weekly, monthly, or null for no reset). Resets happen automatically at midnight UTC, and weeks are Monday through Sunday.
 */
export declare const CreateKeysLimitReset: {
    readonly Daily: "daily";
    readonly Weekly: "weekly";
    readonly Monthly: "monthly";
};
/**
 * Type of limit reset for the API key (daily, weekly, monthly, or null for no reset). Resets happen automatically at midnight UTC, and weeks are Monday through Sunday.
 */
export type CreateKeysLimitReset = OpenEnum<typeof CreateKeysLimitReset>;
export type CreateKeysRequest = {
    /**
     * Name for the new API key
     */
    name: string;
    /**
     * Optional spending limit for the API key in USD
     */
    limit?: number | null | undefined;
    /**
     * Type of limit reset for the API key (daily, weekly, monthly, or null for no reset). Resets happen automatically at midnight UTC, and weeks are Monday through Sunday.
     */
    limitReset?: CreateKeysLimitReset | null | undefined;
    /**
     * Whether to include BYOK usage in the limit
     */
    includeByokInLimit?: boolean | undefined;
    /**
     * Optional ISO 8601 UTC timestamp when the API key should expire. Must be UTC, other timezones will be rejected
     */
    expiresAt?: Date | null | undefined;
};
/**
 * The created API key information
 */
export type CreateKeysData = {
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
 * API key created successfully
 */
export type CreateKeysResponse = {
    /**
     * The created API key information
     */
    data: CreateKeysData;
    /**
     * The actual API key string (only shown once)
     */
    key: string;
};
/** @internal */
export declare const CreateKeysLimitReset$outboundSchema: z.ZodType<string, CreateKeysLimitReset>;
/** @internal */
export type CreateKeysRequest$Outbound = {
    name: string;
    limit?: number | null | undefined;
    limit_reset?: string | null | undefined;
    include_byok_in_limit?: boolean | undefined;
    expires_at?: string | null | undefined;
};
/** @internal */
export declare const CreateKeysRequest$outboundSchema: z.ZodType<CreateKeysRequest$Outbound, CreateKeysRequest>;
export declare function createKeysRequestToJSON(createKeysRequest: CreateKeysRequest): string;
/** @internal */
export declare const CreateKeysData$inboundSchema: z.ZodType<CreateKeysData, unknown>;
export declare function createKeysDataFromJSON(jsonString: string): SafeParseResult<CreateKeysData, SDKValidationError>;
/** @internal */
export declare const CreateKeysResponse$inboundSchema: z.ZodType<CreateKeysResponse, unknown>;
export declare function createKeysResponseFromJSON(jsonString: string): SafeParseResult<CreateKeysResponse, SDKValidationError>;
//# sourceMappingURL=createkeys.d.ts.map