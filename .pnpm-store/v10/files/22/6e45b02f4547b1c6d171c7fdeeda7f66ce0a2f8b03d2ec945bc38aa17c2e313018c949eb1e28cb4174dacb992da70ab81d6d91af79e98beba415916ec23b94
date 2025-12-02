// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as CertificatesAPI from "./certificates.mjs";
import { CertificateListResponsesSinglePage, Certificates, } from "./certificates.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Hostnames extends APIResource {
    constructor() {
        super(...arguments);
        this.certificates = new CertificatesAPI.Certificates(this._client);
    }
    /**
     * Associate a hostname to a certificate and enable, disable or invalidate the
     * association. If disabled, client certificate will not be sent to the hostname
     * even if activated at the zone level. 100 maximum associations on a single
     * certificate are allowed. Note: Use a null value for parameter _enabled_ to
     * invalidate the association.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const hostnameUpdateResponse of client.originTLSClientAuth.hostnames.update(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     config: [{}],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/origin_tls_client_auth/hostnames`, HostnameUpdateResponsesSinglePage, { body, method: 'put', ...options });
    }
    /**
     * Get the Hostname Status for Client Authentication
     *
     * @example
     * ```ts
     * const authenticatedOriginPull =
     *   await client.originTLSClientAuth.hostnames.get(
     *     'app.example.com',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(hostname, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/origin_tls_client_auth/hostnames/${hostname}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class HostnameUpdateResponsesSinglePage extends SinglePage {
}
Hostnames.HostnameUpdateResponsesSinglePage = HostnameUpdateResponsesSinglePage;
Hostnames.Certificates = Certificates;
Hostnames.CertificateListResponsesSinglePage = CertificateListResponsesSinglePage;
//# sourceMappingURL=hostnames.mjs.map