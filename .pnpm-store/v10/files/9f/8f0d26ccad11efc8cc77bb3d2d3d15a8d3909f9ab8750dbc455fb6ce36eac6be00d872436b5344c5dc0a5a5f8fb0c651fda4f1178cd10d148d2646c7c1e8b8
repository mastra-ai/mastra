// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Settings extends APIResource {
    /**
     * Enable or disable zone-level authenticated origin pulls. 'enabled' should be set
     * true either before/after the certificate is uploaded to see the certificate in
     * use.
     *
     * @example
     * ```ts
     * const setting =
     *   await client.originTLSClientAuth.settings.update({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     enabled: true,
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/origin_tls_client_auth/settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get whether zone-level authenticated origin pulls is enabled or not. It is false
     * by default.
     *
     * @example
     * ```ts
     * const setting =
     *   await client.originTLSClientAuth.settings.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/origin_tls_client_auth/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=settings.mjs.map