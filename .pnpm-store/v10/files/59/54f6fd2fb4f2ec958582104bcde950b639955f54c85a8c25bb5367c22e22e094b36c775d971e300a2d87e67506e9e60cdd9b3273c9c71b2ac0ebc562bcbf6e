"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomNameserversSinglePage = exports.CustomNameserverDeleteResponsesSinglePage = exports.CustomNameservers = void 0;
const resource_1 = require("../resource.js");
const pagination_1 = require("../pagination.js");
class CustomNameservers extends resource_1.APIResource {
    /**
     * Add Account Custom Nameserver
     *
     * @example
     * ```ts
     * const customNameserver =
     *   await client.customNameservers.create({
     *     account_id: '372e67954025e0ba6aaa6d586b9e0b59',
     *     ns_name: 'ns1.example.com',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/custom_ns`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete Account Custom Nameserver
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customNameserverDeleteResponse of client.customNameservers.delete(
     *   'ns1.example.com',
     *   { account_id: '372e67954025e0ba6aaa6d586b9e0b59' },
     * )) {
     *   // ...
     * }
     * ```
     */
    delete(customNSId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/custom_ns/${customNSId}`, CustomNameserverDeleteResponsesSinglePage, { method: 'delete', ...options });
    }
    /**
     * List an account's custom nameservers.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customNameserver of client.customNameservers.get(
     *   { account_id: '372e67954025e0ba6aaa6d586b9e0b59' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/custom_ns`, CustomNameserversSinglePage, options);
    }
}
exports.CustomNameservers = CustomNameservers;
class CustomNameserverDeleteResponsesSinglePage extends pagination_1.SinglePage {
}
exports.CustomNameserverDeleteResponsesSinglePage = CustomNameserverDeleteResponsesSinglePage;
class CustomNameserversSinglePage extends pagination_1.SinglePage {
}
exports.CustomNameserversSinglePage = CustomNameserversSinglePage;
CustomNameservers.CustomNameserverDeleteResponsesSinglePage = CustomNameserverDeleteResponsesSinglePage;
CustomNameservers.CustomNameserversSinglePage = CustomNameserversSinglePage;
//# sourceMappingURL=custom-nameservers.js.map