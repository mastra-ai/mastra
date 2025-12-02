"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bulks = void 0;
const resource_1 = require("../../../resource.js");
class Bulks extends resource_1.APIResource {
    /**
     * Same as summary.
     *
     * @example
     * ```ts
     * const bulks = await client.intel.domains.bulks.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/intel/domain/bulk`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Bulks = Bulks;
//# sourceMappingURL=bulks.js.map