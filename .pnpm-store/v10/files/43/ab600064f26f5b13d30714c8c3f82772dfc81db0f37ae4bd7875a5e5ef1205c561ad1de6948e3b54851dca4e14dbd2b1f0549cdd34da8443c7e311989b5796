"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quota = void 0;
const resource_1 = require("../../../resource.js");
class Quota extends resource_1.APIResource {
    /**
     * For a given zone, list certificate pack quotas.
     *
     * @example
     * ```ts
     * const quota = await client.ssl.certificatePacks.quota.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/ssl/certificate_packs/quota`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Quota = Quota;
//# sourceMappingURL=quota.js.map