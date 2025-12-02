// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Settings extends APIResource {
    /**
     * Patch Universal SSL Settings for a Zone.
     *
     * @example
     * ```ts
     * const universalSSLSettings =
     *   await client.ssl.universal.settings.edit({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/ssl/universal/settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Universal SSL Settings for a Zone.
     *
     * @example
     * ```ts
     * const universalSSLSettings =
     *   await client.ssl.universal.settings.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/ssl/universal/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=settings.mjs.map