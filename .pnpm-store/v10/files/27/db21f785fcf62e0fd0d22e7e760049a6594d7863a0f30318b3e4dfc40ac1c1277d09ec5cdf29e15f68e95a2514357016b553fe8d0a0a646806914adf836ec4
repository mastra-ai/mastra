"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Previews = void 0;
const resource_1 = require("../../resource.js");
class Previews extends resource_1.APIResource {
    /**
     * Get the result of a previous preview operation using the provided preview_id.
     *
     * @example
     * ```ts
     * const preview = await client.loadBalancers.previews.get(
     *   'p1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(previewId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/load_balancers/preview/${previewId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Previews = Previews;
//# sourceMappingURL=previews.js.map