// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Subdomains extends APIResource {
    /**
     * Creates a Workers subdomain for an account.
     *
     * @example
     * ```ts
     * const subdomain = await client.workers.subdomains.update({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   subdomain: 'my-subdomain',
     * });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workers/subdomain`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns a Workers subdomain for an account.
     *
     * @example
     * ```ts
     * const subdomain = await client.workers.subdomains.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/subdomain`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=subdomains.mjs.map