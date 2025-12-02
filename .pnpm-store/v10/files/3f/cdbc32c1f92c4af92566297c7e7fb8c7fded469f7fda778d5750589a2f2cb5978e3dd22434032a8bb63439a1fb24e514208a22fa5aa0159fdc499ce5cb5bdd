"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomCertificatesSinglePage = exports.Prioritize = void 0;
const resource_1 = require("../../resource.js");
const custom_certificates_1 = require("./custom-certificates.js");
Object.defineProperty(exports, "CustomCertificatesSinglePage", { enumerable: true, get: function () { return custom_certificates_1.CustomCertificatesSinglePage; } });
class Prioritize extends resource_1.APIResource {
    /**
     * If a zone has multiple SSL certificates, you can set the order in which they
     * should be used during a request. The higher priority will break ties across
     * overlapping 'legacy_custom' certificates.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customCertificate of client.customCertificates.prioritize.update(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     certificates: [{}, {}],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/custom_certificates/prioritize`, custom_certificates_1.CustomCertificatesSinglePage, { body, method: 'put', ...options });
    }
}
exports.Prioritize = Prioritize;
//# sourceMappingURL=prioritize.js.map