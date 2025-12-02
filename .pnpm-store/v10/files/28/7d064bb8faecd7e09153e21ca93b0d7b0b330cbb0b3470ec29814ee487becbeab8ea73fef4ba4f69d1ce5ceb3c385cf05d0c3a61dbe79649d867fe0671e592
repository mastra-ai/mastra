// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Predefined extends APIResource {
    /**
     * This will update an existing predefined entry
     *
     * @example
     * ```ts
     * const predefined =
     *   await client.zeroTrust.dlp.entries.predefined.create({
     *     account_id: 'account_id',
     *     enabled: true,
     *     entry_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/entries/predefined`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a DLP entry.
     *
     * @example
     * ```ts
     * const predefined =
     *   await client.zeroTrust.dlp.entries.predefined.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id', enabled: true },
     *   );
     * ```
     */
    update(entryId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/entries/predefined/${entryId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * This is a no-op as predefined entires can't be deleted but is needed for our
     * generated terraform API
     *
     * @example
     * ```ts
     * const predefined =
     *   await client.zeroTrust.dlp.entries.predefined.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(entryId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dlp/entries/predefined/${entryId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=predefined.mjs.map