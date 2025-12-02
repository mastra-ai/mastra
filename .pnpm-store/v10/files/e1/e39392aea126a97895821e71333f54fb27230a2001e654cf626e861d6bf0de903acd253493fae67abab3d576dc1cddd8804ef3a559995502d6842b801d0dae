// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Regions extends APIResource {
    /**
     * List all region mappings.
     *
     * @example
     * ```ts
     * const regions = await client.loadBalancers.regions.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/load_balancers/regions`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a single region mapping.
     *
     * @example
     * ```ts
     * const region = await client.loadBalancers.regions.get(
     *   'WNAM',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(regionId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/load_balancers/regions/${regionId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=regions.mjs.map