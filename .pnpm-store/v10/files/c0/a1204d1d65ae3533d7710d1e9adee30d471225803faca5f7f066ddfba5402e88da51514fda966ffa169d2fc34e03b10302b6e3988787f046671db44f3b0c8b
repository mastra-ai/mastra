import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Categories extends APIResource {
    /**
     * Creates a new category
     *
     * @example
     * ```ts
     * const category =
     *   await client.cloudforceOne.threatEvents.categories.create(
     *     {
     *       account_id: 'account_id',
     *       killChain: 0,
     *       name: 'name',
     *     },
     *   );
     * ```
     */
    create(params: CategoryCreateParams, options?: Core.RequestOptions): Core.APIPromise<CategoryCreateResponse>;
    /**
     * Lists categories
     *
     * @example
     * ```ts
     * const categories =
     *   await client.cloudforceOne.threatEvents.categories.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params: CategoryListParams, options?: Core.RequestOptions): Core.APIPromise<CategoryListResponse>;
    /**
     * Deletes a category
     *
     * @example
     * ```ts
     * const category =
     *   await client.cloudforceOne.threatEvents.categories.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(categoryId: string, params: CategoryDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CategoryDeleteResponse>;
    /**
     * Updates a category
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.categories.edit(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    edit(categoryId: string, params: CategoryEditParams, options?: Core.RequestOptions): Core.APIPromise<CategoryEditResponse>;
    /**
     * Reads a category
     *
     * @example
     * ```ts
     * const category =
     *   await client.cloudforceOne.threatEvents.categories.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(categoryId: string, params: CategoryGetParams, options?: Core.RequestOptions): Core.APIPromise<CategoryGetResponse>;
}
export interface CategoryCreateResponse {
    killChain: number;
    name: string;
    uuid: string;
    mitreAttack?: Array<string>;
    shortname?: string;
}
export type CategoryListResponse = Array<CategoryListResponse.CategoryListResponseItem>;
export declare namespace CategoryListResponse {
    interface CategoryListResponseItem {
        killChain: number;
        name: string;
        uuid: string;
        mitreAttack?: Array<string>;
        shortname?: string;
    }
}
export interface CategoryDeleteResponse {
    uuid: string;
}
export interface CategoryEditResponse {
    killChain: number;
    name: string;
    uuid: string;
    mitreAttack?: Array<string>;
    shortname?: string;
}
export interface CategoryGetResponse {
    killChain: number;
    name: string;
    uuid: string;
    mitreAttack?: Array<string>;
    shortname?: string;
}
export interface CategoryCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    killChain: number;
    /**
     * Body param:
     */
    name: string;
    /**
     * Body param:
     */
    mitreAttack?: Array<string>;
    /**
     * Body param:
     */
    shortname?: string;
}
export interface CategoryListParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export interface CategoryDeleteParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export interface CategoryEditParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    killChain?: number;
    /**
     * Body param:
     */
    mitreAttack?: Array<string>;
    /**
     * Body param:
     */
    name?: string;
    /**
     * Body param:
     */
    shortname?: string;
}
export interface CategoryGetParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Categories {
    export { type CategoryCreateResponse as CategoryCreateResponse, type CategoryListResponse as CategoryListResponse, type CategoryDeleteResponse as CategoryDeleteResponse, type CategoryEditResponse as CategoryEditResponse, type CategoryGetResponse as CategoryGetResponse, type CategoryCreateParams as CategoryCreateParams, type CategoryListParams as CategoryListParams, type CategoryDeleteParams as CategoryDeleteParams, type CategoryEditParams as CategoryEditParams, type CategoryGetParams as CategoryGetParams, };
}
//# sourceMappingURL=categories.d.ts.map