// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as SubnetsAPI from "./subnets.mjs";
import { Subnets } from "./subnets.mjs";
export class ASN extends APIResource {
    constructor() {
        super(...arguments);
        this.subnets = new SubnetsAPI.Subnets(this._client);
    }
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
    get(asn, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/intel/asn/${asn}`, options)._thenUnwrap((obj) => obj.result);
    }
}
ASN.Subnets = Subnets;
//# sourceMappingURL=asn.mjs.map