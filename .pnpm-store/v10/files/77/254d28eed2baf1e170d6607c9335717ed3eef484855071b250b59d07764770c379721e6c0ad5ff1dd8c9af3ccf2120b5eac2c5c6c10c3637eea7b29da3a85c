import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Snapshots extends APIResource {
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
    update(feedId: number, params: SnapshotUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SnapshotUpdateResponse>;
}
export interface SnapshotUpdateResponse {
    /**
     * Feed id
     */
    file_id?: number;
    /**
     * Name of the file unified in our system
     */
    filename?: string;
    /**
     * Current status of upload, should be unified
     */
    status?: string;
}
export interface SnapshotUpdateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: The file to upload
     */
    source?: string;
}
export declare namespace Snapshots {
    export { type SnapshotUpdateResponse as SnapshotUpdateResponse, type SnapshotUpdateParams as SnapshotUpdateParams, };
}
//# sourceMappingURL=snapshots.d.ts.map