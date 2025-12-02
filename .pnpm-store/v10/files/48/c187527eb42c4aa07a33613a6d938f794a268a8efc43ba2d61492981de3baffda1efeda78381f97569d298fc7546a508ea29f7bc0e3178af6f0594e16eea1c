"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeysCursorLimitPagination = exports.Keys = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Keys extends resource_1.APIResource {
    /**
     * Lists a namespace's keys.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const key of client.kv.namespaces.keys.list(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(namespaceId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/keys`, KeysCursorLimitPagination, { query, ...options });
    }
    /**
     * Remove multiple KV pairs from the namespace. Body should be an array of up to
     * 10,000 keys to be removed.
     *
     * @deprecated Please use kv.namespaces.bulk_delete instead
     */
    bulkDelete(namespaceId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk/delete`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieve up to 100 KV pairs from the namespace. Keys must contain text-based
     * values. JSON values can optionally be parsed instead of being returned as a
     * string value. Metadata can be included if `withMetadata` is true.
     *
     * @deprecated Please use kv.namespaces.bulk_get instead
     */
    bulkGet(namespaceId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk/get`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Write multiple keys and values at once. Body should be an array of up to 10,000
     * key-value pairs to be stored, along with optional expiration information.
     * Existing values and expirations will be overwritten. If neither `expiration` nor
     * `expiration_ttl` is specified, the key-value pair will never expire. If both are
     * set, `expiration_ttl` is used and `expiration` is ignored. The entire request
     * size must be 100 megabytes or less.
     *
     * @deprecated Please use kv.namespaces.bulk_update instead
     */
    bulkUpdate(namespaceId, params, options) {
        const { account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Keys = Keys;
class KeysCursorLimitPagination extends pagination_1.CursorLimitPagination {
}
exports.KeysCursorLimitPagination = KeysCursorLimitPagination;
Keys.KeysCursorLimitPagination = KeysCursorLimitPagination;
//# sourceMappingURL=keys.js.map