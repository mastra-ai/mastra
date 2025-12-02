// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Currents extends APIResource {
    /**
     * Retrieves analytics aggregated from the last minute of usage on Spectrum
     * applications underneath a given zone.
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/spectrum/analytics/aggregate/current`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=currents.mjs.map