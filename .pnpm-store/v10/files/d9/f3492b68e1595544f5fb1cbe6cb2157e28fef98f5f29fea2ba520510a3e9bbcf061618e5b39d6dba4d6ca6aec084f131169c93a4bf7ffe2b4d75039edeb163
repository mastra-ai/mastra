import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as CertificatePacksAPI from "./certificate-packs/certificate-packs.js";
export declare class VerificationResource extends APIResource {
    /**
     * Edit SSL validation method for a certificate pack. A PATCH request will request
     * an immediate validation check on any certificate, and return the updated status.
     * If a validation method is provided, the validation will be immediately attempted
     * using that method.
     *
     * @example
     * ```ts
     * const response = await client.ssl.verification.edit(
     *   'a77f8bd7-3b47-46b4-a6f1-75cf98109948',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     validation_method: 'txt',
     *   },
     * );
     * ```
     */
    edit(certificatePackId: string, params: VerificationEditParams, options?: Core.RequestOptions): Core.APIPromise<VerificationEditResponse>;
    /**
     * Get SSL Verification Info for a Zone.
     *
     * @example
     * ```ts
     * const verifications = await client.ssl.verification.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: VerificationGetParams, options?: Core.RequestOptions): Core.APIPromise<VerificationGetResponse>;
}
export interface Verification {
    /**
     * Current status of certificate.
     */
    certificate_status: 'initializing' | 'authorizing' | 'active' | 'expired' | 'issuing' | 'timing_out' | 'pending_deployment';
    /**
     * Certificate Authority is manually reviewing the order.
     */
    brand_check?: boolean;
    /**
     * Certificate Pack UUID.
     */
    cert_pack_uuid?: string;
    /**
     * Certificate's signature algorithm.
     */
    signature?: 'ECDSAWithSHA256' | 'SHA1WithRSA' | 'SHA256WithRSA';
    /**
     * Validation method in use for a certificate pack order.
     */
    validation_method?: CertificatePacksAPI.ValidationMethod;
    /**
     * Certificate's required verification information.
     */
    verification_info?: Verification.VerificationInfo;
    /**
     * Status of the required verification information, omitted if verification status
     * is unknown.
     */
    verification_status?: boolean;
    /**
     * Method of verification.
     */
    verification_type?: 'cname' | 'meta tag';
}
export declare namespace Verification {
    /**
     * Certificate's required verification information.
     */
    interface VerificationInfo {
        /**
         * Name of CNAME record.
         */
        record_name?: 'record_name' | 'http_url' | 'cname' | 'txt_name';
        /**
         * Target of CNAME record.
         */
        record_target?: 'record_value' | 'http_body' | 'cname_target' | 'txt_value';
    }
}
export interface VerificationEditResponse {
    /**
     * Result status.
     */
    status?: string;
    /**
     * Desired validation method.
     */
    validation_method?: 'http' | 'cname' | 'txt' | 'email';
}
export type VerificationGetResponse = Array<Verification>;
export interface VerificationEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Desired validation method.
     */
    validation_method: 'http' | 'cname' | 'txt' | 'email';
}
export interface VerificationGetParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Immediately retry SSL Verification.
     */
    retry?: true;
}
export declare namespace VerificationResource {
    export { type Verification as Verification, type VerificationEditResponse as VerificationEditResponse, type VerificationGetResponse as VerificationGetResponse, type VerificationEditParams as VerificationEditParams, type VerificationGetParams as VerificationGetParams, };
}
//# sourceMappingURL=verification.d.ts.map