"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metrics = void 0;
const resource_1 = require("../../../resource.js");
class Metrics extends resource_1.APIResource {
    /**
     * Get Storage/Object Count Metrics across all buckets in your account. Note that
     * Account-Level Metrics may not immediately reflect the latest data.
     *
     * @example
     * ```ts
     * const metrics = await client.r2.buckets.metrics.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/r2/metrics`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Metrics = Metrics;
//# sourceMappingURL=metrics.js.map