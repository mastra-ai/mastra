"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
const resource_1 = require("../../resource.js");
class Settings extends resource_1.APIResource {
    /**
     * Updates a single zone setting by the identifier
     *
     * @example
     * ```ts
     * const response = await client.zones.settings.edit(
     *   'always_online',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(settingId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/settings/${settingId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a single zone setting by name
     *
     * @example
     * ```ts
     * const setting = await client.zones.settings.get(
     *   'always_online',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(settingId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/settings/${settingId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Settings = Settings;
//# sourceMappingURL=settings.js.map