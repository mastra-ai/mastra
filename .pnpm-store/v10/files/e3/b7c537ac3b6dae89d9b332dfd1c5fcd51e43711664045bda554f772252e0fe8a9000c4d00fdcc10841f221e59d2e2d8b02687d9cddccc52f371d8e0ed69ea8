import { APIResource } from "../resource.js";
import * as Core from "../core.js";
export declare class IPs extends APIResource {
    /**
     * Get IPs used on the Cloudflare/JD Cloud network, see
     * https://www.cloudflare.com/ips for Cloudflare IPs or
     * https://developers.cloudflare.com/china-network/reference/infrastructure/ for JD
     * Cloud IPs.
     */
    list(query?: IPListParams, options?: Core.RequestOptions): Core.APIPromise<IPListResponse>;
    list(options?: Core.RequestOptions): Core.APIPromise<IPListResponse>;
}
/**
 * The set of IPs on the Address Map.
 */
export type IPsArray = Array<IPsArray.IPsArrayItem>;
export declare namespace IPsArray {
    interface IPsArrayItem {
        created_at?: string;
        /**
         * An IPv4 or IPv6 address.
         */
        ip?: string;
    }
}
export type IPListResponse = IPListResponse.PublicIPIPs | IPListResponse.PublicIPIPsJDCloud;
export declare namespace IPListResponse {
    interface PublicIPIPs {
        /**
         * A digest of the IP data. Useful for determining if the data has changed.
         */
        etag?: string;
        /**
         * List of Cloudflare IPv4 CIDR addresses.
         */
        ipv4_cidrs?: Array<string>;
        /**
         * List of Cloudflare IPv6 CIDR addresses.
         */
        ipv6_cidrs?: Array<string>;
    }
    interface PublicIPIPsJDCloud {
        /**
         * A digest of the IP data. Useful for determining if the data has changed.
         */
        etag?: string;
        /**
         * List of Cloudflare IPv4 CIDR addresses.
         */
        ipv4_cidrs?: Array<string>;
        /**
         * List of Cloudflare IPv6 CIDR addresses.
         */
        ipv6_cidrs?: Array<string>;
        /**
         * List IPv4 and IPv6 CIDRs, only populated if `?networks=jdcloud` is used.
         */
        jdcloud_cidrs?: Array<string>;
    }
}
export interface IPListParams {
    /**
     * Specified as `jdcloud` to list IPs used by JD Cloud data centers.
     */
    networks?: string;
}
export declare namespace IPs {
    export { type IPsArray as IPsArray, type IPListResponse as IPListResponse, type IPListParams as IPListParams, };
}
//# sourceMappingURL=ips.d.ts.map