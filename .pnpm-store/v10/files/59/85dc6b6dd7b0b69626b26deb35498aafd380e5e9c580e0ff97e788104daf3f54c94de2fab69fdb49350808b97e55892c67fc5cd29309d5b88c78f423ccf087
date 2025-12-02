"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Eligible = void 0;
const resource_1 = require("../../../resource.js");
class Eligible extends resource_1.APIResource {
    /**
     * Get a list of all delivery mechanism types for which an account is eligible.
     *
     * @example
     * ```ts
     * const eligible =
     *   await client.alerting.destinations.eligible.get({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/alerting/v3/destinations/eligible`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Eligible = Eligible;
//# sourceMappingURL=eligible.js.map