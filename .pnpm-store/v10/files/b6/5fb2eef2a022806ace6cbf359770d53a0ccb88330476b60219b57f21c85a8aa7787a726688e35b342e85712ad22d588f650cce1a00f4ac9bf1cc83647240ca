import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class IPs extends APIResource {
    /**
     * Gets the geolocation, ASN, infrastructure type of the ASN, and any security
     * threat categories of an IP address. **Must provide ip query parameters.** For
     * example, `/intel/ip?ipv4=1.1.1.1` or `/intel/ip?ipv6=2001:db8::1`.
     *
     * @example
     * ```ts
     * const ips = await client.intel.ips.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: IPGetParams, options?: Core.RequestOptions): Core.APIPromise<IPGetResponse | null>;
}
export interface IP {
    /**
     * Specifies a reference to the autonomous systems (AS) that the IP address belongs
     * to.
     */
    belongs_to_ref?: IP.BelongsToRef;
    ip?: string;
    risk_types?: Array<IP.RiskType>;
}
export declare namespace IP {
    /**
     * Specifies a reference to the autonomous systems (AS) that the IP address belongs
     * to.
     */
    interface BelongsToRef {
        id?: string;
        country?: string;
        description?: string;
        /**
         * Infrastructure type of this ASN.
         */
        type?: 'hosting_provider' | 'isp' | 'organization';
        value?: string;
    }
    interface RiskType {
        id?: number;
        name?: string;
        super_category_id?: number;
    }
}
export type IPGetResponse = Array<IP>;
export interface IPGetParams {
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
    ipv6?: string;
}
export declare namespace IPs {
    export { type IP as IP, type IPGetResponse as IPGetResponse, type IPGetParams as IPGetParams };
}
//# sourceMappingURL=ips.d.ts.map