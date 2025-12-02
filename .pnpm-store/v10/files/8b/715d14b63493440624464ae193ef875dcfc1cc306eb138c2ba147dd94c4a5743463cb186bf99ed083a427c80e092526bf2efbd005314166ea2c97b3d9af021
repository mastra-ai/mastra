import { APIResource } from "../resource.js";
import * as Core from "../core.js";
import { SinglePage } from "../pagination.js";
export declare class CustomNameservers extends APIResource {
    /**
     * Add Account Custom Nameserver
     *
     * @example
     * ```ts
     * const customNameserver =
     *   await client.customNameservers.create({
     *     account_id: '372e67954025e0ba6aaa6d586b9e0b59',
     *     ns_name: 'ns1.example.com',
     *   });
     * ```
     */
    create(params: CustomNameserverCreateParams, options?: Core.RequestOptions): Core.APIPromise<CustomNameserver>;
    /**
     * Delete Account Custom Nameserver
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customNameserverDeleteResponse of client.customNameservers.delete(
     *   'ns1.example.com',
     *   { account_id: '372e67954025e0ba6aaa6d586b9e0b59' },
     * )) {
     *   // ...
     * }
     * ```
     */
    delete(customNSId: string, params: CustomNameserverDeleteParams, options?: Core.RequestOptions): Core.PagePromise<CustomNameserverDeleteResponsesSinglePage, CustomNameserverDeleteResponse>;
    /**
     * List an account's custom nameservers.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customNameserver of client.customNameservers.get(
     *   { account_id: '372e67954025e0ba6aaa6d586b9e0b59' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params: CustomNameserverGetParams, options?: Core.RequestOptions): Core.PagePromise<CustomNameserversSinglePage, CustomNameserver>;
}
export declare class CustomNameserverDeleteResponsesSinglePage extends SinglePage<CustomNameserverDeleteResponse> {
}
export declare class CustomNameserversSinglePage extends SinglePage<CustomNameserver> {
}
/**
 * A single account custom nameserver.
 */
export interface CustomNameserver {
    /**
     * A and AAAA records associated with the nameserver.
     */
    dns_records: Array<CustomNameserver.DNSRecord>;
    /**
     * The FQDN of the name server.
     */
    ns_name: string;
    /**
     * @deprecated Verification status of the nameserver.
     */
    status: 'moved' | 'pending' | 'verified';
    /**
     * Identifier
     */
    zone_tag: string;
    /**
     * The number of the set that this name server belongs to.
     */
    ns_set?: number;
}
export declare namespace CustomNameserver {
    interface DNSRecord {
        /**
         * DNS record type.
         */
        type?: 'A' | 'AAAA';
        /**
         * DNS record contents (an IPv4 or IPv6 address).
         */
        value?: string;
    }
}
/**
 * Unused
 */
export type CustomNameserverDeleteResponse = string;
export interface CustomNameserverCreateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: The FQDN of the name server.
     */
    ns_name: string;
    /**
     * Body param: The number of the set that this name server belongs to.
     */
    ns_set?: number;
}
export interface CustomNameserverDeleteParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export interface CustomNameserverGetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace CustomNameservers {
    export { type CustomNameserver as CustomNameserver, type CustomNameserverDeleteResponse as CustomNameserverDeleteResponse, CustomNameserverDeleteResponsesSinglePage as CustomNameserverDeleteResponsesSinglePage, CustomNameserversSinglePage as CustomNameserversSinglePage, type CustomNameserverCreateParams as CustomNameserverCreateParams, type CustomNameserverDeleteParams as CustomNameserverDeleteParams, type CustomNameserverGetParams as CustomNameserverGetParams, };
}
//# sourceMappingURL=custom-nameservers.d.ts.map