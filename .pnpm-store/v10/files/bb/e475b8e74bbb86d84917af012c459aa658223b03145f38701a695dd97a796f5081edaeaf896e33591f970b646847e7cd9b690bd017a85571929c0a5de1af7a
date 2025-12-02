import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as DownloadsAPI from "./downloads.js";
import { DownloadGetParams, DownloadGetResponse, Downloads } from "./downloads.js";
import * as PermissionsAPI from "./permissions.js";
import { PermissionCreateParams, PermissionCreateResponse, PermissionDeleteParams, PermissionDeleteResponse, PermissionListParams, PermissionListResponse, Permissions } from "./permissions.js";
import * as SnapshotsAPI from "./snapshots.js";
import { SnapshotUpdateParams, SnapshotUpdateResponse, Snapshots } from "./snapshots.js";
import { SinglePage } from "../../../pagination.js";
export declare class IndicatorFeeds extends APIResource {
    snapshots: SnapshotsAPI.Snapshots;
    permissions: PermissionsAPI.Permissions;
    downloads: DownloadsAPI.Downloads;
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
    create(params: IndicatorFeedCreateParams, options?: Core.RequestOptions): Core.APIPromise<IndicatorFeedCreateResponse>;
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
    update(feedId: number, params: IndicatorFeedUpdateParams, options?: Core.RequestOptions): Core.APIPromise<IndicatorFeedUpdateResponse>;
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
    list(params: IndicatorFeedListParams, options?: Core.RequestOptions): Core.PagePromise<IndicatorFeedListResponsesSinglePage, IndicatorFeedListResponse>;
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
    data(feedId: number, params: IndicatorFeedDataParams, options?: Core.RequestOptions): Core.APIPromise<string>;
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
    get(feedId: number, params: IndicatorFeedGetParams, options?: Core.RequestOptions): Core.APIPromise<IndicatorFeedGetResponse>;
}
export declare class IndicatorFeedListResponsesSinglePage extends SinglePage<IndicatorFeedListResponse> {
}
export interface IndicatorFeedCreateResponse {
    /**
     * The unique identifier for the indicator feed
     */
    id?: number;
    /**
     * The date and time when the data entry was created
     */
    created_on?: string;
    /**
     * The description of the example test
     */
    description?: string;
    /**
     * Whether the indicator feed can be attributed to a provider
     */
    is_attributable?: boolean;
    /**
     * Whether the indicator feed can be downloaded
     */
    is_downloadable?: boolean;
    /**
     * Whether the indicator feed is exposed to customers
     */
    is_public?: boolean;
    /**
     * The date and time when the data entry was last modified
     */
    modified_on?: string;
    /**
     * The name of the indicator feed
     */
    name?: string;
}
export interface IndicatorFeedUpdateResponse {
    /**
     * The unique identifier for the indicator feed
     */
    id?: number;
    /**
     * The date and time when the data entry was created
     */
    created_on?: string;
    /**
     * The description of the example test
     */
    description?: string;
    /**
     * Whether the indicator feed can be attributed to a provider
     */
    is_attributable?: boolean;
    /**
     * Whether the indicator feed can be downloaded
     */
    is_downloadable?: boolean;
    /**
     * Whether the indicator feed is exposed to customers
     */
    is_public?: boolean;
    /**
     * The date and time when the data entry was last modified
     */
    modified_on?: string;
    /**
     * The name of the indicator feed
     */
    name?: string;
}
export interface IndicatorFeedListResponse {
    /**
     * The unique identifier for the indicator feed
     */
    id?: number;
    /**
     * The date and time when the data entry was created
     */
    created_on?: string;
    /**
     * The description of the example test
     */
    description?: string;
    /**
     * Whether the indicator feed can be attributed to a provider
     */
    is_attributable?: boolean;
    /**
     * Whether the indicator feed can be downloaded
     */
    is_downloadable?: boolean;
    /**
     * Whether the indicator feed is exposed to customers
     */
    is_public?: boolean;
    /**
     * The date and time when the data entry was last modified
     */
    modified_on?: string;
    /**
     * The name of the indicator feed
     */
    name?: string;
}
export type IndicatorFeedDataResponse = string;
export interface IndicatorFeedGetResponse {
    /**
     * The unique identifier for the indicator feed
     */
    id?: number;
    /**
     * The date and time when the data entry was created
     */
    created_on?: string;
    /**
     * The description of the example test
     */
    description?: string;
    /**
     * Whether the indicator feed can be attributed to a provider
     */
    is_attributable?: boolean;
    /**
     * Whether the indicator feed can be downloaded
     */
    is_downloadable?: boolean;
    /**
     * Whether the indicator feed is exposed to customers
     */
    is_public?: boolean;
    /**
     * Status of the latest snapshot uploaded
     */
    latest_upload_status?: 'Mirroring' | 'Unifying' | 'Loading' | 'Provisioning' | 'Complete' | 'Error';
    /**
     * The date and time when the data entry was last modified
     */
    modified_on?: string;
    /**
     * The name of the indicator feed
     */
    name?: string;
    /**
     * The unique identifier for the provider
     */
    provider_id?: string;
    /**
     * The provider of the indicator feed
     */
    provider_name?: string;
}
export interface IndicatorFeedCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: The description of the example test
     */
    description?: string;
    /**
     * Body param: The name of the indicator feed
     */
    name?: string;
}
export interface IndicatorFeedUpdateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: The new description of the feed
     */
    description?: string;
    /**
     * Body param: The new is_attributable value of the feed
     */
    is_attributable?: boolean;
    /**
     * Body param: The new is_downloadable value of the feed
     */
    is_downloadable?: boolean;
    /**
     * Body param: The new is_public value of the feed
     */
    is_public?: boolean;
    /**
     * Body param: The new name of the feed
     */
    name?: string;
}
export interface IndicatorFeedListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface IndicatorFeedDataParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface IndicatorFeedGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace IndicatorFeeds {
    export { type IndicatorFeedCreateResponse as IndicatorFeedCreateResponse, type IndicatorFeedUpdateResponse as IndicatorFeedUpdateResponse, type IndicatorFeedListResponse as IndicatorFeedListResponse, type IndicatorFeedDataResponse as IndicatorFeedDataResponse, type IndicatorFeedGetResponse as IndicatorFeedGetResponse, IndicatorFeedListResponsesSinglePage as IndicatorFeedListResponsesSinglePage, type IndicatorFeedCreateParams as IndicatorFeedCreateParams, type IndicatorFeedUpdateParams as IndicatorFeedUpdateParams, type IndicatorFeedListParams as IndicatorFeedListParams, type IndicatorFeedDataParams as IndicatorFeedDataParams, type IndicatorFeedGetParams as IndicatorFeedGetParams, };
    export { Snapshots as Snapshots, type SnapshotUpdateResponse as SnapshotUpdateResponse, type SnapshotUpdateParams as SnapshotUpdateParams, };
    export { Permissions as Permissions, type PermissionCreateResponse as PermissionCreateResponse, type PermissionListResponse as PermissionListResponse, type PermissionDeleteResponse as PermissionDeleteResponse, type PermissionCreateParams as PermissionCreateParams, type PermissionListParams as PermissionListParams, type PermissionDeleteParams as PermissionDeleteParams, };
    export { Downloads as Downloads, type DownloadGetResponse as DownloadGetResponse, type DownloadGetParams as DownloadGetParams, };
}
//# sourceMappingURL=indicator-feeds.d.ts.map