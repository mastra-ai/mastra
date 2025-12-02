"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackOrigin = void 0;
const resource_1 = require("../../resource.js");
class FallbackOrigin extends resource_1.APIResource {
    /**
     * Update Fallback Origin for Custom Hostnames
     *
     * @example
     * ```ts
     * const fallbackOrigin =
     *   await client.customHostnames.fallbackOrigin.update({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     origin: 'fallback.example.com',
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/custom_hostnames/fallback_origin`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete Fallback Origin for Custom Hostnames
     *
     * @example
     * ```ts
     * const fallbackOrigin =
     *   await client.customHostnames.fallbackOrigin.delete({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/custom_hostnames/fallback_origin`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Fallback Origin for Custom Hostnames
     *
     * @example
     * ```ts
     * const fallbackOrigin =
     *   await client.customHostnames.fallbackOrigin.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/custom_hostnames/fallback_origin`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.FallbackOrigin = FallbackOrigin;
//# sourceMappingURL=fallback-origin.js.map