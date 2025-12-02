import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as KeylessCertificatesAPI from "../keyless-certificates.js";
import * as PrioritizeAPI from "./prioritize.js";
import { Prioritize, PrioritizeUpdateParams } from "./prioritize.js";
import * as CustomHostnamesAPI from "../custom-hostnames/custom-hostnames.js";
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class CustomCertificates extends APIResource {
    prioritize: PrioritizeAPI.Prioritize;
    /**
     * Upload a new SSL certificate for a zone.
     *
     * @example
     * ```ts
     * const customCertificate =
     *   await client.customCertificates.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     certificate:
     *       '-----BEGIN CERTIFICATE-----\nMIIDtTCCAp2gAwIBAgIJAMHAwfXZ5/PWMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAkFVMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBX\naWRnaXRzIFB0eSBMdGQwHhcNMTYwODI0MTY0MzAxWhcNMTYxMTIyMTY0MzAxWjBF\nMQswCQYDVQQGEwJBVTETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50\nZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\nCgKCAQEAwQHoetcl9+5ikGzV6cMzWtWPJHqXT3wpbEkRU9Yz7lgvddmGdtcGbg/1\nCGZu0jJGkMoppoUo4c3dts3iwqRYmBikUP77wwY2QGmDZw2FvkJCJlKnabIRuGvB\nKwzESIXgKk2016aTP6/dAjEHyo6SeoK8lkIySUvK0fyOVlsiEsCmOpidtnKX/a+5\n0GjB79CJH4ER2lLVZnhePFR/zUOyPxZQQ4naHf7yu/b5jhO0f8fwt+pyFxIXjbEI\ndZliWRkRMtzrHOJIhrmJ2A1J7iOrirbbwillwjjNVUWPf3IJ3M12S9pEewooaeO2\nizNTERcG9HzAacbVRn2Y2SWIyT/18QIDAQABo4GnMIGkMB0GA1UdDgQWBBT/LbE4\n9rWf288N6sJA5BRb6FJIGDB1BgNVHSMEbjBsgBT/LbE49rWf288N6sJA5BRb6FJI\nGKFJpEcwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNV\nBAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAMHAwfXZ5/PWMAwGA1UdEwQF\nMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAHHFwl0tH0quUYZYO0dZYt4R7SJ0pCm2\n2satiyzHl4OnXcHDpekAo7/a09c6Lz6AU83cKy/+x3/djYHXWba7HpEu0dR3ugQP\nMlr4zrhd9xKZ0KZKiYmtJH+ak4OM4L3FbT0owUZPyjLSlhMtJVcoRp5CJsjAMBUG\nSvD8RX+T01wzox/Qb+lnnNnOlaWpqu8eoOenybxKp1a9ULzIVvN/LAcc+14vioFq\n2swRWtmocBAs8QR9n4uvbpiYvS8eYueDCWMM4fvFfBhaDZ3N9IbtySh3SpFdQDhw\nYbjM2rxXiyLGxB4Bol7QTv4zHif7Zt89FReT/NBy4rzaskDJY5L6xmY=\n-----END CERTIFICATE-----\n',
     *     private_key:
     *       '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAwQHoetcl9+5ikGzV6cMzWtWPJHqXT3wpbEkRU9Yz7lgvddmG\ndtcGbg/1CGZu0jJGkMoppoUo4c3dts3iwqRYmBikUP77wwY2QGmDZw2FvkJCJlKn\nabIRuGvBKwzESIXgKk2016aTP6/dAjEHyo6SeoK8lkIySUvK0fyOVlsiEsCmOpid\ntnKX/a+50GjB79CJH4ER2lLVZnhePFR/zUOyPxZQQ4naHf7yu/b5jhO0f8fwt+py\nFxIXjbEIdZliWRkRMtzrHOJIhrmJ2A1J7iOrirbbwillwjjNVUWPf3IJ3M12S9pE\newooaeO2izNTERcG9HzAacbVRn2Y2SWIyT/18QIDAQABAoIBACbhTYXBZYKmYPCb\nHBR1IBlCQA2nLGf0qRuJNJZg5iEzXows/6tc8YymZkQE7nolapWsQ+upk2y5Xdp/\naxiuprIs9JzkYK8Ox0r+dlwCG1kSW+UAbX0bQ/qUqlsTvU6muVuMP8vZYHxJ3wmb\n+ufRBKztPTQ/rYWaYQcgC0RWI20HTFBMxlTAyNxYNWzX7RKFkGVVyB9RsAtmcc8g\n+j4OdosbfNoJPS0HeIfNpAznDfHKdxDk2Yc1tV6RHBrC1ynyLE9+TaflIAdo2MVv\nKLMLq51GqYKtgJFIlBRPQqKoyXdz3fGvXrTkf/WY9QNq0J1Vk5ERePZ54mN8iZB7\n9lwy/AkCgYEA6FXzosxswaJ2wQLeoYc7ceaweX/SwTvxHgXzRyJIIT0eJWgx13Wo\n/WA3Iziimsjf6qE+SI/8laxPp2A86VMaIt3Z3mJN/CqSVGw8LK2AQst+OwdPyDMu\niacE8lj/IFGC8mwNUAb9CzGU3JpU4PxxGFjS/eMtGeRXCWkK4NE+G08CgYEA1Kp9\nN2JrVlqUz+gAX+LPmE9OEMAS9WQSQsfCHGogIFDGGcNf7+uwBM7GAaSJIP01zcoe\nVAgWdzXCv3FLhsaZoJ6RyLOLay5phbu1iaTr4UNYm5WtYTzMzqh8l1+MFFDl9xDB\nvULuCIIrglM5MeS/qnSg1uMoH2oVPj9TVst/ir8CgYEAxrI7Ws9Zc4Bt70N1As+U\nlySjaEVZCMkqvHJ6TCuVZFfQoE0r0whdLdRLU2PsLFP+q7qaeZQqgBaNSKeVcDYR\n9B+nY/jOmQoPewPVsp/vQTCnE/R81spu0mp0YI6cIheT1Z9zAy322svcc43JaWB7\nmEbeqyLOP4Z4qSOcmghZBSECgYACvR9Xs0DGn+wCsW4vze/2ei77MD4OQvepPIFX\ndFZtlBy5ADcgE9z0cuVB6CiL8DbdK5kwY9pGNr8HUCI03iHkW6Zs+0L0YmihfEVe\nPG19PSzK9CaDdhD9KFZSbLyVFmWfxOt50H7YRTTiPMgjyFpfi5j2q348yVT0tEQS\nfhRqaQKBgAcWPokmJ7EbYQGeMbS7HC8eWO/RyamlnSffdCdSc7ue3zdVJxpAkQ8W\nqu80pEIF6raIQfAf8MXiiZ7auFOSnHQTXUbhCpvDLKi0Mwq3G8Pl07l+2s6dQG6T\nlv6XTQaMyf6n1yjzL+fzDrH3qXMxHMO/b13EePXpDMpY7HQpoLDi\n-----END RSA PRIVATE KEY-----\n',
     *   });
     * ```
     */
    create(params: CustomCertificateCreateParams, options?: Core.RequestOptions): Core.APIPromise<CustomCertificate>;
    /**
     * List, search, and filter all of your custom SSL certificates. The higher
     * priority will break ties across overlapping 'legacy_custom' certificates, but
     * 'legacy_custom' certificates will always supercede 'sni_custom' certificates.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customCertificate of client.customCertificates.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: CustomCertificateListParams, options?: Core.RequestOptions): Core.PagePromise<CustomCertificatesV4PagePaginationArray, CustomCertificate>;
    /**
     * Remove a SSL certificate from a zone.
     *
     * @example
     * ```ts
     * const customCertificate =
     *   await client.customCertificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(customCertificateId: string, params: CustomCertificateDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CustomCertificateDeleteResponse>;
    /**
     * Upload a new private key and/or PEM/CRT for the SSL certificate. Note: PATCHing
     * a configuration for sni_custom certificates will result in a new resource id
     * being returned, and the previous one being deleted.
     *
     * @example
     * ```ts
     * const customCertificate =
     *   await client.customCertificates.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(customCertificateId: string, params: CustomCertificateEditParams, options?: Core.RequestOptions): Core.APIPromise<CustomCertificate>;
    /**
     * SSL Configuration Details
     *
     * @example
     * ```ts
     * const customCertificate =
     *   await client.customCertificates.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(customCertificateId: string, params: CustomCertificateGetParams, options?: Core.RequestOptions): Core.APIPromise<CustomCertificate>;
}
export declare class CustomCertificatesV4PagePaginationArray extends V4PagePaginationArray<CustomCertificate> {
}
export declare class CustomCertificatesSinglePage extends SinglePage<CustomCertificate> {
}
export interface CustomCertificate {
    /**
     * Identifier.
     */
    id: string;
    /**
     * A ubiquitous bundle has the highest probability of being verified everywhere,
     * even by clients using outdated or unusual trust stores. An optimal bundle uses
     * the shortest chain and newest intermediates. And the force bundle verifies the
     * chain, but does not otherwise modify it.
     */
    bundle_method: CustomHostnamesAPI.BundleMethod;
    /**
     * When the certificate from the authority expires.
     */
    expires_on: string;
    hosts: Array<string>;
    /**
     * The certificate authority that issued the certificate.
     */
    issuer: string;
    /**
     * When the certificate was last modified.
     */
    modified_on: string;
    /**
     * The order/priority in which the certificate will be used in a request. The
     * higher priority will break ties across overlapping 'legacy_custom' certificates,
     * but 'legacy_custom' certificates will always supercede 'sni_custom'
     * certificates.
     */
    priority: number;
    /**
     * The type of hash used for the certificate.
     */
    signature: string;
    /**
     * Status of the zone's custom SSL.
     */
    status: 'active' | 'expired' | 'deleted' | 'pending' | 'initializing';
    /**
     * When the certificate was uploaded to Cloudflare.
     */
    uploaded_on: string;
    /**
     * Identifier.
     */
    zone_id: string;
    /**
     * Specify the region where your private key can be held locally for optimal TLS
     * performance. HTTPS connections to any excluded data center will still be fully
     * encrypted, but will incur some latency while Keyless SSL is used to complete the
     * handshake with the nearest allowed data center. Options allow distribution to
     * only to U.S. data centers, only to E.U. data centers, or only to highest
     * security data centers. Default distribution is to all Cloudflare datacenters,
     * for optimal performance.
     */
    geo_restrictions?: GeoRestrictions;
    keyless_server?: KeylessCertificatesAPI.KeylessCertificate;
    /**
     * Specify the policy that determines the region where your private key will be
     * held locally. HTTPS connections to any excluded data center will still be fully
     * encrypted, but will incur some latency while Keyless SSL is used to complete the
     * handshake with the nearest allowed data center. Any combination of countries,
     * specified by their two letter country code
     * (https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements)
     * can be chosen, such as 'country: IN', as well as 'region: EU' which refers to
     * the EU region. If there are too few data centers satisfying the policy, it will
     * be rejected.
     */
    policy?: string;
}
/**
 * Specify the region where your private key can be held locally for optimal TLS
 * performance. HTTPS connections to any excluded data center will still be fully
 * encrypted, but will incur some latency while Keyless SSL is used to complete the
 * handshake with the nearest allowed data center. Options allow distribution to
 * only to U.S. data centers, only to E.U. data centers, or only to highest
 * security data centers. Default distribution is to all Cloudflare datacenters,
 * for optimal performance.
 */
