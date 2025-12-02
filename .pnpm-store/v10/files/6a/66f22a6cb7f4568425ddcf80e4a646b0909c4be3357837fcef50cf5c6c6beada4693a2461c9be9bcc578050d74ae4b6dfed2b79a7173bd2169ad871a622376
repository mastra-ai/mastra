// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Keys extends APIResource {
    /**
     * Create a new signing key with specified name. Returns all keys available.
     *
     * @example
     * ```ts
     * const key = await client.images.v1.keys.update('someKey', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    update(signingKeyName, params, options) {
        const { account_id } = params;
        return this._client.put(`/accounts/${account_id}/images/v1/keys/${signingKeyName}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists your signing keys. These can be found on your Cloudflare Images dashboard.
     *
     * @example
     * ```ts
     * const keys = await client.images.v1.keys.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/images/v1/keys`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete signing key with specified name. Returns all keys available. When last
     * key is removed, a new default signing key will be generated.
     *
     * @example
     * ```ts
     * const key = await client.images.v1.keys.delete('someKey', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(signingKeyName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/images/v1/keys/${signingKeyName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=keys.mjs.map