// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Retention extends APIResource {
    /**
     * Updates log retention flag for Logpull API.
     *
     * @example
     * ```ts
     * const retention =
     *   await client.logs.control.retention.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/logs/control/retention/flag`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets log retention flag for Logpull API.
     *
     * @example
     * ```ts
     * const retention = await client.logs.control.retention.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/logs/control/retention/flag`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=retention.mjs.map