export interface GeoRestrictions {
    label?: 'us' | 'eu' | 'highest_security';
}
/**
 * Specify the region where your private key can be held locally for optimal TLS
 * performance. HTTPS connections to any excluded data center will still be fully
 * encrypted, but will incur some latency while Keyless SSL is used to complete the
 * handshake with the nearest allowed data center. Options allow distribution to
 * only to U.S. data centers, only to E.U. data centers, or only to highest
 * security data centers. Default distribution is to all Cloudflare datacenters,
 * for optimal performance.
 */
export interface GeoRestrictionsParam {
    label?: 'us' | 'eu' | 'highest_security';
}
/**
 * Client Certificates may be active or revoked, and the pending_reactivation or
 * pending_revocation represent in-progress asynchronous transitions
 */
export type Status = 'active' | 'pending_reactivation' | 'pending_revocation' | 'revoked';
export interface CustomCertificateDeleteResponse {
    /**
     * Identifier.
     */
    id?: string;
}
export interface CustomCertificateCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The zone's SSL certificate or certificate and the intermediate(s).
     */
    certificate: string;
    /**
     * Body param: The zone's private key.
     */
    private_key: string;
    /**
     * Body param: A ubiquitous bundle has the highest probability of being verified
     * everywhere, even by clients using outdated or unusual trust stores. An optimal
     * bundle uses the shortest chain and newest intermediates. And the force bundle
     * verifies the chain, but does not otherwise modify it.
     */
    bundle_method?: CustomHostnamesAPI.BundleMethodParam;
    /**
     * Body param: Specify the region where your private key can be held locally for
     * optimal TLS performance. HTTPS connections to any excluded data center will
     * still be fully encrypted, but will incur some latency while Keyless SSL is used
     * to complete the handshake with the nearest allowed data center. Options allow
     * distribution to only to U.S. data centers, only to E.U. data centers, or only to
     * highest security data centers. Default distribution is to all Cloudflare
     * datacenters, for optimal performance.
     */
    geo_restrictions?: GeoRestrictionsParam;
    /**
     * Body param: Specify the policy that determines the region where your private key
     * will be held locally. HTTPS connections to any excluded data center will still
     * be fully encrypted, but will incur some latency while Keyless SSL is used to
     * complete the handshake with the nearest allowed data center. Any combination of
     * countries, specified by their two letter country code
     * (https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements)
     * can be chosen, such as 'country: IN', as well as 'region: EU' which refers to
     * the EU region. If there are too few data centers satisfying the policy, it will
     * be rejected.
     */
    policy?: string;
    /**
     * Body param: The type 'legacy_custom' enables support for legacy clients which do
     * not include SNI in the TLS handshake.
     */
    type?: 'legacy_custom' | 'sni_custom';
}
export interface CustomCertificateListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Whether to match all search requirements or at least one (any).
     */
    match?: 'any' | 'all';
    /**
     * Query param: Status of the zone's custom SSL.
     */
    status?: 'active' | 'expired' | 'deleted' | 'pending' | 'initializing';
}
export interface CustomCertificateDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface CustomCertificateEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: A ubiquitous bundle has the highest probability of being verified
     * everywhere, even by clients using outdated or unusual trust stores. An optimal
     * bundle uses the shortest chain and newest intermediates. And the force bundle
     * verifies the chain, but does not otherwise modify it.
     */
    bundle_method?: CustomHostnamesAPI.BundleMethodParam;
    /**
     * Body param: The zone's SSL certificate or certificate and the intermediate(s).
     */
    certificate?: string;
    /**
     * Body param: Specify the region where your private key can be held locally for
     * optimal TLS performance. HTTPS connections to any excluded data center will
     * still be fully encrypted, but will incur some latency while Keyless SSL is used
     * to complete the handshake with the nearest allowed data center. Options allow
     * distribution to only to U.S. data centers, only to E.U. data centers, or only to
     * highest security data centers. Default distribution is to all Cloudflare
     * datacenters, for optimal performance.
     */
    geo_restrictions?: GeoRestrictionsParam;
    /**
     * Body param: Specify the policy that determines the region where your private key
     * will be held locally. HTTPS connections to any excluded data center will still
     * be fully encrypted, but will incur some latency while Keyless SSL is used to
     * complete the handshake with the nearest allowed data center. Any combination of
     * countries, specified by their two letter country code
     * (https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements)
     * can be chosen, such as 'country: IN', as well as 'region: EU' which refers to
     * the EU region. If there are too few data centers satisfying the policy, it will
     * be rejected.
     */
    policy?: string;
    /**
     * Body param: The zone's private key.
     */
    private_key?: string;
}
export interface CustomCertificateGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace CustomCertificates {
    export { type CustomCertificate as CustomCertificate, type GeoRestrictions as GeoRestrictions, type Status as Status, type CustomCertificateDeleteResponse as CustomCertificateDeleteResponse, CustomCertificatesV4PagePaginationArray as CustomCertificatesV4PagePaginationArray, type CustomCertificateCreateParams as CustomCertificateCreateParams, type CustomCertificateListParams as CustomCertificateListParams, type CustomCertificateDeleteParams as CustomCertificateDeleteParams, type CustomCertificateEditParams as CustomCertificateEditParams, type CustomCertificateGetParams as CustomCertificateGetParams, };
    export { Prioritize as Prioritize, type PrioritizeUpdateParams as PrioritizeUpdateParams };
}
//# sourceMappingURL=custom-certificates.d.ts.map