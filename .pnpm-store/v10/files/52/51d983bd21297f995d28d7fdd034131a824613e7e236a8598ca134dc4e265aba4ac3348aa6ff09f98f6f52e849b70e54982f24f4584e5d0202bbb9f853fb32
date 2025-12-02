// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Predefined extends APIResource {
    /**
     * Creates a DLP predefined profile. Only supports enabling/disabling entries.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.predefined.create({
     *     account_id: 'account_id',
     *     profile_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/profiles/predefined`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a DLP predefined profile. Only supports enabling/disabling entries.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.predefined.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    update(profileId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/profiles/predefined/${profileId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * This is a no-op as predefined profiles can't be deleted but is needed for our
     * generated terraform API
     *
     * @example
     * ```ts
     * const predefined =
     *   await client.zeroTrust.dlp.profiles.predefined.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(profileId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dlp/profiles/predefined/${profileId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a predefined DLP profile by id.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.predefined.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(profileId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/profiles/predefined/${profileId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=predefined.mjs.map