// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class DNSSECResource extends APIResource {
    /**
     * Delete DNSSEC.
     *
     * @example
     * ```ts
     * const dnssec = await client.dns.dnssec.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/dnssec`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Enable or disable DNSSEC.
     *
     * @example
     * ```ts
     * const dnssec = await client.dns.dnssec.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/dnssec`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Details about DNSSEC status and configuration.
     *
     * @example
     * ```ts
     * const dnssec = await client.dns.dnssec.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/dnssec`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=dnssec.mjs.map