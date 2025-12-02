import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as Shared from "../../shared.js";
import * as SubnetsAPI from "./subnets.js";
import { SubnetGetParams, SubnetGetResponse, Subnets } from "./subnets.js";
export declare class ASN extends APIResource {
    subnets: SubnetsAPI.Subnets;
    /**
     * Gets an overview of the Autonomous System Number (ASN) and a list of subnets for
     * it.
     *
     * @example
     * ```ts
     * const asn = await client.intel.asn.get(0, {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(asn: Shared.ASNParam, params: ASNGetParams, options?: Core.RequestOptions): Core.APIPromise<Shared.ASN>;
}
export interface ASNGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace ASN {
    export { type ASNGetParams as ASNGetParams };
    export { Subnets as Subnets, type SubnetGetResponse as SubnetGetResponse, type SubnetGetParams as SubnetGetParams, };
}
//# sourceMappingURL=asn.d.ts.map