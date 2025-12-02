"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretBulkDeleteResponsesSinglePage = exports.SecretListResponsesV4PagePaginationArray = exports.SecretCreateResponsesSinglePage = exports.Secrets = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Secrets extends resource_1.APIResource {
    /**
     * Creates a secret in the account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const secretCreateResponse of client.secretsStore.stores.secrets.create(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     account_id: '985e105f4ecef8ad9ca31a8372d0c353',
     *     body: [
     *       {
     *         name: 'MY_API_KEY',
     *         scopes: ['workers'],
     *         value: 'api-token-secret-123',
     *       },
     *     ],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(storeId, params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/secrets_store/stores/${storeId}/secrets`, SecretCreateResponsesSinglePage, { body: body, method: 'post', ...options });
    }
    /**
     * Lists all store secrets
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const secretListResponse of client.secretsStore.stores.secrets.list(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(storeId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/secrets_store/stores/${storeId}/secrets`, SecretListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes a single secret
     *
     * @example
     * ```ts
     * const secret =
     *   await client.secretsStore.stores.secrets.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(storeId, secretId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/secrets_store/stores/${storeId}/secrets/${secretId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes one or more secrets
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const secretBulkDeleteResponse of client.secretsStore.stores.secrets.bulkDelete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulkDelete(storeId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/secrets_store/stores/${storeId}/secrets`, SecretBulkDeleteResponsesSinglePage, { method: 'delete', ...options });
    }
    /**
     * Duplicates the secret, keeping the value
     *
     * @example
     * ```ts
     * const response =
     *   await client.secretsStore.stores.secrets.duplicate(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     {
     *       account_id: '985e105f4ecef8ad9ca31a8372d0c353',
     *       name: 'MY_API_KEY',
     *     },
     *   );
     * ```
     */
    duplicate(storeId, secretId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/secrets_store/stores/${storeId}/secrets/${secretId}/duplicate`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a single secret
     *
     * @example
     * ```ts
     * const response =
     *   await client.secretsStore.stores.secrets.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     {
     *       account_id: '985e105f4ecef8ad9ca31a8372d0c353',
     *       name: 'MY_API_KEY',
     *     },
     *   );
     * ```
     */
    edit(storeId, secretId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/secrets_store/stores/${storeId}/secrets/${secretId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns details of a single secret
     *
     * @example
     * ```ts
     * const secret = await client.secretsStore.stores.secrets.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '3fd85f74b32742f1bff64a85009dda07',
     *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(storeId, secretId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/secrets_store/stores/${storeId}/secrets/${secretId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Secrets = Secrets;
class SecretCreateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.SecretCreateResponsesSinglePage = SecretCreateResponsesSinglePage;
class SecretListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.SecretListResponsesV4PagePaginationArray = SecretListResponsesV4PagePaginationArray;
class SecretBulkDeleteResponsesSinglePage extends pagination_1.SinglePage {
}
exports.SecretBulkDeleteResponsesSinglePage = SecretBulkDeleteResponsesSinglePage;
Secrets.SecretCreateResponsesSinglePage = SecretCreateResponsesSinglePage;
Secrets.SecretListResponsesV4PagePaginationArray = SecretListResponsesV4PagePaginationArray;
Secrets.SecretBulkDeleteResponsesSinglePage = SecretBulkDeleteResponsesSinglePage;
//# sourceMappingURL=secrets.js.map