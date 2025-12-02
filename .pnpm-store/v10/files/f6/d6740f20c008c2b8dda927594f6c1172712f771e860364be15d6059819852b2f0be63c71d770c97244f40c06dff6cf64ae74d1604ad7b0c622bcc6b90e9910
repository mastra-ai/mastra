"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stats = void 0;
const resource_1 = require("../../../resource.js");
class Stats extends resource_1.APIResource {
    /**
     * Fetch usage statistics details for Cloudflare Images.
     *
     * @example
     * ```ts
     * const stat = await client.images.v1.stats.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/images/v1/stats`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Stats = Stats;
//# sourceMappingURL=stats.js.map