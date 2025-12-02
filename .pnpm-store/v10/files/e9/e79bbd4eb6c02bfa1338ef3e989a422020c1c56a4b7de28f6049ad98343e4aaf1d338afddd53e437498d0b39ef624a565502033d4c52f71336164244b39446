// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Export extends APIResource {
    /**
     * Exports full current published Zaraz configuration for a zone, secret variables
     * included.
     *
     * @example
     * ```ts
     * const configuration = await client.zaraz.export.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/settings/zaraz/export`, options);
    }
}
//# sourceMappingURL=export.mjs.map