"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListsListsSinglePage = exports.Lists = void 0;
const resource_1 = require("../../../resource.js");
const BulkOperationsAPI = __importStar(require("./bulk-operations.js"));
const bulk_operations_1 = require("./bulk-operations.js");
const ItemsAPI = __importStar(require("./items.js"));
const items_1 = require("./items.js");
const pagination_1 = require("../../../pagination.js");
class Lists extends resource_1.APIResource {
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
exports.Lists = Lists;
class ListsListsSinglePage extends pagination_1.SinglePage {
}
exports.ListsListsSinglePage = ListsListsSinglePage;
Lists.ListsListsSinglePage = ListsListsSinglePage;
Lists.BulkOperations = bulk_operations_1.BulkOperations;
Lists.Items = items_1.Items;
Lists.ItemListResponsesCursorPagination = items_1.ItemListResponsesCursorPagination;
//# sourceMappingURL=lists.js.map