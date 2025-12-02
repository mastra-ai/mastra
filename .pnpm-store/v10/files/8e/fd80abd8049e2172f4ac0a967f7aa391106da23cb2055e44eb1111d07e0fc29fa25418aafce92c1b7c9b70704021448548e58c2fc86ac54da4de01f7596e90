// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Items extends APIResource {
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
    list(listId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/gateway/lists/${listId}/items`, ItemListResponsesSinglePage, options);
    }
}
export class ItemListResponsesSinglePage extends SinglePage {
}
Items.ItemListResponsesSinglePage = ItemListResponsesSinglePage;
//# sourceMappingURL=items.mjs.map