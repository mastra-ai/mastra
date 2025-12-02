import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Downloads extends APIResource {
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
    get(feedId: number, params: DownloadGetParams, options?: Core.RequestOptions): Core.APIPromise<DownloadGetResponse>;
}
export interface DownloadGetResponse {
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
export interface DownloadGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace Downloads {
    export { type DownloadGetResponse as DownloadGetResponse, type DownloadGetParams as DownloadGetParams };
}
//# sourceMappingURL=downloads.d.ts.map