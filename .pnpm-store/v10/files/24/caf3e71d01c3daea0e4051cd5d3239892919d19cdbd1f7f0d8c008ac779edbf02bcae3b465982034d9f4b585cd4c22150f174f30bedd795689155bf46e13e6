// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Associations extends APIResource {
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
export class CertificateAsssociationsSinglePage extends SinglePage {
}
Associations.CertificateAsssociationsSinglePage = CertificateAsssociationsSinglePage;
//# sourceMappingURL=associations.mjs.map