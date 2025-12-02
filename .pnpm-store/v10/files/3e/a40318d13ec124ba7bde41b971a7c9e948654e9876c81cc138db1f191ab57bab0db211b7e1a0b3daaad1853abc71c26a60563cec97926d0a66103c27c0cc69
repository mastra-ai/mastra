"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemListResponsesCursorPagination = exports.Items = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Items extends resource_1.APIResource {
    /**
     * Appends new items to the list.
     *
     * This operation is asynchronous. To get current the operation status, invoke the
     * `Get bulk operation status` endpoint with the returned `operation_id`.
     *
     * @example
     * ```ts
     * const item = await client.rules.lists.items.create(
     *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{}],
     *   },
     * );
     * ```
     */
    create(listId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/rules/lists/${listId}/items`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Removes all existing items from the list and adds the provided items to the
     * list.
     *
     * This operation is asynchronous. To get current the operation status, invoke the
     * `Get bulk operation status` endpoint with the returned `operation_id`.
     *
     * @example
     * ```ts
     * const item = await client.rules.lists.items.update(
     *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{}],
     *   },
     * );
     * ```
     */
    update(listId, params, options) {
        const { account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/rules/lists/${listId}/items`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches all the items in the list.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const itemListResponse of client.rules.lists.items.list(
     *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(listId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/rules/lists/${listId}/items`, ItemListResponsesCursorPagination, { query, ...options });
    }
    /**
     * Removes one or more items from a list.
     *
     * This operation is asynchronous. To get current the operation status, invoke the
     * `Get bulk operation status` endpoint with the returned `operation_id`.
     *
     * @example
     * ```ts
     * const item = await client.rules.lists.items.delete(
     *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(listId, params, options) {
        const { account_id, ...body } = params;
        return this._client.delete(`/accounts/${account_id}/rules/lists/${listId}/items`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a list item in the list.
     *
     * @example
     * ```ts
     * const item = await client.rules.lists.items.get(
     *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
     *   '34b12448945f11eaa1b71c4d701ab86e',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(listId, itemId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/rules/lists/${listId}/items/${itemId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Items = Items;
class ItemListResponsesCursorPagination extends pagination_1.CursorPagination {
}
exports.ItemListResponsesCursorPagination = ItemListResponsesCursorPagination;
Items.ItemListResponsesCursorPagination = ItemListResponsesCursorPagination;
//# sourceMappingURL=items.js.map