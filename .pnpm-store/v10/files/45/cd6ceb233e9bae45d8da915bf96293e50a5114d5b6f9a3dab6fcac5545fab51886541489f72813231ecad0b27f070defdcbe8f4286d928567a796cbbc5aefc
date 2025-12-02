import { APIResource } from "../resource.js";
import * as Core from "../core.js";
import * as Shared from "./shared.js";
import * as CertificatePacksAPI from "./ssl/certificate-packs/certificate-packs.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../pagination.js";
export declare class OriginCACertificates extends APIResource {
    /**
     * Create an Origin CA certificate. You can use an Origin CA Key as your User
     * Service Key or an API token when calling this endpoint ([see above](#requests)).
     *
     * @example
     * ```ts
     * const originCACertificate =
     *   await client.originCACertificates.create();
     * ```
     */
    create(body: OriginCACertificateCreateParams, options?: Core.RequestOptions): Core.APIPromise<OriginCACertificate>;
    /**
     * List all existing Origin CA certificates for a given zone. You can use an Origin
     * CA Key as your User Service Key or an API token when calling this endpoint
     * ([see above](#requests)).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const originCACertificate of client.originCACertificates.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(query: OriginCACertificateListParams, options?: Core.RequestOptions): Core.PagePromise<OriginCACertificatesV4PagePaginationArray, OriginCACertificate>;
    /**
     * Revoke an existing Origin CA certificate by its serial number. You can use an
     * Origin CA Key as your User Service Key or an API token when calling this
     * endpoint ([see above](#requests)).
     *
     * @example
     * ```ts
     * const originCACertificate =
     *   await client.originCACertificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *   );
     * ```
     */
    delete(certificateId: string, options?: Core.RequestOptions): Core.APIPromise<OriginCACertificateDeleteResponse>;
    /**
     * Get an existing Origin CA certificate by its serial number. You can use an
     * Origin CA Key as your User Service Key or an API token when calling this
     * endpoint ([see above](#requests)).
     *
     * @example
     * ```ts
     * const originCACertificate =
     *   await client.originCACertificates.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *   );
     * ```
     */
    get(certificateId: string, options?: Core.RequestOptions): Core.APIPromise<OriginCACertificate>;
}
export declare class OriginCACertificatesV4PagePaginationArray extends V4PagePaginationArray<OriginCACertificate> {
}
export interface OriginCACertificate {
    /**
     * The Certificate Signing Request (CSR). Must be newline-encoded.
     */
    csr: string;
    /**
     * Array of hostnames or wildcard names (e.g., \*.example.com) bound to the
     * certificate.
     */
    hostnames: Array<string>;
    /**
     * Signature type desired on certificate ("origin-rsa" (rsa), "origin-ecc" (ecdsa),
     * or "keyless-certificate" (for Keyless SSL servers).
     */
    request_type: Shared.CertificateRequestType;
    /**
     * The number of days for which the certificate should be valid.
     */
    requested_validity: CertificatePacksAPI.RequestValidity;
    /**
     * Identifier.
     */
    id?: string;
    /**
     * The Origin CA certificate. Will be newline-encoded.
     */
    certificate?: string;
    /**
     * When the certificate will expire.
     */
    expires_on?: string;
}
export interface OriginCACertificateDeleteResponse {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * When the certificate was revoked.
     */
    revoked_at?: string;
}
export interface OriginCACertificateCreateParams {
    /**
     * The Certificate Signing Request (CSR). Must be newline-encoded.
     */
    csr?: string;
    /**
     * Array of hostnames or wildcard names (e.g., \*.example.com) bound to the
     * certificate.
     */
    hostnames?: Array<string>;
    /**
     * Signature type desired on certificate ("origin-rsa" (rsa), "origin-ecc" (ecdsa),
     * or "keyless-certificate" (for Keyless SSL servers).
     */
    request_type?: Shared.CertificateRequestTypeParam;
    /**
     * The number of days for which the certificate should be valid.
     */
    requested_validity?: CertificatePacksAPI.RequestValidityParam;
}
export interface OriginCACertificateListParams extends V4PagePaginationArrayParams {
    /**
     * Identifier.
     */
    zone_id: string;
    /**
     * Limit to the number of records returned.
     */
    limit?: number;
    /**
     * Offset the results
     */
    offset?: number;
}
export declare namespace OriginCACertificates {
    export { type OriginCACertificate as OriginCACertificate, type OriginCACertificateDeleteResponse as OriginCACertificateDeleteResponse, OriginCACertificatesV4PagePaginationArray as OriginCACertificatesV4PagePaginationArray, type OriginCACertificateCreateParams as OriginCACertificateCreateParams, type OriginCACertificateListParams as OriginCACertificateListParams, };
}
//# sourceMappingURL=origin-ca-certificates.d.ts.map