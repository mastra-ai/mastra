"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Custom = void 0;
const resource_1 = require("../../../../resource.js");
class Custom extends resource_1.APIResource {
    /**
     * Creates a DLP custom entry.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.zeroTrust.dlp.entries.custom.create({
     *     account_id: 'account_id',
     *     enabled: true,
     *     name: 'name',
     *     pattern: { regex: 'regex' },
     *     profile_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/entries`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a DLP entry.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.zeroTrust.dlp.entries.custom.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     {
     *       account_id: 'account_id',
     *       name: 'name',
     *       pattern: { regex: 'regex' },
     *       type: 'custom',
     *     },
     *   );
     * ```
     */
    update(entryId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/entries/${entryId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes a DLP custom entry.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.zeroTrust.dlp.entries.custom.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(entryId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dlp/entries/${entryId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Custom = Custom;
//# sourceMappingURL=custom.js.map