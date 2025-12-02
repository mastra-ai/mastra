import { APIResource } from "../resource.js";
import * as Core from "../core.js";
import * as CustomCertificatesAPI from "./custom-certificates/custom-certificates.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../pagination.js";
export declare class ClientCertificates extends APIResource {
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
    create(params: ClientCertificateCreateParams, options?: Core.RequestOptions): Core.APIPromise<ClientCertificate>;
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
    list(params: ClientCertificateListParams, options?: Core.RequestOptions): Core.PagePromise<ClientCertificatesV4PagePaginationArray, ClientCertificate>;
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
    delete(clientCertificateId: string, params: ClientCertificateDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ClientCertificate>;
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
    edit(clientCertificateId: string, params: ClientCertificateEditParams, options?: Core.RequestOptions): Core.APIPromise<ClientCertificate>;
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
    get(clientCertificateId: string, params: ClientCertificateGetParams, options?: Core.RequestOptions): Core.APIPromise<ClientCertificate>;
}
export declare class ClientCertificatesV4PagePaginationArray extends V4PagePaginationArray<ClientCertificate> {
}
export interface ClientCertificate {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * The Client Certificate PEM
     */
    certificate?: string;
    /**
     * Certificate Authority used to issue the Client Certificate
     */
    certificate_authority?: ClientCertificate.CertificateAuthority;
    /**
     * Common Name of the Client Certificate
     */
    common_name?: string;
    /**
     * Country, provided by the CSR
     */
    country?: string;
    /**
     * The Certificate Signing Request (CSR). Must be newline-encoded.
     */
    csr?: string;
    /**
     * Date that the Client Certificate expires
     */
    expires_on?: string;
    /**
     * Unique identifier of the Client Certificate
     */
    fingerprint_sha256?: string;
    /**
     * Date that the Client Certificate was issued by the Certificate Authority
     */
    issued_on?: string;
    /**
     * Location, provided by the CSR
     */
    location?: string;
    /**
     * Organization, provided by the CSR
     */
    organization?: string;
    /**
     * Organizational Unit, provided by the CSR
     */
    organizational_unit?: string;
    /**
     * The serial number on the created Client Certificate.
     */
    serial_number?: string;
    /**
     * The type of hash used for the Client Certificate..
     */
    signature?: string;
    /**
     * Subject Key Identifier
     */
    ski?: string;
    /**
     * State, provided by the CSR
     */
    state?: string;
    /**
     * Client Certificates may be active or revoked, and the pending_reactivation or
     * pending_revocation represent in-progress asynchronous transitions
     */
    status?: CustomCertificatesAPI.Status;
    /**
     * The number of days the Client Certificate will be valid after the issued_on date
     */
    validity_days?: number;
}
export declare namespace ClientCertificate {
    /**
     * Certificate Authority used to issue the Client Certificate
     */
    interface CertificateAuthority {
        id?: string;
        name?: string;
    }
}
export interface ClientCertificateCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The Certificate Signing Request (CSR). Must be newline-encoded.
     */
    csr: string;
    /**
     * Body param: The number of days the Client Certificate will be valid after the
     * issued_on date
     */
    validity_days: number;
}
export interface ClientCertificateListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Limit to the number of records returned.
     */
    limit?: number;
    /**
     * Query param: Offset the results
     */
    offset?: number;
    /**
     * Query param: Client Certitifcate Status to filter results by.
     */
    status?: 'all' | 'active' | 'pending_reactivation' | 'pending_revocation' | 'revoked';
}
export interface ClientCertificateDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface ClientCertificateEditParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface ClientCertificateGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace ClientCertificates {
    export { type ClientCertificate as ClientCertificate, ClientCertificatesV4PagePaginationArray as ClientCertificatesV4PagePaginationArray, type ClientCertificateCreateParams as ClientCertificateCreateParams, type ClientCertificateListParams as ClientCertificateListParams, type ClientCertificateDeleteParams as ClientCertificateDeleteParams, type ClientCertificateEditParams as ClientCertificateEditParams, type ClientCertificateGetParams as ClientCertificateGetParams, };
}
//# sourceMappingURL=client-certificates.d.ts.map