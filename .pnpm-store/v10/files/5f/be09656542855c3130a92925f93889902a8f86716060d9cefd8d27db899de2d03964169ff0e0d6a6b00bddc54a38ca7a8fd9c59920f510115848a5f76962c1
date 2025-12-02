// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Configurations extends APIResource {
    /**
     * Set configuration properties
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.apiGateway.configurations.update({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     auth_id_characteristics: [
     *       { name: 'authorization', type: 'header' },
     *     ],
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/api_gateway/configuration`, { body, ...options });
    }
    /**
     * Retrieve information about specific configuration properties
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.apiGateway.configurations.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/configuration`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=configurations.mjs.map