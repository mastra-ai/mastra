import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as ItemsAPI from "./items.js";
import { ItemListParams, ItemListResponse, ItemListResponsesSinglePage, Items } from "./items.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Lists extends APIResource {
    items: ItemsAPI.Items;
    /**
     * Creates a new Zero Trust list.
     *
     * @example
     * ```ts
     * const list = await client.zeroTrust.gateway.lists.create({
     *   account_id: '699d98642c564d2e855e9661899b7252',
     *   name: 'Admin Serial Numbers',
     *   type: 'SERIAL',
     * });
     * ```
     */
    create(params: ListCreateParams, options?: Core.RequestOptions): Core.APIPromise<ListCreateResponse>;
    /**
     * Updates a configured Zero Trust list. Skips updating list items if not included
     * in the payload.
     *
     * @example
     * ```ts
     * const gatewayList =
     *   await client.zeroTrust.gateway.lists.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       name: 'Admin Serial Numbers',
     *     },
     *   );
     * ```
     */
    update(listId: string, params: ListUpdateParams, options?: Core.RequestOptions): Core.APIPromise<GatewayList>;
    /**
     * Fetches all Zero Trust lists for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const gatewayList of client.zeroTrust.gateway.lists.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: ListListParams, options?: Core.RequestOptions): Core.PagePromise<GatewayListsSinglePage, GatewayList>;
    /**
     * Deletes a Zero Trust list.
     *
     * @example
     * ```ts
     * const list = await client.zeroTrust.gateway.lists.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    delete(listId: string, params: ListDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ListDeleteResponse>;
    /**
     * Appends or removes an item from a configured Zero Trust list.
     *
     * @example
     * ```ts
     * const gatewayList =
     *   await client.zeroTrust.gateway.lists.edit(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(listId: string, params: ListEditParams, options?: Core.RequestOptions): Core.APIPromise<GatewayList>;
    /**
     * Fetches a single Zero Trust list.
     *
     * @example
     * ```ts
     * const gatewayList =
     *   await client.zeroTrust.gateway.lists.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(listId: string, params: ListGetParams, options?: Core.RequestOptions): Core.APIPromise<GatewayList>;
}
export declare class GatewayListsSinglePage extends SinglePage<GatewayList> {
}
export interface GatewayItem {
    created_at?: string;
    /**
     * The description of the list item, if present
     */
    description?: string;
    /**
     * The value of the item in a list.
     */
    value?: string;
}
export interface GatewayList {
    /**
     * API Resource UUID tag.
     */
    id?: string;
    /**
     * The number of items in the list.
     */
    count?: number;
    created_at?: string;
    /**
     * The description of the list.
     */
    description?: string;
    /**
     * The items in the list.
     */
    items?: Array<GatewayItem>;
    /**
     * The name of the list.
     */
    name?: string;
    /**
     * The type of list.
     */
    type?: 'SERIAL' | 'URL' | 'DOMAIN' | 'EMAIL' | 'IP';
    updated_at?: string;
}
export interface ListCreateResponse {
    /**
     * API Resource UUID tag.
     */
    id?: string;
    created_at?: string;
    /**
     * The description of the list.
     */
    description?: string;
    /**
     * The items in the list.
     */
    items?: Array<GatewayItem>;
    /**
     * The name of the list.
     */
    name?: string;
    /**
     * The type of list.
     */
    type?: 'SERIAL' | 'URL' | 'DOMAIN' | 'EMAIL' | 'IP';
    updated_at?: string;
}
export type ListDeleteResponse = unknown;
export interface ListCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: The name of the list.
     */
    name: string;
    /**
     * Body param: The type of list.
     */
    type: 'SERIAL' | 'URL' | 'DOMAIN' | 'EMAIL' | 'IP';
    /**
     * Body param: The description of the list.
     */
    description?: string;
    /**
     * Body param: items to add to the list.
     */
    items?: Array<ListCreateParams.Item>;
}
export declare namespace ListCreateParams {
    interface Item {
        /**
         * The description of the list item, if present
         */
        description?: string;
        /**
         * The value of the item in a list.
         */
        value?: string;
    }
}
export interface ListUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: The name of the list.
     */
    name: string;
    /**
     * Body param: The description of the list.
     */
    description?: string;
    /**
     * Body param: items to add to the list.
     */
    items?: Array<ListUpdateParams.Item>;
}
export declare namespace ListUpdateParams {
    interface Item {
        /**
         * The description of the list item, if present
         */
        description?: string;
        /**
         * The value of the item in a list.
         */
        value?: string;
    }
}
export interface ListListParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Query param: The type of list.
     */
    type?: 'SERIAL' | 'URL' | 'DOMAIN' | 'EMAIL' | 'IP';
}
export interface ListDeleteParams {
    account_id: string;
}
export interface ListEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: items to add to the list.
     */
    append?: Array<ListEditParams.Append>;
    /**
     * Body param: A list of the item values you want to remove.
     */
    remove?: Array<string>;
}
export declare namespace ListEditParams {
    interface Append {
        /**
         * The description of the list item, if present
         */
        description?: string;
        /**
         * The value of the item in a list.
         */
        value?: string;
    }
}
export interface ListGetParams {
    account_id: string;
}
export declare namespace Lists {
    export { type GatewayItem as GatewayItem, type GatewayList as GatewayList, type ListCreateResponse as ListCreateResponse, type ListDeleteResponse as ListDeleteResponse, GatewayListsSinglePage as GatewayListsSinglePage, type ListCreateParams as ListCreateParams, type ListUpdateParams as ListUpdateParams, type ListListParams as ListListParams, type ListDeleteParams as ListDeleteParams, type ListEditParams as ListEditParams, type ListGetParams as ListGetParams, };
    export { Items as Items, type ItemListResponse as ItemListResponse, ItemListResponsesSinglePage as ItemListResponsesSinglePage, type ItemListParams as ItemListParams, };
}
//# sourceMappingURL=lists.d.ts.map