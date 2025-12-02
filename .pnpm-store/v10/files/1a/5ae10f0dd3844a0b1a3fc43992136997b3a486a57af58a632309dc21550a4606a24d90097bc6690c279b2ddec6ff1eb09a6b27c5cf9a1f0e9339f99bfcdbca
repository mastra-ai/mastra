// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Downloads extends APIResource {
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
//# sourceMappingURL=downloads.mjs.map