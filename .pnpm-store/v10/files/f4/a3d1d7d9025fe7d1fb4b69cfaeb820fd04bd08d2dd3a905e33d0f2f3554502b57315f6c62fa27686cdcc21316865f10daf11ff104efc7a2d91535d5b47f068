// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class SmartRouting extends APIResource {
    /**
     * Updates enablement of Argo Smart Routing.
     *
     * @example
     * ```ts
     * const response = await client.argo.smartRouting.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   value: 'on',
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/argo/smart_routing`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Argo Smart Routing setting
     *
     * @example
     * ```ts
     * const smartRouting = await client.argo.smartRouting.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/argo/smart_routing`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=smart-routing.mjs.map