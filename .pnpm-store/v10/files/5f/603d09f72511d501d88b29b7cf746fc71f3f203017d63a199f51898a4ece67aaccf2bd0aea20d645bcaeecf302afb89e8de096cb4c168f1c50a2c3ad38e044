// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
export class Snapshots extends APIResource {
    /**
     * Update indicator feed data
     *
     * @example
     * ```ts
     * const snapshot =
     *   await client.intel.indicatorFeeds.snapshots.update(12, {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    update(feedId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/intel/indicator-feeds/${feedId}/snapshot`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=snapshots.mjs.map