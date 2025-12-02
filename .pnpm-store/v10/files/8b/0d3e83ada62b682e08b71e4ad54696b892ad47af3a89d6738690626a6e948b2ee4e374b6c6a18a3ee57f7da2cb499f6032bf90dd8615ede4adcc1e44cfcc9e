import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as QuotaAPI from "./quota.js";
import { Quota, QuotaGetParams, QuotaGetResponse } from "./quota.js";
import { SinglePage } from "../../../pagination.js";
export declare class CertificatePacks extends APIResource {
    quota: QuotaAPI.Quota;
    /**
     * For a given zone, order an advanced certificate pack.
     *
     * @example
     * ```ts
     * const certificatePack =
     *   await client.ssl.certificatePacks.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     certificate_authority: 'lets_encrypt',
     *     hosts: [
     *       'example.com',
     *       '*.example.com',
     *       'www.example.com',
     *     ],
     *     type: 'advanced',
     *     validation_method: 'txt',
     *     validity_days: 14,
     *   });
     * ```
     */
    create(params: CertificatePackCreateParams, options?: Core.RequestOptions): Core.APIPromise<CertificatePackCreateResponse>;
    /**
     * For a given zone, list all active certificate packs.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificatePackListResponse of client.ssl.certificatePacks.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: CertificatePackListParams, options?: Core.RequestOptions): Core.PagePromise<CertificatePackListResponsesSinglePage, CertificatePackListResponse>;
    /**
     * For a given zone, delete an advanced certificate pack.
     *
     * @example
     * ```ts
     * const certificatePack =
     *   await client.ssl.certificatePacks.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(certificatePackId: string, params: CertificatePackDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CertificatePackDeleteResponse>;
    /**
     * For a given zone, restart validation or add cloudflare branding for an advanced
     * certificate pack. The former is only a validation operation for a Certificate
     * Pack in a validation_timed_out status.
     *
     * @example
     * ```ts
     * const response = await client.ssl.certificatePacks.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(certificatePackId: string, params: CertificatePackEditParams, options?: Core.RequestOptions): Core.APIPromise<CertificatePackEditResponse>;
    /**
     * For a given zone, get a certificate pack.
     *
     * @example
     * ```ts
     * const certificatePack =
     *   await client.ssl.certificatePacks.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(certificatePackId: string, params: CertificatePackGetParams, options?: Core.RequestOptions): Core.APIPromise<CertificatePackGetResponse>;
}
export declare class CertificatePackListResponsesSinglePage extends SinglePage<CertificatePackListResponse> {
}
export type Host = string;
export type HostParam = string;
/**
 * The number of days for which the certificate should be valid.
 */
export type RequestValidity = 7 | 30 | 90 | 365 | 730 | 1095 | 5475;
/**
 * The number of days for which the certificate should be valid.
 */
export type RequestValidityParam = 7 | 30 | 90 | 365 | 730 | 1095 | 5475;
/**
 * Status of certificate pack.
 */
export type Status = 'initializing' | 'pending_validation' | 'deleted' | 'pending_issuance' | 'pending_deployment' | 'pending_deletion' | 'pending_expiration' | 'expired' | 'active' | 'initializing_timed_out' | 'validation_timed_out' | 'issuance_timed_out' | 'deployment_timed_out' | 'deletion_timed_out' | 'pending_cleanup' | 'staging_deployment' | 'staging_active' | 'deactivating' | 'inactive' | 'backup_issued' | 'holding_deployment';
/**
 * Validation method in use for a certificate pack order.
 */
export type ValidationMethod = 'http' | 'cname' | 'txt';
export interface CertificatePackCreateResponse {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * Certificate Authority selected for the order. For information on any certificate
     * authority specific details or restrictions
     * [see this page for more details.](https://developers.cloudflare.com/ssl/reference/certificate-authorities)
     */
    certificate_authority?: 'google' | 'lets_encrypt' | 'ssl_com';
    /**
     * Whether or not to add Cloudflare Branding for the order. This will add a
     * subdomain of sni.cloudflaressl.com as the Common Name if set to true.
     */
    cloudflare_branding?: boolean;
    /**
     * Comma separated list of valid host names for the certificate packs. Must contain
     * the zone apex, may not contain more than 50 hosts, and may not be empty.
     */
    hosts?: Array<Host>;
    /**
     * Status of certificate pack.
     */
    status?: Status;
    /**
     * Type of certificate pack.
     */
    type?: 'advanced';
    /**
     * Validation Method selected for the order.
     */
    validation_method?: 'txt' | 'http' | 'email';
    /**
     * Validity Days selected for the order.
     */
    validity_days?: 14 | 30 | 90 | 365;
}
export type CertificatePackListResponse = unknown;
export interface CertificatePackDeleteResponse {
    /**
     * Identifier.
     */
    id?: string;
}
export interface CertificatePackEditResponse {
    /**
     * Identifier.
     */
    id?: string;
    /**
     * Certificate Authority selected for the order. For information on any certificate
     * authority specific details or restrictions
     * [see this page for more details.](https://developers.cloudflare.com/ssl/reference/certificate-authorities)
     */
    certificate_authority?: 'google' | 'lets_encrypt' | 'ssl_com';
    /**
     * Whether or not to add Cloudflare Branding for the order. This will add a
     * subdomain of sni.cloudflaressl.com as the Common Name if set to true.
     */
    cloudflare_branding?: boolean;
    /**
     * Comma separated list of valid host names for the certificate packs. Must contain
     * the zone apex, may not contain more than 50 hosts, and may not be empty.
     */
    hosts?: Array<Host>;
    /**
     * Status of certificate pack.
     */
    status?: Status;
    /**
     * Type of certificate pack.
     */
    type?: 'advanced';
    /**
     * Validation Method selected for the order.
     */
    validation_method?: 'txt' | 'http' | 'email';
    /**
     * Validity Days selected for the order.
     */
    validity_days?: 14 | 30 | 90 | 365;
}
export type CertificatePackGetResponse = unknown;
export interface CertificatePackCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Certificate Authority selected for the order. For information on any
     * certificate authority specific details or restrictions
     * [see this page for more details.](https://developers.cloudflare.com/ssl/reference/certificate-authorities)
     */
    certificate_authority: 'google' | 'lets_encrypt' | 'ssl_com';
    /**
     * Body param: Comma separated list of valid host names for the certificate packs.
     * Must contain the zone apex, may not contain more than 50 hosts, and may not be
     * empty.
     */
    hosts: Array<HostParam>;
    /**
     * Body param: Type of certificate pack.
     */
    type: 'advanced';
    /**
     * Body param: Validation Method selected for the order.
     */
    validation_method: 'txt' | 'http' | 'email';
    /**
     * Body param: Validity Days selected for the order.
     */
    validity_days: 14 | 30 | 90 | 365;
    /**
     * Body param: Whether or not to add Cloudflare Branding for the order. This will
     * add a subdomain of sni.cloudflaressl.com as the Common Name if set to true.
     */
    cloudflare_branding?: boolean;
}
export interface CertificatePackListParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Include Certificate Packs of all statuses, not just active ones.
     */
    status?: 'all';
}
export interface CertificatePackDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface CertificatePackEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Whether or not to add Cloudflare Branding for the order. This will
     * add a subdomain of sni.cloudflaressl.com as the Common Name if set to true.
     */
    cloudflare_branding?: boolean;
}
export interface CertificatePackGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace CertificatePacks {
    export { type Host as Host, type RequestValidity as RequestValidity, type Status as Status, type ValidationMethod as ValidationMethod, type CertificatePackCreateResponse as CertificatePackCreateResponse, type CertificatePackListResponse as CertificatePackListResponse, type CertificatePackDeleteResponse as CertificatePackDeleteResponse, type CertificatePackEditResponse as CertificatePackEditResponse, type CertificatePackGetResponse as CertificatePackGetResponse, CertificatePackListResponsesSinglePage as CertificatePackListResponsesSinglePage, type CertificatePackCreateParams as CertificatePackCreateParams, type CertificatePackListParams as CertificatePackListParams, type CertificatePackDeleteParams as CertificatePackDeleteParams, type CertificatePackEditParams as CertificatePackEditParams, type CertificatePackGetParams as CertificatePackGetParams, };
    export { Quota as Quota, type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
//# sourceMappingURL=certificate-packs.d.ts.map