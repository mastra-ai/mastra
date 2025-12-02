"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkOperations = void 0;
const resource_1 = require("../../../resource.js");
class BulkOperations extends resource_1.APIResource {
    /**
     * Gets the current status of an asynchronous operation on a list.
     *
     * The `status` property can have one of the following values: `pending`,
     * `running`, `completed`, or `failed`. If the status is `failed`, the `error`
     * property will contain a message describing the error.
     *
     * @example
     * ```ts
     * const bulkOperation =
     *   await client.rules.lists.bulkOperations.get(
     *     '4da8780eeb215e6cb7f48dd981c4ea02',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(operationId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/rules/lists/bulk_operations/${operationId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.BulkOperations = BulkOperations;
//# sourceMappingURL=bulk-operations.js.map