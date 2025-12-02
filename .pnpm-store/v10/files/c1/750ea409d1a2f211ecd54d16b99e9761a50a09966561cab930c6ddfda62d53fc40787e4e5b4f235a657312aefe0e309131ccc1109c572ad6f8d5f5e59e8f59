import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as Shared from "../../shared.js";
export declare class Subnets extends APIResource {
    /**
     * Get ASN Subnets.
     *
     * @example
     * ```ts
     * const subnet = await client.intel.asn.subnets.get(0, {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(asn: Shared.ASNParam, params: SubnetGetParams, options?: Core.RequestOptions): Core.APIPromise<SubnetGetResponse>;
}
export interface SubnetGetResponse {
    asn?: Shared.ASN;
    /**
     * Total results returned based on your search parameters.
     */
    count?: number;
    ip_count_total?: number;
    /**
     * Current page within paginated list of results.
     */
    page?: number;
    /**
     * Number of results per page of results.
     */
    per_page?: number;
    subnets?: Array<string>;
}
export interface SubnetGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Subnets {
    export { type SubnetGetResponse as SubnetGetResponse, type SubnetGetParams as SubnetGetParams };
}
//# sourceMappingURL=subnets.d.ts.map