"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateAsssociationsSinglePage = exports.Associations = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Associations extends resource_1.APIResource {
    /**
     * Lists all active associations between the certificate and Cloudflare services.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificateAsssociation of client.mtlsCertificates.associations.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(mtlsCertificateId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/mtls_certificates/${mtlsCertificateId}/associations`, CertificateAsssociationsSinglePage, options);
    }
}
exports.Associations = Associations;
class CertificateAsssociationsSinglePage extends pagination_1.SinglePage {
}
exports.CertificateAsssociationsSinglePage = CertificateAsssociationsSinglePage;
Associations.CertificateAsssociationsSinglePage = CertificateAsssociationsSinglePage;
//# sourceMappingURL=associations.js.map