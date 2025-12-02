"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesSinglePage = exports.MessageResource = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class MessageResource extends resource_1.APIResource {
    /**
     * Create a New Request Message
     *
     * @example
     * ```ts
     * const message =
     *   await client.cloudforceOne.requests.message.create(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(requestId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/requests/${requestId}/message/new`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Request Message
     *
     * @example
     * ```ts
     * const message =
     *   await client.cloudforceOne.requests.message.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     0,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(requestId, messageId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/cloudforce-one/requests/${requestId}/message/${messageId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete a Request Message
     *
     * @example
     * ```ts
     * const message =
     *   await client.cloudforceOne.requests.message.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     0,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(requestId, messageId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/requests/${requestId}/message/${messageId}`, options);
    }
    /**
     * List Request Messages
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const message of client.cloudforceOne.requests.message.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     page: 0,
     *     per_page: 10,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(requestId, params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cloudforce-one/requests/${requestId}/message`, MessagesSinglePage, { body, method: 'post', ...options });
    }
}
exports.MessageResource = MessageResource;
class MessagesSinglePage extends pagination_1.SinglePage {
}
exports.MessagesSinglePage = MessagesSinglePage;
MessageResource.MessagesSinglePage = MessagesSinglePage;
//# sourceMappingURL=message.js.map