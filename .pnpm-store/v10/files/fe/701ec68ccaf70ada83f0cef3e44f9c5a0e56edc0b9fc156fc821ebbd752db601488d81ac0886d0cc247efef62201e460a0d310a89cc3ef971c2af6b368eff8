"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subnets = void 0;
const resource_1 = require("../../../resource.js");
class Subnets extends resource_1.APIResource {
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
    get(asn, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/intel/asn/${asn}/subnets`, options);
    }
}
exports.Subnets = Subnets;
//# sourceMappingURL=subnets.js.map