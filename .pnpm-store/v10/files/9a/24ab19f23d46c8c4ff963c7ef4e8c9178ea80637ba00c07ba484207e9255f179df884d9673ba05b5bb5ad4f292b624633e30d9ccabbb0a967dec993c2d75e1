import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
export type ListProvidersData = {
    /**
     * Display name of the provider
     */
    name: string;
    /**
     * URL-friendly identifier for the provider
     */
    slug: string;
    /**
     * URL to the provider's privacy policy
     */
    privacyPolicyUrl: string | null;
    /**
     * URL to the provider's terms of service
     */
    termsOfServiceUrl?: string | null | undefined;
    /**
     * URL to the provider's status page
     */
    statusPageUrl?: string | null | undefined;
};
/**
 * Returns a list of providers
 */
export type ListProvidersResponse = {
    data: Array<ListProvidersData>;
};
/** @internal */
export declare const ListProvidersData$inboundSchema: z.ZodType<ListProvidersData, unknown>;
export declare function listProvidersDataFromJSON(jsonString: string): SafeParseResult<ListProvidersData, SDKValidationError>;
/** @internal */
export declare const ListProvidersResponse$inboundSchema: z.ZodType<ListProvidersResponse, unknown>;
export declare function listProvidersResponseFromJSON(jsonString: string): SafeParseResult<ListProvidersResponse, SDKValidationError>;
//# sourceMappingURL=listproviders.d.ts.map