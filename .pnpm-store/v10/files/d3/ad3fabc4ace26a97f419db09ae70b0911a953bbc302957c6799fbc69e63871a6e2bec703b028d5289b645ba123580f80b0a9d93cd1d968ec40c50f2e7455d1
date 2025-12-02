import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import { SinglePage } from "../../pagination.js";
/**
 * @deprecated Use DNS settings API instead.
 */
export declare class CustomNameservers extends APIResource {
    /**
     * Set metadata for account-level custom nameservers on a zone.
     *
     * If you would like new zones in the account to use account custom nameservers by
     * default, use PUT /accounts/:identifier to set the account setting
     * use_account_custom_ns_by_default to true.
     *
     * Deprecated in favor of
     * [Update DNS Settings](https://developers.cloudflare.com/api/operations/dns-settings-for-a-zone-update-dns-settings).
     *
     * @deprecated Use [DNS settings API](https://developers.cloudflare.com/api/resources/dns/subresources/settings/methods/put/) instead.
     */
    update(params: CustomNameserverUpdateParams, options?: Core.RequestOptions): Core.PagePromise<CustomNameserverUpdateResponsesSinglePage, CustomNameserverUpdateResponse>;
    /**
     * Get metadata for account-level custom nameservers on a zone.
     *
     * Deprecated in favor of
     * [Show DNS Settings](https://developers.cloudflare.com/api/operations/dns-settings-for-a-zone-list-dns-settings).
     *
     * @deprecated Use [DNS settings API](https://developers.cloudflare.com/api/resources/dns/subresources/settings/methods/get/) instead.
     */
    get(params: CustomNameserverGetParams, options?: Core.RequestOptions): Core.APIPromise<CustomNameserverGetResponse>;
}
export declare class CustomNameserverUpdateResponsesSinglePage extends SinglePage<CustomNameserverUpdateResponse> {
}
/**
 * Unused
 */
export type CustomNameserverUpdateResponse = string;
export interface CustomNameserverGetResponse {
    errors: Array<Shared.ResponseInfo>;
    messages: Array<Shared.ResponseInfo>;
    /**
     * Whether the API call was successful
     */
    success: true;
    /**
     * Whether zone uses account-level custom nameservers.
     */
    enabled?: boolean;
    /**
     * The number of the name server set to assign to the zone.
     */
    ns_set?: number;
    result_info?: CustomNameserverGetResponse.ResultInfo;
}
export declare namespace CustomNameserverGetResponse {
    interface ResultInfo {
        /**
         * Total number of results for the requested service
         */
        count?: number;
        /**
         * Current page within paginated list of results
         */
        page?: number;
        /**
         * Number of results per page of results
         */
        per_page?: number;
        /**
         * Total results available without any search parameters
         */
        total_count?: number;
    }
}
export interface CustomNameserverUpdateParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: Whether zone uses account-level custom nameservers.
     */
    enabled?: boolean;
    /**
     * Body param: The number of the name server set to assign to the zone.
     */
    ns_set?: number;
}
export interface CustomNameserverGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace CustomNameservers {
    export { type CustomNameserverUpdateResponse as CustomNameserverUpdateResponse, type CustomNameserverGetResponse as CustomNameserverGetResponse, CustomNameserverUpdateResponsesSinglePage as CustomNameserverUpdateResponsesSinglePage, type CustomNameserverUpdateParams as CustomNameserverUpdateParams, type CustomNameserverGetParams as CustomNameserverGetParams, };
}
//# sourceMappingURL=custom-nameservers.d.ts.map