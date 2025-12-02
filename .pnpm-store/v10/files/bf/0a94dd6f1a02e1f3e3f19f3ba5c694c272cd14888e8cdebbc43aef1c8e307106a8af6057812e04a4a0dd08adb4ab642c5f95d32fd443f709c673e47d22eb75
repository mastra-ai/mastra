// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Configs extends APIResource {
    /**
     * Gets a history of published Zaraz configurations by ID(s) for a zone.
     *
     * @example
     * ```ts
     * const config = await client.zaraz.history.configs.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   ids: [0],
     * });
     * ```
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/settings/zaraz/history/configs`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=configs.mjs.map