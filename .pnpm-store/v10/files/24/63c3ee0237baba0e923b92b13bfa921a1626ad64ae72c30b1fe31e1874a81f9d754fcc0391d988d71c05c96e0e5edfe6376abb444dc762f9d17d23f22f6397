import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as HostnamesAPI from "./hostnames.js";
import { SinglePage } from "../../../pagination.js";
export declare class Certificates extends APIResource {
    /**
     * Upload a certificate to be used for client authentication on a hostname. 10
     * hostname certificates per zone are allowed.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.originTLSClientAuth.hostnames.certificates.create(
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       certificate:
     *         '-----BEGIN CERTIFICATE-----\nMIIDtTCCAp2gAwIBAgIJAMHAwfXZ5/PWMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAkFVMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBX\naWRnaXRzIFB0eSBMdGQwHhcNMTYwODI0MTY0MzAxWhcNMTYxMTIyMTY0MzAxWjBF\nMQswCQYDVQQGEwJBVTETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50\nZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\nCgKCAQEAwQHoetcl9+5ikGzV6cMzWtWPJHqXT3wpbEkRU9Yz7lgvddmGdtcGbg/1\nCGZu0jJGkMoppoUo4c3dts3iwqRYmBikUP77wwY2QGmDZw2FvkJCJlKnabIRuGvB\nKwzESIXgKk2016aTP6/dAjEHyo6SeoK8lkIySUvK0fyOVlsiEsCmOpidtnKX/a+5\n0GjB79CJH4ER2lLVZnhePFR/zUOyPxZQQ4naHf7yu/b5jhO0f8fwt+pyFxIXjbEI\ndZliWRkRMtzrHOJIhrmJ2A1J7iOrirbbwillwjjNVUWPf3IJ3M12S9pEewooaeO2\nizNTERcG9HzAacbVRn2Y2SWIyT/18QIDAQABo4GnMIGkMB0GA1UdDgQWBBT/LbE4\n9rWf288N6sJA5BRb6FJIGDB1BgNVHSMEbjBsgBT/LbE49rWf288N6sJA5BRb6FJI\nGKFJpEcwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNV\nBAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAMHAwfXZ5/PWMAwGA1UdEwQF\nMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAHHFwl0tH0quUYZYO0dZYt4R7SJ0pCm2\n2satiyzHl4OnXcHDpekAo7/a09c6Lz6AU83cKy/+x3/djYHXWba7HpEu0dR3ugQP\nMlr4zrhd9xKZ0KZKiYmtJH+ak4OM4L3FbT0owUZPyjLSlhMtJVcoRp5CJsjAMBUG\nSvD8RX+T01wzox/Qb+lnnNnOlaWpqu8eoOenybxKp1a9ULzIVvN/LAcc+14vioFq\n2swRWtmocBAs8QR9n4uvbpiYvS8eYueDCWMM4fvFfBhaDZ3N9IbtySh3SpFdQDhw\nYbjM2rxXiyLGxB4Bol7QTv4zHif7Zt89FReT/NBy4rzaskDJY5L6xmY=\n-----END CERTIFICATE-----\n',
     *       private_key:
     *         '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAwQHoetcl9+5ikGzV6cMzWtWPJHqXT3wpbEkRU9Yz7lgvddmG\ndtcGbg/1CGZu0jJGkMoppoUo4c3dts3iwqRYmBikUP77wwY2QGmDZw2FvkJCJlKn\nabIRuGvBKwzESIXgKk2016aTP6/dAjEHyo6SeoK8lkIySUvK0fyOVlsiEsCmOpid\ntnKX/a+50GjB79CJH4ER2lLVZnhePFR/zUOyPxZQQ4naHf7yu/b5jhO0f8fwt+py\nFxIXjbEIdZliWRkRMtzrHOJIhrmJ2A1J7iOrirbbwillwjjNVUWPf3IJ3M12S9pE\newooaeO2izNTERcG9HzAacbVRn2Y2SWIyT/18QIDAQABAoIBACbhTYXBZYKmYPCb\nHBR1IBlCQA2nLGf0qRuJNJZg5iEzXows/6tc8YymZkQE7nolapWsQ+upk2y5Xdp/\naxiuprIs9JzkYK8Ox0r+dlwCG1kSW+UAbX0bQ/qUqlsTvU6muVuMP8vZYHxJ3wmb\n+ufRBKztPTQ/rYWaYQcgC0RWI20HTFBMxlTAyNxYNWzX7RKFkGVVyB9RsAtmcc8g\n+j4OdosbfNoJPS0HeIfNpAznDfHKdxDk2Yc1tV6RHBrC1ynyLE9+TaflIAdo2MVv\nKLMLq51GqYKtgJFIlBRPQqKoyXdz3fGvXrTkf/WY9QNq0J1Vk5ERePZ54mN8iZB7\n9lwy/AkCgYEA6FXzosxswaJ2wQLeoYc7ceaweX/SwTvxHgXzRyJIIT0eJWgx13Wo\n/WA3Iziimsjf6qE+SI/8laxPp2A86VMaIt3Z3mJN/CqSVGw8LK2AQst+OwdPyDMu\niacE8lj/IFGC8mwNUAb9CzGU3JpU4PxxGFjS/eMtGeRXCWkK4NE+G08CgYEA1Kp9\nN2JrVlqUz+gAX+LPmE9OEMAS9WQSQsfCHGogIFDGGcNf7+uwBM7GAaSJIP01zcoe\nVAgWdzXCv3FLhsaZoJ6RyLOLay5phbu1iaTr4UNYm5WtYTzMzqh8l1+MFFDl9xDB\nvULuCIIrglM5MeS/qnSg1uMoH2oVPj9TVst/ir8CgYEAxrI7Ws9Zc4Bt70N1As+U\nlySjaEVZCMkqvHJ6TCuVZFfQoE0r0whdLdRLU2PsLFP+q7qaeZQqgBaNSKeVcDYR\n9B+nY/jOmQoPewPVsp/vQTCnE/R81spu0mp0YI6cIheT1Z9zAy322svcc43JaWB7\nmEbeqyLOP4Z4qSOcmghZBSECgYACvR9Xs0DGn+wCsW4vze/2ei77MD4OQvepPIFX\ndFZtlBy5ADcgE9z0cuVB6CiL8DbdK5kwY9pGNr8HUCI03iHkW6Zs+0L0YmihfEVe\nPG19PSzK9CaDdhD9KFZSbLyVFmWfxOt50H7YRTTiPMgjyFpfi5j2q348yVT0tEQS\nfhRqaQKBgAcWPokmJ7EbYQGeMbS7HC8eWO/RyamlnSffdCdSc7ue3zdVJxpAkQ8W\nqu80pEIF6raIQfAf8MXiiZ7auFOSnHQTXUbhCpvDLKi0Mwq3G8Pl07l+2s6dQG6T\nlv6XTQaMyf6n1yjzL+fzDrH3qXMxHMO/b13EePXpDMpY7HQpoLDi\n-----END RSA PRIVATE KEY-----\n',
     *     },
     *   );
     * ```
     */
    create(params: CertificateCreateParams, options?: Core.RequestOptions): Core.APIPromise<CertificateCreateResponse>;
    /**
     * List Certificates
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificateListResponse of client.originTLSClientAuth.hostnames.certificates.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: CertificateListParams, options?: Core.RequestOptions): Core.PagePromise<CertificateListResponsesSinglePage, CertificateListResponse>;
    /**
     * Delete Hostname Client Certificate
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.originTLSClientAuth.hostnames.certificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(certificateId: string, params: CertificateDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CertificateDeleteResponse>;
    /**
     * Get the certificate by ID to be used for client authentication on a hostname.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.originTLSClientAuth.hostnames.certificates.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(certificateId: string, params: CertificateGetParams, options?: Core.RequestOptions): Core.APIPromise<CertificateGetResponse>;
}
export declare class CertificateListResponsesSinglePage extends SinglePage<CertificateListResponse> {
}
export interface Certificate {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * The hostname certificate.
     */
    certificate?: string;
    /**
     * The date when the certificate expires.
     */
    expires_on?: string;
    /**
     * The certificate authority that issued the certificate.
     */
    issuer?: string;
    /**
     * The serial number on the uploaded certificate.
     */
    serial_number?: string;
    /**
     * The type of hash used for the certificate.
     */
    signature?: string;
    /**
     * Status of the certificate or the association.
     */
    status?: 'initializing' | 'pending_deployment' | 'pending_deletion' | 'active' | 'deleted' | 'deployment_timed_out' | 'deletion_timed_out';
    /**
     * The time when the certificate was uploaded.
     */
    uploaded_on?: string;
}
export interface CertificateCreateResponse {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * The hostname certificate.
     */
    certificate?: string;
    /**
     * The date when the certificate expires.
     */
    expires_on?: string;
    /**
     * The certificate authority that issued the certificate.
     */
    issuer?: string;
    /**
     * The serial number on the uploaded certificate.
     */
    serial_number?: string;
    /**
     * The type of hash used for the certificate.
     */
    signature?: string;
    /**
     * Status of the certificate or the association.
     */
    status?: 'initializing' | 'pending_deployment' | 'pending_deletion' | 'active' | 'deleted' | 'deployment_timed_out' | 'deletion_timed_out';
    /**
     * The time when the certificate was uploaded.
     */
    uploaded_on?: string;
}
export interface CertificateListResponse extends HostnamesAPI.AuthenticatedOriginPull {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * Identifier.
     */
    cert_id?: string;
    /**
     * The hostname certificate.
     */
    certificate?: string;
    /**
     * Indicates whether hostname-level authenticated origin pulls is enabled. A null
     * value voids the association.
     */
    enabled?: boolean | null;
    /**
     * The hostname on the origin for which the client certificate uploaded will be
     * used.
     */
    hostname?: string;
    /**
     * The hostname certificate's private key.
     */
    private_key?: string;
}
export interface CertificateDeleteResponse {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * The hostname certificate.
     */
    certificate?: string;
    /**
     * The date when the certificate expires.
     */
    expires_on?: string;
    /**
     * The certificate authority that issued the certificate.
     */
    issuer?: string;
    /**
     * The serial number on the uploaded certificate.
     */
    serial_number?: string;
    /**
     * The type of hash used for the certificate.
     */
    signature?: string;
    /**
     * Status of the certificate or the association.
     */
    status?: 'initializing' | 'pending_deployment' | 'pending_deletion' | 'active' | 'deleted' | 'deployment_timed_out' | 'deletion_timed_out';
    /**
     * The time when the certificate was uploaded.
     */
    uploaded_on?: string;
}
export interface CertificateGetResponse {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * The hostname certificate.
     */
    certificate?: string;
    /**
     * The date when the certificate expires.
     */
    expires_on?: string;
    /**
     * The certificate authority that issued the certificate.
     */
    issuer?: string;
    /**
     * The serial number on the uploaded certificate.
     */
    serial_number?: string;
    /**
     * The type of hash used for the certificate.
     */
    signature?: string;
    /**
     * Status of the certificate or the association.
     */
    status?: 'initializing' | 'pending_deployment' | 'pending_deletion' | 'active' | 'deleted' | 'deployment_timed_out' | 'deletion_timed_out';
    /**
     * The time when the certificate was uploaded.
     */
    uploaded_on?: string;
}
export interface CertificateCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The hostname certificate.
     */
    certificate: string;
    /**
     * Body param: The hostname certificate's private key.
     */
    private_key: string;
}
export interface CertificateListParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface CertificateDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface CertificateGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Certificates {
    export { type Certificate as Certificate, type CertificateCreateResponse as CertificateCreateResponse, type CertificateListResponse as CertificateListResponse, type CertificateDeleteResponse as CertificateDeleteResponse, type CertificateGetResponse as CertificateGetResponse, CertificateListResponsesSinglePage as CertificateListResponsesSinglePage, type CertificateCreateParams as CertificateCreateParams, type CertificateListParams as CertificateListParams, type CertificateDeleteParams as CertificateDeleteParams, type CertificateGetParams as CertificateGetParams, };
}
//# sourceMappingURL=certificates.d.ts.map