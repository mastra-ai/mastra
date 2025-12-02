import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Tags extends APIResource {
    /**
     * Create a tag
     *
     * @example
     * ```ts
     * const tag = await client.zeroTrust.access.tags.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params: TagCreateParams, options?: Core.RequestOptions): Core.APIPromise<Tag>;
    /**
     * Update a tag
     *
     * @example
     * ```ts
     * const tag = await client.zeroTrust.access.tags.update(
     *   'engineers',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'engineers',
     *   },
     * );
     * ```
     */
    update(tagName: string, params: TagUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Tag>;
    /**
     * List tags
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tag of client.zeroTrust.access.tags.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: TagListParams, options?: Core.RequestOptions): Core.PagePromise<TagsSinglePage, Tag>;
    /**
     * Delete a tag
     *
     * @example
     * ```ts
     * const tag = await client.zeroTrust.access.tags.delete(
     *   'engineers',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(tagName: string, params: TagDeleteParams, options?: Core.RequestOptions): Core.APIPromise<TagDeleteResponse>;
    /**
     * Get a tag
     *
     * @example
     * ```ts
     * const tag = await client.zeroTrust.access.tags.get(
     *   'engineers',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(tagName: string, params: TagGetParams, options?: Core.RequestOptions): Core.APIPromise<Tag>;
}
export declare class TagsSinglePage extends SinglePage<Tag> {
}
/**
 * A tag
 */
export interface Tag {
    /**
     * The name of the tag
     */
    name: string;
    /**
     * The number of applications that have this tag
     */
    app_count?: number;
    created_at?: string;
    updated_at?: string;
}
export interface TagDeleteResponse {
    /**
     * The name of the tag
     */
    name?: string;
}
export interface TagCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: The name of the tag
     */
    name?: string;
}
export interface TagUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: The name of the tag
     */
    name: string;
}
export interface TagListParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface TagDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface TagGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Tags {
    export { type Tag as Tag, type TagDeleteResponse as TagDeleteResponse, TagsSinglePage as TagsSinglePage, type TagCreateParams as TagCreateParams, type TagUpdateParams as TagUpdateParams, type TagListParams as TagListParams, type TagDeleteParams as TagDeleteParams, type TagGetParams as TagGetParams, };
}
//# sourceMappingURL=tags.d.ts.map