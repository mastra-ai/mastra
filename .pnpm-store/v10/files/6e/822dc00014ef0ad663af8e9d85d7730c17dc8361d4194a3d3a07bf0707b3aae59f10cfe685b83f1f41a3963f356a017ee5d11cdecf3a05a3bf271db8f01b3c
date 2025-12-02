"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Integration = void 0;
const resource_1 = require("../../../../resource.js");
class Integration extends resource_1.APIResource {
    /**
     * This will update an existing integration entry
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.dlp.entries.integration.create({
     *     account_id: 'account_id',
     *     enabled: true,
     *     entry_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/entries/integration`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a DLP entry.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.dlp.entries.integration.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id', enabled: true },
     *   );
     * ```
     */
    update(entryId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/entries/integration/${entryId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * This is a no-op as integration entires can't be deleted but is needed for our
     * generated terraform API
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.dlp.entries.integration.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(entryId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dlp/entries/integration/${entryId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Integration = Integration;
//# sourceMappingURL=integration.js.map