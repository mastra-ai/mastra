// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class TotalTLS extends APIResource {
    /**
     * Set Total TLS Settings or disable the feature for a Zone.
     *
     * @example
     * ```ts
     * const totalTLS = await client.acm.totalTLS.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   enabled: true,
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/acm/total_tls`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Total TLS Settings for a Zone.
     *
     * @example
     * ```ts
     * const totalTLS = await client.acm.totalTLS.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/acm/total_tls`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=total-tls.mjs.map