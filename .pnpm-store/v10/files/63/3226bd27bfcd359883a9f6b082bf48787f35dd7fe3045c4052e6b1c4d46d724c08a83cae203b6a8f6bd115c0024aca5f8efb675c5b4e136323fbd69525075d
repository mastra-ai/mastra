// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Default extends APIResource {
    /**
     * Gets default Zaraz configuration for a zone.
     *
     * @example
     * ```ts
     * const configuration = await client.zaraz.default.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/settings/zaraz/default`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=default.mjs.map