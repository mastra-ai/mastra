import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePagination, type V4PagePaginationParams } from "../../pagination.js";
export declare class DNS extends APIResource {
    /**
     * Gets a list of all the domains that have resolved to a specific IP address.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const dns of client.intel.dns.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: DNSListParams, options?: Core.RequestOptions): Core.PagePromise<DNSV4PagePagination, DNS>;
}
export declare class DNSV4PagePagination extends V4PagePagination<DNS> {
}
export interface DNS {
    /**
     * Total results returned based on your search parameters.
     */
    count?: number;
    /**
     * Current page within paginated list of results.
     */
    page?: number;
    /**
     * Number of results per page of results.
     */
    per_page?: number;
    /**
     * Reverse DNS look-ups observed during the time period.
     */
    reverse_records?: Array<DNS.ReverseRecord>;
}
export declare namespace DNS {
    interface ReverseRecord {
        /**
         * First seen date of the DNS record during the time period.
         */
        first_seen?: string;
        /**
         * Hostname that the IP was observed resolving to.
         */
        hostname?: string;
        /**
         * Last seen date of the DNS record during the time period.
         */
        last_seen?: string;
    }
}
export interface DNSListParams extends V4PagePaginationParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param:
     */
    ipv4?: string;
    /**
     * Query param:
     */
    start_end_params?: DNSListParams.StartEndParams;
}
export declare namespace DNSListParams {
    interface StartEndParams {
        /**
         * Defaults to the current date.
         */
        end?: string;
        /**
         * Defaults to 30 days before the end parameter value.
         */
        start?: string;
    }
}
export declare namespace DNS {
    export { type DNS as DNS, DNSV4PagePagination as DNSV4PagePagination, type DNSListParams as DNSListParams };
}
//# sourceMappingURL=dns.d.ts.map