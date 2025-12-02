"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemListResponsesSinglePage = exports.Items = void 0;
const resource_1 = require("../../../../resource.js");
const pagination_1 = require("../../../../pagination.js");
class Items extends resource_1.APIResource {
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
exports.Items = Items;
class ItemListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ItemListResponsesSinglePage = ItemListResponsesSinglePage;
Items.ItemListResponsesSinglePage = ItemListResponsesSinglePage;
//# sourceMappingURL=items.js.map