import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import * as EntriesAPI from "./entries.js";
import { Entries, EntryCreateParams, EntryCreateResponse, EntryDeleteParams, EntryDeleteResponse, EntryGetParams, EntryGetResponse, EntryListParams, EntryListResponse, EntryUpdateParams, EntryUpdateResponse } from "./entries.js";
export declare class ContentLists extends APIResource {
    entries: EntriesAPI.Entries;
    /**
     * Update IPFS Universal Path Gateway Content List
     *
     * @example
     * ```ts
     * const contentList =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       action: 'block',
     *       entries: [{}],
     *     },
     *   );
     * ```
     */
    update(identifier: string, params: ContentListUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ContentList>;
    /**
     * IPFS Universal Path Gateway Content List Details
     *
     * @example
     * ```ts
     * const contentList =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(identifier: string, params: ContentListGetParams, options?: Core.RequestOptions): Core.APIPromise<ContentList>;
}
export interface ContentList {
    /**
     * Behavior of the content list.
     */
    action?: 'block';
}
export interface ContentListUpdateParams {
    /**
     * Path param: Specify the identifier of the hostname.
     */
    zone_id: string;
    /**
     * Body param: Behavior of the content list.
     */
    action: 'block';
    /**
     * Body param: Provides content list entries.
     */
    entries: Array<ContentListUpdateParams.Entry>;
}
export declare namespace ContentListUpdateParams {
    /**
     * Specify a content list entry to block.
     */
    interface Entry {
        /**
         * Specify the CID or content path of content to block.
         */
        content?: string;
        /**
         * Specify an optional description of the content list entry.
         */
        description?: string;
        /**
         * Specify the type of content list entry to block.
         */
        type?: 'cid' | 'content_path';
    }
}
export interface ContentListGetParams {
    /**
     * Specify the identifier of the hostname.
     */
    zone_id: string;
}
export declare namespace ContentLists {
    export { type ContentList as ContentList, type ContentListUpdateParams as ContentListUpdateParams, type ContentListGetParams as ContentListGetParams, };
    export { Entries as Entries, type EntryCreateResponse as EntryCreateResponse, type EntryUpdateResponse as EntryUpdateResponse, type EntryListResponse as EntryListResponse, type EntryDeleteResponse as EntryDeleteResponse, type EntryGetResponse as EntryGetResponse, type EntryCreateParams as EntryCreateParams, type EntryUpdateParams as EntryUpdateParams, type EntryListParams as EntryListParams, type EntryDeleteParams as EntryDeleteParams, type EntryGetParams as EntryGetParams, };
}
//# sourceMappingURL=content-lists.d.ts.map