import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as SecretsAPI from "./secrets.js";
import { SecretBulkDeleteParams, SecretBulkDeleteResponse, SecretBulkDeleteResponsesSinglePage, SecretCreateParams, SecretCreateResponse, SecretCreateResponsesSinglePage, SecretDeleteParams, SecretDeleteResponse, SecretDuplicateParams, SecretDuplicateResponse, SecretEditParams, SecretEditResponse, SecretGetParams, SecretGetResponse, SecretListParams, SecretListResponse, SecretListResponsesV4PagePaginationArray, Secrets } from "./secrets.js";
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Stores extends APIResource {
    secrets: SecretsAPI.Secrets;
    /**
     * Creates a store in the account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const storeCreateResponse of client.secretsStore.stores.create(
     *   {
     *     account_id: '985e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{ name: 'service_x_keys' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(params: StoreCreateParams, options?: Core.RequestOptions): Core.PagePromise<StoreCreateResponsesSinglePage, StoreCreateResponse>;
    /**
     * Lists all the stores in an account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const storeListResponse of client.secretsStore.stores.list(
     *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: StoreListParams, options?: Core.RequestOptions): Core.PagePromise<StoreListResponsesV4PagePaginationArray, StoreListResponse>;
    /**
     * Deletes a single store
     *
     * @example
     * ```ts
     * const store = await client.secretsStore.stores.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(storeId: string, params: StoreDeleteParams, options?: Core.RequestOptions): Core.APIPromise<StoreDeleteResponse>;
}
export declare class StoreCreateResponsesSinglePage extends SinglePage<StoreCreateResponse> {
}
export declare class StoreListResponsesV4PagePaginationArray extends V4PagePaginationArray<StoreListResponse> {
}
export interface StoreCreateResponse {
    /**
     * Store Identifier
     */
    id: string;
    /**
     * Whenthe secret was created.
     */
    created: string;
    /**
     * When the secret was modified.
     */
    modified: string;
    /**
     * The name of the store
     */
    name: string;
}
export interface StoreListResponse {
    /**
     * Store Identifier
     */
    id: string;
    /**
     * Whenthe secret was created.
     */
    created: string;
    /**
     * When the secret was modified.
     */
    modified: string;
    /**
     * The name of the store
     */
    name: string;
}
export interface StoreDeleteResponse {
    /**
     * Store Identifier
     */
    id: string;
    /**
     * Whenthe secret was created.
     */
    created: string;
    /**
     * When the secret was modified.
     */
    modified: string;
    /**
     * The name of the store
     */
    name: string;
}
export interface StoreCreateParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    body: Array<StoreCreateParams.Body>;
}
export declare namespace StoreCreateParams {
    interface Body {
        /**
         * The name of the store
         */
        name: string;
    }
}
export interface StoreListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Query param: Direction to sort objects
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Order secrets by values in the given field
     */
    order?: 'name' | 'comment' | 'created' | 'modified' | 'status';
}
export interface StoreDeleteParams {
    /**
     * Account Identifier
     */
    account_id: string;
}
export declare namespace Stores {
    export { type StoreCreateResponse as StoreCreateResponse, type StoreListResponse as StoreListResponse, type StoreDeleteResponse as StoreDeleteResponse, StoreCreateResponsesSinglePage as StoreCreateResponsesSinglePage, StoreListResponsesV4PagePaginationArray as StoreListResponsesV4PagePaginationArray, type StoreCreateParams as StoreCreateParams, type StoreListParams as StoreListParams, type StoreDeleteParams as StoreDeleteParams, };
    export { Secrets as Secrets, type SecretCreateResponse as SecretCreateResponse, type SecretListResponse as SecretListResponse, type SecretDeleteResponse as SecretDeleteResponse, type SecretBulkDeleteResponse as SecretBulkDeleteResponse, type SecretDuplicateResponse as SecretDuplicateResponse, type SecretEditResponse as SecretEditResponse, type SecretGetResponse as SecretGetResponse, SecretCreateResponsesSinglePage as SecretCreateResponsesSinglePage, SecretListResponsesV4PagePaginationArray as SecretListResponsesV4PagePaginationArray, SecretBulkDeleteResponsesSinglePage as SecretBulkDeleteResponsesSinglePage, type SecretCreateParams as SecretCreateParams, type SecretListParams as SecretListParams, type SecretDeleteParams as SecretDeleteParams, type SecretBulkDeleteParams as SecretBulkDeleteParams, type SecretDuplicateParams as SecretDuplicateParams, type SecretEditParams as SecretEditParams, type SecretGetParams as SecretGetParams, };
}
//# sourceMappingURL=stores.d.ts.map