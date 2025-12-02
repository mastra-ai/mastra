"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityTXT = void 0;
const resource_1 = require("../resource.js");
class SecurityTXT extends resource_1.APIResource {
    /**
     * Update security.txt
     *
     * @example
     * ```ts
     * const securityTXT = await client.securityTXT.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/security-center/securitytxt`, { body, ...options });
    }
    /**
     * Delete security.txt
     *
     * @example
     * ```ts
     * const securityTXT = await client.securityTXT.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/security-center/securitytxt`, options);
    }
    /**
     * Get security.txt
     *
     * @example
     * ```ts
     * const securityTXT = await client.securityTXT.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/security-center/securitytxt`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.SecurityTXT = SecurityTXT;
//# sourceMappingURL=security-txt.js.map