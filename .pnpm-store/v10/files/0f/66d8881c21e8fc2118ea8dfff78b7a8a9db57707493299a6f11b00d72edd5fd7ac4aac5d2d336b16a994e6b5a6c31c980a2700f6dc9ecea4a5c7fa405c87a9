// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as DownloadsAPI from "./downloads.mjs";
import { Downloads } from "./downloads.mjs";
import * as PermissionsAPI from "./permissions.mjs";
import { Permissions, } from "./permissions.mjs";
import * as SnapshotsAPI from "./snapshots.mjs";
import { Snapshots } from "./snapshots.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class IndicatorFeeds extends APIResource {
    constructor() {
        super(...arguments);
        this.snapshots = new SnapshotsAPI.Snapshots(this._client);
        this.permissions = new PermissionsAPI.Permissions(this._client);
        this.downloads = new DownloadsAPI.Downloads(this._client);
    }
    /**
     * Create new indicator feed
     *
     * @example
     * ```ts
     * const indicatorFeed =
     *   await client.intel.indicatorFeeds.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/intel/indicator-feeds`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update indicator feed metadata
     *
     * @example
     * ```ts
     * const indicatorFeed =
     *   await client.intel.indicatorFeeds.update(12, {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    update(feedId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/intel/indicator-feeds/${feedId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get indicator feeds owned by this account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const indicatorFeedListResponse of client.intel.indicatorFeeds.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/intel/indicator-feeds`, IndicatorFeedListResponsesSinglePage, options);
    }
    /**
     * Get indicator feed data
     *
     * @example
     * ```ts
     * const response = await client.intel.indicatorFeeds.data(
     *   12,
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    data(feedId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/intel/indicator-feeds/${feedId}/data`, {
            ...options,
            headers: { Accept: 'text/csv', ...options?.headers },
        });
    }
    /**
     * Get indicator feed metadata
     *
     * @example
     * ```ts
     * const indicatorFeed = await client.intel.indicatorFeeds.get(
     *   12,
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(feedId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/intel/indicator-feeds/${feedId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class IndicatorFeedListResponsesSinglePage extends SinglePage {
}
IndicatorFeeds.IndicatorFeedListResponsesSinglePage = IndicatorFeedListResponsesSinglePage;
IndicatorFeeds.Snapshots = Snapshots;
IndicatorFeeds.Permissions = Permissions;
IndicatorFeeds.Downloads = Downloads;
//# sourceMappingURL=indicator-feeds.mjs.map