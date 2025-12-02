// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as BulkOperationsAPI from "./bulk-operations.mjs";
import { BulkOperations } from "./bulk-operations.mjs";
import * as ItemsAPI from "./items.mjs";
import { ItemListResponsesCursorPagination, Items, } from "./items.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Lists extends APIResource {
    constructor() {
        super(...arguments);
        this.bulkOperations = new BulkOperationsAPI.BulkOperations(this._client);
        this.items = new ItemsAPI.Items(this._client);
    }
    /**
     * Creates a new list of the specified type.
     *
     * @example
     * ```ts
     * const list = await client.rules.lists.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   kind: 'ip',
     *   name: 'list1',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/rules/lists`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates the description of a list.
     *
     * @example
     * ```ts
     * const list = await client.rules.lists.update(
     *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(listId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/rules/lists/${listId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches all lists in the account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const listsList of client.rules.lists.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/rules/lists`, ListsListsSinglePage, options);
    }
    /**
     * Deletes a specific list and all its items.
     *
     * @example
     * ```ts
     * const list = await client.rules.lists.delete(
     *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(listId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/rules/lists/${listId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the details of a list.
     *
     * @example
     * ```ts
     * const list = await client.rules.lists.get(
     *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(listId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/rules/lists/${listId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ListsListsSinglePage extends SinglePage {
}
Lists.ListsListsSinglePage = ListsListsSinglePage;
Lists.BulkOperations = BulkOperations;
Lists.Items = Items;
Lists.ItemListResponsesCursorPagination = ItemListResponsesCursorPagination;
//# sourceMappingURL=lists.mjs.map