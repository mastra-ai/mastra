"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Analyze = void 0;
const resource_1 = require("../../resource.js");
class Analyze extends resource_1.APIResource {
    /**
     * Returns the set of hostnames, the signature algorithm, and the expiration date
     * of the certificate.
     *
     * @example
     * ```ts
     * const analyze = await client.ssl.analyze.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/ssl/analyze`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Analyze = Analyze;
//# sourceMappingURL=analyze.js.map