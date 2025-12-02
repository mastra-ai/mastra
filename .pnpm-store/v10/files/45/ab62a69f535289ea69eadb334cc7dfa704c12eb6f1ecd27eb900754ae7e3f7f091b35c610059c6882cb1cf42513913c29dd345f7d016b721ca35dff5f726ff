"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Retention = void 0;
const resource_1 = require("../../../resource.js");
class Retention extends resource_1.APIResource {
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
exports.Retention = Retention;
//# sourceMappingURL=retention.js.map