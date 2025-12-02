import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Assets extends APIResource {
    /**
     * List Request Assets
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const assetCreateResponse of client.cloudforceOne.requests.assets.create(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     page: 0,
     *     per_page: 10,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(requestId: string, params: AssetCreateParams, options?: Core.RequestOptions): Core.PagePromise<AssetCreateResponsesSinglePage, AssetCreateResponse>;
    /**
     * Update a Request Asset
     *
     * @example
     * ```ts
     * const asset =
     *   await client.cloudforceOne.requests.assets.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(requestId: string, assetId: string, params: AssetUpdateParams, options?: Core.RequestOptions): Core.APIPromise<AssetUpdateResponse>;
    /**
     * Delete a Request Asset
     *
     * @example
     * ```ts
     * const asset =
     *   await client.cloudforceOne.requests.assets.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(requestId: string, assetId: string, params: AssetDeleteParams, options?: Core.RequestOptions): Core.APIPromise<AssetDeleteResponse>;
    /**
     * Get a Request Asset
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const assetGetResponse of client.cloudforceOne.requests.assets.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(requestId: string, assetId: string, params: AssetGetParams, options?: Core.RequestOptions): Core.PagePromise<AssetGetResponsesSinglePage, AssetGetResponse>;
}
export declare class AssetCreateResponsesSinglePage extends SinglePage<AssetCreateResponse> {
}
export declare class AssetGetResponsesSinglePage extends SinglePage<AssetGetResponse> {
}
export interface AssetCreateResponse {
    /**
     * Asset ID.
     */
    id: number;
    /**
     * Asset name.
     */
    name: string;
    /**
     * Defines the asset creation time.
     */
    created?: string;
    /**
     * Asset description.
     */
    description?: string;
    /**
     * Asset file type.
     */
    file_type?: string;
}
export interface AssetUpdateResponse {
    /**
     * Asset ID.
     */
    id: number;
    /**
     * Asset name.
     */
    name: string;
    /**
     * Defines the asset creation time.
     */
    created?: string;
    /**
     * Asset description.
     */
    description?: string;
    /**
     * Asset file type.
     */
    file_type?: string;
}
export interface AssetDeleteResponse {
    errors: Array<AssetDeleteResponse.Error>;
    messages: Array<AssetDeleteResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export declare namespace AssetDeleteResponse {
    interface Error {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Error.Source;
    }
    namespace Error {
        interface Source {
            pointer?: string;
        }
    }
    interface Message {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Message.Source;
    }
    namespace Message {
        interface Source {
            pointer?: string;
        }
    }
}
export interface AssetGetResponse {
    /**
     * Asset ID.
     */
    id: number;
    /**
     * Asset name.
     */
    name: string;
    /**
     * Defines the asset creation time.
     */
    created?: string;
    /**
     * Asset description.
     */
    description?: string;
    /**
     * Asset file type.
     */
    file_type?: string;
}
export interface AssetCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: Page number of results.
     */
    page: number;
    /**
     * Body param: Number of results per page.
     */
    per_page: number;
}
export interface AssetUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: Asset file to upload.
     */
    source?: string;
}
export interface AssetDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface AssetGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Assets {
    export { type AssetCreateResponse as AssetCreateResponse, type AssetUpdateResponse as AssetUpdateResponse, type AssetDeleteResponse as AssetDeleteResponse, type AssetGetResponse as AssetGetResponse, AssetCreateResponsesSinglePage as AssetCreateResponsesSinglePage, AssetGetResponsesSinglePage as AssetGetResponsesSinglePage, type AssetCreateParams as AssetCreateParams, type AssetUpdateParams as AssetUpdateParams, type AssetDeleteParams as AssetDeleteParams, type AssetGetParams as AssetGetParams, };
}
//# sourceMappingURL=assets.d.ts.map