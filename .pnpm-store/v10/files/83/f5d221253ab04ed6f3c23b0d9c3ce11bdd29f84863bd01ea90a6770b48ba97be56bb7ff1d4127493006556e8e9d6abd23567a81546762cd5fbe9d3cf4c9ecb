import { APIResource } from "../resource.js";
import * as Core from "../core.js";
import { SinglePage } from "../pagination.js";
export declare class CustomPages extends APIResource {
    /**
     * Updates the configuration of an existing custom page.
     *
     * @example
     * ```ts
     * const customPage = await client.customPages.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     state: 'default',
     *     url: 'http://www.example.com',
     *     account_id: 'account_id',
     *   },
     * );
     * ```
     */
    update(identifier: string, params: CustomPageUpdateParams, options?: Core.RequestOptions): Core.APIPromise<CustomPageUpdateResponse | null>;
    /**
     * Fetches all the custom pages.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customPageListResponse of client.customPages.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params?: CustomPageListParams, options?: Core.RequestOptions): Core.PagePromise<CustomPageListResponsesSinglePage, CustomPageListResponse>;
    list(options?: Core.RequestOptions): Core.PagePromise<CustomPageListResponsesSinglePage, CustomPageListResponse>;
    /**
     * Fetches the details of a custom page.
     *
     * @example
     * ```ts
     * const customPage = await client.customPages.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(identifier: string, params?: CustomPageGetParams, options?: Core.RequestOptions): Core.APIPromise<CustomPageGetResponse | null>;
    get(identifier: string, options?: Core.RequestOptions): Core.APIPromise<CustomPageGetResponse | null>;
}
export declare class CustomPageListResponsesSinglePage extends SinglePage<CustomPageListResponse> {
}
export type CustomPageUpdateResponse = unknown | string;
export type CustomPageListResponse = unknown;
export type CustomPageGetResponse = unknown | string;
export interface CustomPageUpdateParams {
    /**
     * Body param: The custom page state.
     */
    state: 'default' | 'customized';
    /**
     * Body param: The URL associated with the custom page.
     */
    url: string;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
}
export interface CustomPageListParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface CustomPageGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace CustomPages {
    export { type CustomPageUpdateResponse as CustomPageUpdateResponse, type CustomPageListResponse as CustomPageListResponse, type CustomPageGetResponse as CustomPageGetResponse, CustomPageListResponsesSinglePage as CustomPageListResponsesSinglePage, type CustomPageUpdateParams as CustomPageUpdateParams, type CustomPageListParams as CustomPageListParams, type CustomPageGetParams as CustomPageGetParams, };
}
//# sourceMappingURL=custom-pages.d.ts.map