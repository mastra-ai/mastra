"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Holds = void 0;
const resource_1 = require("../../resource.js");
class Holds extends resource_1.APIResource {
    /**
     * Enforce a zone hold on the zone, blocking the creation and activation of zones
     * with this zone's hostname.
     *
     * @example
     * ```ts
     * const zoneHold = await client.zones.holds.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, include_subdomains } = params;
        return this._client.post(`/zones/${zone_id}/hold`, {
            query: { include_subdomains },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Stop enforcement of a zone hold on the zone, permanently or temporarily,
     * allowing the creation and activation of zones with this zone's hostname.
     *
     * @example
     * ```ts
     * const zoneHold = await client.zones.holds.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params, options) {
        const { zone_id, hold_after } = params;
        return this._client.delete(`/zones/${zone_id}/hold`, {
            query: { hold_after },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update the `hold_after` and/or `include_subdomains` values on an existing zone
     * hold. The hold is enabled if the `hold_after` date-time value is in the past.
     *
     * @example
     * ```ts
     * const zoneHold = await client.zones.holds.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/hold`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieve whether the zone is subject to a zone hold, and metadata about the
     * hold.
     *
     * @example
     * ```ts
     * const zoneHold = await client.zones.holds.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/hold`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Holds = Holds;
//# sourceMappingURL=holds.js.map