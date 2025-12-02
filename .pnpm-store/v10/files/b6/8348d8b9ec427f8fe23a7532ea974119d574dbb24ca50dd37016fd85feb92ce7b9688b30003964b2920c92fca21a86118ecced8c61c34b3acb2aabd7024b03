// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class WARPChangeEvents extends APIResource {
    /**
     * List WARP configuration and enablement toggle change events by device.
     *
     * @example
     * ```ts
     * const warpChangeEvents =
     *   await client.zeroTrust.dex.warpChangeEvents.get({
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     from: '2023-09-20T17:00:00Z',
     *     page: 1,
     *     per_page: 1,
     *     to: '2023-09-20T17:00:00Z',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/warp-change-events`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=warp-change-events.mjs.map