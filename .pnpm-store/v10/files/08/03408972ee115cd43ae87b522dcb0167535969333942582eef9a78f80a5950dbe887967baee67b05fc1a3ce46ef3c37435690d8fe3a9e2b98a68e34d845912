import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as ListsAPI from "./lists.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Items extends APIResource {
    /**
     * Fetches all items in a single Zero Trust list.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const itemListResponse of client.zeroTrust.gateway.lists.items.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(listId: string, params: ItemListParams, options?: Core.RequestOptions): Core.PagePromise<ItemListResponsesSinglePage, ItemListResponse>;
}
export declare class ItemListResponsesSinglePage extends SinglePage<ItemListResponse> {
}
/**
 * The items in the list.
 */
export type ItemListResponse = Array<ListsAPI.GatewayItem>;
export interface ItemListParams {
    account_id: string;
}
export declare namespace Items {
    export { type ItemListResponse as ItemListResponse, ItemListResponsesSinglePage as ItemListResponsesSinglePage, type ItemListParams as ItemListParams, };
}
//# sourceMappingURL=items.d.ts.map