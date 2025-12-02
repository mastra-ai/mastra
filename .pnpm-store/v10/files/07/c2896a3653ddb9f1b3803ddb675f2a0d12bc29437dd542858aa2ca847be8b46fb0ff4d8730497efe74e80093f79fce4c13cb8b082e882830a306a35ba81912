import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Settings extends APIResource {
    /**
     * Updates an mTLS certificate's hostname settings.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificateSettings of client.zeroTrust.access.certificates.settings.update(
     *   {
     *     settings: [
     *       {
     *         china_network: false,
     *         client_certificate_forwarding: true,
     *         hostname: 'admin.example.com',
     *       },
     *     ],
     *     account_id: 'account_id',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params: SettingUpdateParams, options?: Core.RequestOptions): Core.PagePromise<CertificateSettingsSinglePage, CertificateSettings>;
    /**
     * List all mTLS hostname settings for this account or zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificateSettings of client.zeroTrust.access.certificates.settings.get(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params?: SettingGetParams, options?: Core.RequestOptions): Core.PagePromise<CertificateSettingsSinglePage, CertificateSettings>;
    get(options?: Core.RequestOptions): Core.PagePromise<CertificateSettingsSinglePage, CertificateSettings>;
}
export declare class CertificateSettingsSinglePage extends SinglePage<CertificateSettings> {
}
export interface CertificateSettings {
    /**
     * Request client certificates for this hostname in China. Can only be set to true
     * if this zone is china network enabled.
     */
    china_network: boolean;
    /**
     * Client Certificate Forwarding is a feature that takes the client cert provided
     * by the eyeball to the edge, and forwards it to the origin as a HTTP header to
     * allow logging on the origin.
     */
    client_certificate_forwarding: boolean;
    /**
     * The hostname that these settings apply to.
     */
    hostname: string;
}
export interface CertificateSettingsParam {
    /**
     * Request client certificates for this hostname in China. Can only be set to true
     * if this zone is china network enabled.
     */
    china_network: boolean;
    /**
     * Client Certificate Forwarding is a feature that takes the client cert provided
     * by the eyeball to the edge, and forwards it to the origin as a HTTP header to
     * allow logging on the origin.
     */
    client_certificate_forwarding: boolean;
    /**
     * The hostname that these settings apply to.
     */
    hostname: string;
}
export interface SettingUpdateParams {
    /**
     * Body param:
     */
    settings: Array<CertificateSettingsParam>;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
}
export interface SettingGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace Settings {
    export { type CertificateSettings as CertificateSettings, CertificateSettingsSinglePage as CertificateSettingsSinglePage, type SettingUpdateParams as SettingUpdateParams, type SettingGetParams as SettingGetParams, };
}
//# sourceMappingURL=settings.d.ts.map