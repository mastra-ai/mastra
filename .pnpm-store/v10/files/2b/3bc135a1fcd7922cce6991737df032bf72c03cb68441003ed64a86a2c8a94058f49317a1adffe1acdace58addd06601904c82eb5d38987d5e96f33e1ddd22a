// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Custom extends APIResource {
    /**
     * Creates a DLP custom profile.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.custom.create({
     *     account_id: 'account_id',
     *     entries: [
     *       {
     *         enabled: true,
     *         name: 'name',
     *         pattern: { regex: 'regex' },
     *       },
     *     ],
     *     name: 'name',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/profiles/custom`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a DLP custom profile.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.custom.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id', name: 'name' },
     *   );
     * ```
     */
    update(profileId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/profiles/custom/${profileId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes a DLP custom profile.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.zeroTrust.dlp.profiles.custom.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(profileId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dlp/profiles/custom/${profileId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a custom DLP profile by id.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.custom.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(profileId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/profiles/custom/${profileId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=custom.mjs.map