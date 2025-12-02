import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Videos extends APIResource {
    /**
     * Returns information about an account's storage use.
     *
     * @example
     * ```ts
     * const response = await client.stream.videos.storageUsage({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    storageUsage(params: VideoStorageUsageParams, options?: Core.RequestOptions): Core.APIPromise<VideoStorageUsageResponse>;
}
export interface VideoStorageUsageResponse {
    /**
     * A user-defined identifier for the media creator.
     */
    creator?: string;
    /**
     * The total minutes of video content stored in the account.
     */
    totalStorageMinutes?: number;
    /**
     * The storage capacity alloted for the account.
     */
    totalStorageMinutesLimit?: number;
    /**
     * The total count of videos associated with the account.
     */
    videoCount?: number;
}
export interface VideoStorageUsageParams {
    /**
     * Path param: The account identifier tag.
     */
    account_id: string;
    /**
     * Query param: A user-defined identifier for the media creator.
     */
    creator?: string;
}
export declare namespace Videos {
    export { type VideoStorageUsageResponse as VideoStorageUsageResponse, type VideoStorageUsageParams as VideoStorageUsageParams, };
}
//# sourceMappingURL=videos.d.ts.map