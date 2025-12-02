"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockSenderListResponsesV4PagePaginationArray = exports.BlockSenders = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class BlockSenders extends resource_1.APIResource {
    /**
     * Create a blocked email sender
     *
     * @example
     * ```ts
     * const blockSender =
     *   await client.emailSecurity.settings.blockSenders.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     is_regex: false,
     *     pattern: 'test@example.com',
     *     pattern_type: 'EMAIL',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/email-security/settings/block_senders`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List blocked email senders
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const blockSenderListResponse of client.emailSecurity.settings.blockSenders.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/settings/block_senders`, BlockSenderListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a blocked email sender
     *
     * @example
     * ```ts
     * const blockSender =
     *   await client.emailSecurity.settings.blockSenders.delete(
     *     2402,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(patternId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/email-security/settings/block_senders/${patternId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a blocked email sender
     *
     * @example
     * ```ts
     * const response =
     *   await client.emailSecurity.settings.blockSenders.edit(
     *     2402,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(patternId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/email-security/settings/block_senders/${patternId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a blocked email sender
     *
     * @example
     * ```ts
     * const blockSender =
     *   await client.emailSecurity.settings.blockSenders.get(
     *     2402,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(patternId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/settings/block_senders/${patternId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.BlockSenders = BlockSenders;
class BlockSenderListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.BlockSenderListResponsesV4PagePaginationArray = BlockSenderListResponsesV4PagePaginationArray;
BlockSenders.BlockSenderListResponsesV4PagePaginationArray = BlockSenderListResponsesV4PagePaginationArray;
//# sourceMappingURL=block-senders.js.map