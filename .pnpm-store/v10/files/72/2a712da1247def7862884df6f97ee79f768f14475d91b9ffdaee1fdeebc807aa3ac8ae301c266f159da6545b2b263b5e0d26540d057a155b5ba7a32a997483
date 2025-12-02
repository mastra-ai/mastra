import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../../pagination.js";
export declare class Views extends APIResource {
    /**
     * Create Internal DNS View for an account
     *
     * @example
     * ```ts
     * const view = await client.dns.settings.account.views.create(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'my view',
     *     zones: ['372e67954025e0ba6aaa6d586b9e0b59'],
     *   },
     * );
     * ```
     */
    create(params: ViewCreateParams, options?: Core.RequestOptions): Core.APIPromise<ViewCreateResponse>;
    /**
     * List DNS Internal Views for an Account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const viewListResponse of client.dns.settings.account.views.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: ViewListParams, options?: Core.RequestOptions): Core.PagePromise<ViewListResponsesV4PagePaginationArray, ViewListResponse>;
    /**
     * Delete an existing Internal DNS View
     *
     * @example
     * ```ts
     * const view = await client.dns.settings.account.views.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(viewId: string, params: ViewDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ViewDeleteResponse>;
    /**
     * Update an existing Internal DNS View
     *
     * @example
     * ```ts
     * const response =
     *   await client.dns.settings.account.views.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(viewId: string, params: ViewEditParams, options?: Core.RequestOptions): Core.APIPromise<ViewEditResponse>;
    /**
     * Get DNS Internal View
     *
     * @example
     * ```ts
     * const view = await client.dns.settings.account.views.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(viewId: string, params: ViewGetParams, options?: Core.RequestOptions): Core.APIPromise<ViewGetResponse>;
}
export declare class ViewListResponsesV4PagePaginationArray extends V4PagePaginationArray<ViewListResponse> {
}
export interface ViewCreateResponse {
    /**
     * Identifier.
     */
    id: string;
    /**
     * When the view was created.
     */
    created_time: string;
    /**
     * When the view was last modified.
     */
    modified_time: string;
    /**
     * The name of the view.
     */
    name: string;
    /**
     * The list of zones linked to this view.
     */
    zones: Array<string>;
}
export interface ViewListResponse {
    /**
     * Identifier.
     */
    id: string;
    /**
     * When the view was created.
     */
    created_time: string;
    /**
     * When the view was last modified.
     */
    modified_time: string;
    /**
     * The name of the view.
     */
    name: string;
    /**
     * The list of zones linked to this view.
     */
    zones: Array<string>;
}
export interface ViewDeleteResponse {
    /**
     * Identifier.
     */
    id?: string;
}
export interface ViewEditResponse {
    /**
     * Identifier.
     */
    id: string;
    /**
     * When the view was created.
     */
    created_time: string;
    /**
     * When the view was last modified.
     */
    modified_time: string;
    /**
     * The name of the view.
     */
    name: string;
    /**
     * The list of zones linked to this view.
     */
    zones: Array<string>;
}
export interface ViewGetResponse {
    /**
     * Identifier.
     */
    id: string;
    /**
     * When the view was created.
     */
    created_time: string;
    /**
     * When the view was last modified.
     */
    modified_time: string;
    /**
     * The name of the view.
     */
    name: string;
    /**
     * The list of zones linked to this view.
     */
    zones: Array<string>;
}
export interface ViewCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: The name of the view.
     */
    name: string;
    /**
     * Body param: The list of zones linked to this view.
     */
    zones: Array<string>;
}
export interface ViewListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param: Direction to order DNS views in.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Whether to match all search requirements or at least one (any). If
     * set to `all`, acts like a logical AND between filters. If set to `any`, acts
     * like a logical OR instead.
     */
    match?: 'any' | 'all';
    /**
     * Query param:
     */
    name?: ViewListParams.Name;
    /**
     * Query param: Field to order DNS views by.
     */
    order?: 'name' | 'created_on' | 'modified_on';
    /**
     * Query param: A zone ID that exists in the zones list for the view.
     */
    zone_id?: string;
    /**
     * Query param: A zone name that exists in the zones list for the view.
     */
    zone_name?: string;
}
export declare namespace ViewListParams {
    interface Name {
        /**
         * Substring of the DNS view name.
         */
        contains?: string;
        /**
         * Suffix of the DNS view name.
         */
        endswith?: string;
        /**
         * Exact value of the DNS view name.
         */
        exact?: string;
        /**
         * Prefix of the DNS view name.
         */
        startswith?: string;
    }
}
export interface ViewDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface ViewEditParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: The name of the view.
     */
    name?: string;
    /**
     * Body param: The list of zones linked to this view.
     */
    zones?: Array<string>;
}
export interface ViewGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Views {
    export { type ViewCreateResponse as ViewCreateResponse, type ViewListResponse as ViewListResponse, type ViewDeleteResponse as ViewDeleteResponse, type ViewEditResponse as ViewEditResponse, type ViewGetResponse as ViewGetResponse, ViewListResponsesV4PagePaginationArray as ViewListResponsesV4PagePaginationArray, type ViewCreateParams as ViewCreateParams, type ViewListParams as ViewListParams, type ViewDeleteParams as ViewDeleteParams, type ViewEditParams as ViewEditParams, type ViewGetParams as ViewGetParams, };
}
//# sourceMappingURL=views.d.ts.map