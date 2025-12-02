"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoriesV4PagePaginationArray = exports.HistoryResource = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class HistoryResource extends resource_1.APIResource {
    /**
     * Gets a list of history records for notifications sent to an account. The records
     * are displayed for last `x` number of days based on the zone plan (free = 30, pro
     * = 30, biz = 30, ent = 90).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const history of client.alerting.history.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/alerting/v3/history`, HistoriesV4PagePaginationArray, { query, ...options });
    }
}
exports.HistoryResource = HistoryResource;
class HistoriesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.HistoriesV4PagePaginationArray = HistoriesV4PagePaginationArray;
HistoryResource.HistoriesV4PagePaginationArray = HistoriesV4PagePaginationArray;
//# sourceMappingURL=history.js.map