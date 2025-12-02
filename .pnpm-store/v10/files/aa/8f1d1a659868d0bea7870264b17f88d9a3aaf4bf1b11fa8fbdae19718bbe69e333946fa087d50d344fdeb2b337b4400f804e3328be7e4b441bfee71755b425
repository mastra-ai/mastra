"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Default = void 0;
const resource_1 = require("../../resource.js");
class Default extends resource_1.APIResource {
    /**
     * Gets default Zaraz configuration for a zone.
     *
     * @example
     * ```ts
     * const configuration = await client.zaraz.default.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/settings/zaraz/default`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Default = Default;
//# sourceMappingURL=default.js.map