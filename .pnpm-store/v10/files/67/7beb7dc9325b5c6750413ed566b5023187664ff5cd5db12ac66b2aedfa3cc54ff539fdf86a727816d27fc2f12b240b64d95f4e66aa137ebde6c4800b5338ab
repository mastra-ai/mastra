// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
import { V4PagePaginationArray } from "../pagination.mjs";
export class ClientCertificates extends APIResource {
    /**
     * Create a new API Shield mTLS Client Certificate
     *
     * @example
     * ```ts
     * const clientCertificate =
     *   await client.clientCertificates.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     csr: '-----BEGIN CERTIFICATE REQUEST-----\\nMIICY....\\n-----END CERTIFICATE REQUEST-----\\n',
     *     validity_days: 3650,
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/client_certificates`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all of your Zone's API Shield mTLS Client Certificates by Status and/or
     * using Pagination
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const clientCertificate of client.clientCertificates.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/client_certificates`, ClientCertificatesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Set a API Shield mTLS Client Certificate to pending_revocation status for
     * processing to revoked status.
     *
     * @example
     * ```ts
     * const clientCertificate =
     *   await client.clientCertificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(clientCertificateId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/client_certificates/${clientCertificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * If a API Shield mTLS Client Certificate is in a pending_revocation state, you
     * may reactivate it with this endpoint.
     *
     * @example
     * ```ts
     * const clientCertificate =
     *   await client.clientCertificates.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(clientCertificateId, params, options) {
        const { zone_id } = params;
        return this._client.patch(`/zones/${zone_id}/client_certificates/${clientCertificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Details for a single mTLS API Shield Client Certificate
     *
     * @example
     * ```ts
     * const clientCertificate =
     *   await client.clientCertificates.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(clientCertificateId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/client_certificates/${clientCertificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ClientCertificatesV4PagePaginationArray extends V4PagePaginationArray {
}
ClientCertificates.ClientCertificatesV4PagePaginationArray = ClientCertificatesV4PagePaginationArray;
//# sourceMappingURL=client-certificates.mjs.map