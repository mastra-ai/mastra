import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Downloads extends APIResource {
    /**
     * Creates a download for a video when a video is ready to view.
     *
     * @example
     * ```ts
     * const download = await client.stream.downloads.create(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   },
     * );
     * ```
     */
    create(identifier: string, params: DownloadCreateParams, options?: Core.RequestOptions): Core.APIPromise<DownloadCreateResponse>;
    /**
     * Delete the downloads for a video.
     *
     * @example
     * ```ts
     * const download = await client.stream.downloads.delete(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier: string, params: DownloadDeleteParams, options?: Core.RequestOptions): Core.APIPromise<DownloadDeleteResponse>;
    /**
     * Lists the downloads created for a video.
     *
     * @example
     * ```ts
     * const download = await client.stream.downloads.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier: string, params: DownloadGetParams, options?: Core.RequestOptions): Core.APIPromise<DownloadGetResponse>;
}
export type DownloadCreateResponse = unknown;
export type DownloadDeleteResponse = string;
export type DownloadGetResponse = unknown;
export interface DownloadCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface DownloadDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface DownloadGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Downloads {
    export { type DownloadCreateResponse as DownloadCreateResponse, type DownloadDeleteResponse as DownloadDeleteResponse, type DownloadGetResponse as DownloadGetResponse, type DownloadCreateParams as DownloadCreateParams, type DownloadDeleteParams as DownloadDeleteParams, type DownloadGetParams as DownloadGetParams, };
}
//# sourceMappingURL=downloads.d.ts.map