// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Health extends APIResource {
    /**
     * Preview pool health using provided monitor details. The returned preview_id can
     * be used in the preview endpoint to retrieve the results.
     *
     * @example
     * ```ts
     * const health =
     *   await client.loadBalancers.pools.health.create(
     *     '17b5962d775c646f3f9725cbc7a53df4',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(poolId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/load_balancers/pools/${poolId}/preview`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch the latest pool health status for a single pool.
     *
     * @example
     * ```ts
     * const health = await client.loadBalancers.pools.health.get(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(poolId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/load_balancers/pools/${poolId}/health`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=health.mjs.map