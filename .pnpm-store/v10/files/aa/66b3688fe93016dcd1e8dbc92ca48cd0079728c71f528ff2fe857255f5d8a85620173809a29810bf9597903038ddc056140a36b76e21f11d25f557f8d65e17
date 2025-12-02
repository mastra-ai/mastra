"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndicatorFeedListResponsesSinglePage = exports.IndicatorFeeds = void 0;
const resource_1 = require("../../../resource.js");
const DownloadsAPI = __importStar(require("./downloads.js"));
const downloads_1 = require("./downloads.js");
const PermissionsAPI = __importStar(require("./permissions.js"));
const permissions_1 = require("./permissions.js");
const SnapshotsAPI = __importStar(require("./snapshots.js"));
const snapshots_1 = require("./snapshots.js");
const pagination_1 = require("../../../pagination.js");
class IndicatorFeeds extends resource_1.APIResource {
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
exports.IndicatorFeeds = IndicatorFeeds;
class IndicatorFeedListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.IndicatorFeedListResponsesSinglePage = IndicatorFeedListResponsesSinglePage;
IndicatorFeeds.IndicatorFeedListResponsesSinglePage = IndicatorFeedListResponsesSinglePage;
IndicatorFeeds.Snapshots = snapshots_1.Snapshots;
IndicatorFeeds.Permissions = permissions_1.Permissions;
IndicatorFeeds.Downloads = downloads_1.Downloads;
//# sourceMappingURL=indicator-feeds.js.map