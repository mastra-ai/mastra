import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class ReverseDNS extends APIResource {
    /**
     * Update reverse DNS configuration (PTR records) for a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const response = await client.dnsFirewall.reverseDNS.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(dnsFirewallId: string, params: ReverseDNSEditParams, options?: Core.RequestOptions): Core.APIPromise<ReverseDNSEditResponse>;
    /**
     * Show reverse DNS configuration (PTR records) for a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const reverseDNS = await client.dnsFirewall.reverseDNS.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(dnsFirewallId: string, params: ReverseDNSGetParams, options?: Core.RequestOptions): Core.APIPromise<ReverseDNSGetResponse>;
}
export interface ReverseDNSEditResponse {
    /**
     * Map of cluster IP addresses to PTR record contents
     */
    ptr: {
        [key: string]: string;
    };
}
export interface ReverseDNSGetResponse {
    /**
     * Map of cluster IP addresses to PTR record contents
     */
    ptr: {
        [key: string]: string;
    };
}
export interface ReverseDNSEditParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: Map of cluster IP addresses to PTR record contents
     */
    ptr?: {
        [key: string]: string;
    };
}
export interface ReverseDNSGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace ReverseDNS {
    export { type ReverseDNSEditResponse as ReverseDNSEditResponse, type ReverseDNSGetResponse as ReverseDNSGetResponse, type ReverseDNSEditParams as ReverseDNSEditParams, type ReverseDNSGetParams as ReverseDNSGetParams, };
}
//# sourceMappingURL=reverse-dns.d.ts.map