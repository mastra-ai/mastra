import { APIResource } from "../resource.js";
import * as Core from "../core.js";
import * as CustomHostnamesAPI from "./custom-hostnames/custom-hostnames.js";
import { SinglePage } from "../pagination.js";
export declare class KeylessCertificates extends APIResource {
    /**
     * Create Keyless SSL Configuration
     *
     * @example
     * ```ts
     * const keylessCertificate =
     *   await client.keylessCertificates.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     certificate:
     *       '-----BEGIN CERTIFICATE----- MIIDtTCCAp2gAwIBAgIJAM15n7fdxhRtMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV BAYTAlVTMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBX aWRnaXRzIFB0eSBMdGQwHhcNMTQwMzExMTkyMTU5WhcNMTQwNDEwMTkyMTU5WjBF MQswCQYDVQQGEwJVUzETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50 ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB CgKCAQEAvq3sKsHpeduJHimOK+fvQdKsI8z8A05MZyyLp2/R/GE8FjNv+hkVY1WQ LIyTNNQH7CJecE1nbTfo8Y56S7x/rhxC6/DJ8MIulapFPnorq46KU6yRxiM0MQ3N nTJHlHA2ozZta6YBBfVfhHWl1F0IfNbXCLKvGwWWMbCx43OfW6KTkbRnE6gFWKuO fSO5h2u5TaWVuSIzBvYs7Vza6m+gtYAvKAJV2nSZ+eSEFPDo29corOy8+huEOUL8 5FAw4BFPsr1TlrlGPFitduQUHGrSL7skk1ESGza0to3bOtrodKei2s9bk5MXm7lZ qI+WZJX4Zu9+mzZhc9pCVi8r/qlXuQIDAQABo4GnMIGkMB0GA1UdDgQWBBRvavf+ sWM4IwKiH9X9w1vl6nUVRDB1BgNVHSMEbjBsgBRvavf+sWM4IwKiH9X9w1vl6nUV RKFJpEcwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNV BAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAM15n7fdxhRtMAwGA1UdEwQF MAMBAf8wDQYJKoZIhvcNAQEFBQADggEBABY2ZzBaW0dMsAAT7tPJzrVWVzQx6KU4 UEBLudIlWPlkAwTnINCWR/8eNjCCmGA4heUdHmazdpPa8RzwOmc0NT1NQqzSyktt vTqb4iHD7+8f9MqJ9/FssCfTtqr/Qst/hGH4Wmdf1EJ/6FqYAAb5iRlPgshFZxU8 uXtA8hWn6fK6eISD9HBdcAFToUvKNZ1BIDPvh9f95Ine8ar6yGd56TUNrHR8eHBs ESxz5ddVR/oWRysNJ+aGAyYqHS8S/ttmC7r4XCAHqXptkHPCGRqkAhsterYhd4I8 /cBzejUobNCjjHFbtkAL/SjxZOLW+pNkZwfeYdM8iPkD54Uua1v2tdw= -----END CERTIFICATE-----',
     *     host: 'example.com',
     *     port: 24008,
     *   });
     * ```
     */
    create(params: KeylessCertificateCreateParams, options?: Core.RequestOptions): Core.APIPromise<KeylessCertificate>;
    /**
     * List all Keyless SSL configurations for a given zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const keylessCertificate of client.keylessCertificates.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: KeylessCertificateListParams, options?: Core.RequestOptions): Core.PagePromise<KeylessCertificatesSinglePage, KeylessCertificate>;
    /**
     * Delete Keyless SSL Configuration
     *
     * @example
     * ```ts
     * const keylessCertificate =
     *   await client.keylessCertificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(keylessCertificateId: string, params: KeylessCertificateDeleteParams, options?: Core.RequestOptions): Core.APIPromise<KeylessCertificateDeleteResponse>;
    /**
     * This will update attributes of a Keyless SSL. Consists of one or more of the
     * following: host,name,port.
     *
     * @example
     * ```ts
     * const keylessCertificate =
     *   await client.keylessCertificates.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(keylessCertificateId: string, params: KeylessCertificateEditParams, options?: Core.RequestOptions): Core.APIPromise<KeylessCertificate>;
    /**
     * Get details for one Keyless SSL configuration.
     *
     * @example
     * ```ts
     * const keylessCertificate =
     *   await client.keylessCertificates.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(keylessCertificateId: string, params: KeylessCertificateGetParams, options?: Core.RequestOptions): Core.APIPromise<KeylessCertificate>;
}
export declare class KeylessCertificatesSinglePage extends SinglePage<KeylessCertificate> {
}
export interface KeylessCertificate {
    /**
     * Keyless certificate identifier tag.
     */
    id: string;
    /**
     * When the Keyless SSL was created.
     */
    created_on: string;
    /**
     * Whether or not the Keyless SSL is on or off.
     */
    enabled: boolean;
    /**
     * The keyless SSL name.
     */
    host: string;
    /**
     * When the Keyless SSL was last modified.
     */
    modified_on: string;
    /**
     * The keyless SSL name.
     */
    name: string;
    /**
     * Available permissions for the Keyless SSL for the current user requesting the
     * item.
     */
    permissions: Array<string>;
    /**
     * The keyless SSL port used to communicate between Cloudflare and the client's
     * Keyless SSL server.
     */
    port: number;
    /**
     * Status of the Keyless SSL.
     */
    status: 'active' | 'deleted';
    /**
     * Configuration for using Keyless SSL through a Cloudflare Tunnel
     */
    tunnel?: Tunnel;
}
/**
 * Configuration for using Keyless SSL through a Cloudflare Tunnel
 */
