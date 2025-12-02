"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Zone = void 0;
const resource_1 = require("../../../resource.js");
class Zone extends resource_1.APIResource {
    /**
     * Update DNS settings for a zone
     *
     * @example
     * ```ts
     * const response = await client.dns.settings.zone.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/dns_settings`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Show DNS settings for a zone
     *
     * @example
     * ```ts
     * const zone = await client.dns.settings.zone.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/dns_settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Zone = Zone;
//# sourceMappingURL=zone.js.map