"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Downloads = void 0;
const resource_1 = require("../../../resource.js");
class Downloads extends resource_1.APIResource {
    /**
     * Download indicator feed data
     *
     * @example
     * ```ts
     * const download =
     *   await client.intel.indicatorFeeds.downloads.get(12, {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(feedId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/intel/indicator_feeds/${feedId}/download`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Downloads = Downloads;
//# sourceMappingURL=downloads.js.map