export interface Tunnel {
    /**
     * Private IP of the Key Server Host
     */
    private_ip: string;
    /**
     * Cloudflare Tunnel Virtual Network ID
     */
    vnet_id: string;
}
/**
 * Configuration for using Keyless SSL through a Cloudflare Tunnel
 */
export interface TunnelParam {
    /**
     * Private IP of the Key Server Host
     */
    private_ip: string;
    /**
     * Cloudflare Tunnel Virtual Network ID
     */
    vnet_id: string;
}
export interface KeylessCertificateDeleteResponse {
    /**
     * Identifier.
     */
    id?: string;
}
export interface KeylessCertificateCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The zone's SSL certificate or SSL certificate and intermediate(s).
     */
    certificate: string;
    /**
     * Body param: The keyless SSL name.
     */
    host: string;
    /**
     * Body param: The keyless SSL port used to communicate between Cloudflare and the
     * client's Keyless SSL server.
     */
    port: number;
    /**
     * Body param: A ubiquitous bundle has the highest probability of being verified
     * everywhere, even by clients using outdated or unusual trust stores. An optimal
     * bundle uses the shortest chain and newest intermediates. And the force bundle
     * verifies the chain, but does not otherwise modify it.
     */
    bundle_method?: CustomHostnamesAPI.BundleMethodParam;
    /**
     * Body param: The keyless SSL name.
     */
    name?: string;
    /**
     * Body param: Configuration for using Keyless SSL through a Cloudflare Tunnel
     */
    tunnel?: TunnelParam;
}
export interface KeylessCertificateListParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface KeylessCertificateDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface KeylessCertificateEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * @deprecated Body param: Whether or not the Keyless SSL is on or off.
     */
    enabled?: boolean;
    /**
     * Body param: The keyless SSL name.
     */
    host?: string;
    /**
     * Body param: The keyless SSL name.
     */
    name?: string;
    /**
     * Body param: The keyless SSL port used to communicate between Cloudflare and the
     * client's Keyless SSL server.
     */
    port?: number;
    /**
     * Body param: Configuration for using Keyless SSL through a Cloudflare Tunnel
     */
    tunnel?: TunnelParam;
}
export interface KeylessCertificateGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace KeylessCertificates {
    export { type KeylessCertificate as KeylessCertificate, type Tunnel as Tunnel, type KeylessCertificateDeleteResponse as KeylessCertificateDeleteResponse, KeylessCertificatesSinglePage as KeylessCertificatesSinglePage, type KeylessCertificateCreateParams as KeylessCertificateCreateParams, type KeylessCertificateListParams as KeylessCertificateListParams, type KeylessCertificateDeleteParams as KeylessCertificateDeleteParams, type KeylessCertificateEditParams as KeylessCertificateEditParams, type KeylessCertificateGetParams as KeylessCertificateGetParams, };
}
//# sourceMappingURL=keyless-certificates.d.ts.map