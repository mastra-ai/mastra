// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class HistoryResource extends APIResource {
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
export class HistoriesV4PagePaginationArray extends V4PagePaginationArray {
}
HistoryResource.HistoriesV4PagePaginationArray = HistoriesV4PagePaginationArray;
//# sourceMappingURL=history.mjs.map