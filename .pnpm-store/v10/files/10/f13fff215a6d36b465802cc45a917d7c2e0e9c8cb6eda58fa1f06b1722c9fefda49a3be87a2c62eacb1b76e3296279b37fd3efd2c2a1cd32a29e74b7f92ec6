"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Availabilities = void 0;
const resource_1 = require("../../resource.js");
class Availabilities extends resource_1.APIResource {
    /**
     * Retrieves quota for all plans, as well as the current zone quota.
     *
     * @example
     * ```ts
     * const availability = await client.speed.availabilities.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/speed_api/availabilities`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Availabilities = Availabilities;
//# sourceMappingURL=availabilities.js.map