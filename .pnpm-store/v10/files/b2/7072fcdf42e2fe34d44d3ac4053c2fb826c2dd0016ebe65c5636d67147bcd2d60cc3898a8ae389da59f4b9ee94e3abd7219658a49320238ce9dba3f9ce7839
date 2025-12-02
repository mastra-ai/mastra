import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as CustomCertificateAPI from "./custom-certificate.js";
import { CustomCertificate, CustomCertificateGetParams } from "./custom-certificate.js";
export declare class Configurations extends APIResource {
    customCertificate: CustomCertificateAPI.CustomCertificate;
    /**
     * Updates the current Zero Trust account configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.zeroTrust.gateway.configurations.update({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    update(params: ConfigurationUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ConfigurationUpdateResponse>;
    /**
     * Patches the current Zero Trust account configuration. This endpoint can update a
     * single subcollection of settings such as `antivirus`, `tls_decrypt`,
     * `activity_log`, `block_page`, `browser_isolation`, `fips`, `body_scanning`, or
     * `certificate`, without updating the entire configuration object. Returns an
     * error if any collection of settings is not properly configured.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.gateway.configurations.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params: ConfigurationEditParams, options?: Core.RequestOptions): Core.APIPromise<ConfigurationEditResponse>;
    /**
     * Fetches the current Zero Trust account configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.zeroTrust.gateway.configurations.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params: ConfigurationGetParams, options?: Core.RequestOptions): Core.APIPromise<ConfigurationGetResponse>;
}
/**
 * Activity log settings.
 */
export interface ActivityLogSettings {
    /**
     * Enable activity logging.
     */
    enabled?: boolean;
}
/**
 * Activity log settings.
 */
export interface ActivityLogSettingsParam {
    /**
     * Enable activity logging.
     */
    enabled?: boolean;
}
/**
 * Anti-virus settings.
 */
export interface AntiVirusSettings {
    /**
     * Enable anti-virus scanning on downloads.
     */
    enabled_download_phase?: boolean;
    /**
     * Enable anti-virus scanning on uploads.
     */
    enabled_upload_phase?: boolean;
    /**
     * Block requests for files that cannot be scanned.
     */
    fail_closed?: boolean;
    /**
     * Configure a message to display on the user's device when an antivirus search is
     * performed.
     */
    notification_settings?: NotificationSettings | null;
}
/**
 * Anti-virus settings.
 */
export interface AntiVirusSettingsParam {
    /**
     * Enable anti-virus scanning on downloads.
     */
    enabled_download_phase?: boolean;
    /**
     * Enable anti-virus scanning on uploads.
     */
    enabled_upload_phase?: boolean;
    /**
     * Block requests for files that cannot be scanned.
     */
    fail_closed?: boolean;
    /**
     * Configure a message to display on the user's device when an antivirus search is
     * performed.
     */
    notification_settings?: NotificationSettingsParam | null;
}
/**
 * Block page layout settings.
 */
export interface BlockPageSettings {
    /**
     * If mode is customized_block_page: block page background color in #rrggbb format.
     */
    background_color?: string;
    /**
     * Enable only cipher suites and TLS versions compliant with FIPS 140-2.
     */
    enabled?: boolean;
    /**
     * If mode is customized_block_page: block page footer text.
     */
    footer_text?: string;
    /**
     * If mode is customized_block_page: block page header text.
     */
    header_text?: string;
    /**
     * If mode is redirect_uri: when enabled, context will be appended to target_uri as
     * query parameters.
     */
    include_context?: boolean;
    /**
     * If mode is customized_block_page: full URL to the logo file.
     */
    logo_path?: string;
    /**
     * If mode is customized_block_page: admin email for users to contact.
     */
    mailto_address?: string;
    /**
     * If mode is customized_block_page: subject line for emails created from block
     * page.
     */
    mailto_subject?: string;
    /**
     * Controls whether the user is redirected to a Cloudflare-hosted block page or to
     * a customer-provided URI.
     */
    mode?: 'customized_block_page' | 'redirect_uri';
    /**
     * If mode is customized_block_page: block page title.
     */
    name?: string;
    /**
     * This setting was shared via the Orgs API and cannot be edited by the current
     * account
     */
    read_only?: boolean;
    /**
     * Account tag of account that shared this setting
     */
    source_account?: string;
    /**
     * If mode is customized_block_page: suppress detailed info at the bottom of the
     * block page.
     */
    suppress_footer?: boolean;
    /**
     * If mode is redirect_uri: URI to which the user should be redirected.
     */
    target_uri?: string;
}
/**
 * Block page layout settings.
 */
export interface BlockPageSettingsParam {
    /**
     * If mode is customized_block_page: block page background color in #rrggbb format.
     */
    background_color?: string;
    /**
     * Enable only cipher suites and TLS versions compliant with FIPS 140-2.
     */
    enabled?: boolean;
    /**
     * If mode is customized_block_page: block page footer text.
     */
    footer_text?: string;
    /**
     * If mode is customized_block_page: block page header text.
     */
    header_text?: string;
    /**
     * If mode is redirect_uri: when enabled, context will be appended to target_uri as
     * query parameters.
     */
    include_context?: boolean;
    /**
     * If mode is customized_block_page: full URL to the logo file.
     */
    logo_path?: string;
    /**
     * If mode is customized_block_page: admin email for users to contact.
     */
    mailto_address?: string;
    /**
     * If mode is customized_block_page: subject line for emails created from block
     * page.
     */
    mailto_subject?: string;
    /**
     * Controls whether the user is redirected to a Cloudflare-hosted block page or to
     * a customer-provided URI.
     */
    mode?: 'customized_block_page' | 'redirect_uri';
    /**
     * If mode is customized_block_page: block page title.
     */
    name?: string;
    /**
     * If mode is customized_block_page: suppress detailed info at the bottom of the
     * block page.
     */
    suppress_footer?: boolean;
    /**
     * If mode is redirect_uri: URI to which the user should be redirected.
     */
    target_uri?: string;
}
/**
 * DLP body scanning settings.
 */
export interface BodyScanningSettings {
    /**
     * Set the inspection mode to either `deep` or `shallow`.
     */
    inspection_mode?: string;
}
/**
 * DLP body scanning settings.
 */
export interface BodyScanningSettingsParam {
    /**
     * Set the inspection mode to either `deep` or `shallow`.
     */
    inspection_mode?: string;
}
/**
 * Browser isolation settings.
 */
export interface BrowserIsolationSettings {
    /**
     * Enable non-identity onramp support for Browser Isolation.
     */
    non_identity_enabled?: boolean;
    /**
     * Enable Clientless Browser Isolation.
     */
    url_browser_isolation_enabled?: boolean;
}
/**
 * Browser isolation settings.
 */
export interface BrowserIsolationSettingsParam {
    /**
     * Enable non-identity onramp support for Browser Isolation.
     */
    non_identity_enabled?: boolean;
    /**
     * Enable Clientless Browser Isolation.
     */
    url_browser_isolation_enabled?: boolean;
}
/**
 * @deprecated Custom certificate settings for BYO-PKI. (deprecated and replaced by
 * `certificate`)
 */
export interface CustomCertificateSettings {
    /**
     * Enable use of custom certificate authority for signing Gateway traffic.
     */
    enabled: boolean;
    /**
     * UUID of certificate (ID from MTLS certificate store).
     */
    id?: string;
    /**
     * Certificate status (internal).
     */
    binding_status?: string;
    updated_at?: string;
}
/**
 * @deprecated Custom certificate settings for BYO-PKI. (deprecated and replaced by
 * `certificate`)
 */
export interface CustomCertificateSettingsParam {
    /**
     * Enable use of custom certificate authority for signing Gateway traffic.
     */
    enabled: boolean;
    /**
     * UUID of certificate (ID from MTLS certificate store).
     */
    id?: string;
}
/**
 * Extended e-mail matching settings.
 */
export interface ExtendedEmailMatching {
    /**
     * Enable matching all variants of user emails (with + or . modifiers) used as
     * criteria in Firewall policies.
     */
    enabled?: boolean;
    /**
     * This setting was shared via the Orgs API and cannot be edited by the current
     * account
     */
    read_only?: boolean;
    /**
     * Account tag of account that shared this setting
     */
    source_account?: string;
}
/**
 * Extended e-mail matching settings.
 */
export interface ExtendedEmailMatchingParam {
    /**
     * Enable matching all variants of user emails (with + or . modifiers) used as
     * criteria in Firewall policies.
     */
    enabled?: boolean;
}
/**
 * FIPS settings.
 */
export interface FipsSettings {
    /**
     * Enable only cipher suites and TLS versions compliant with FIPS 140-2.
     */
    tls?: boolean;
}
/**
 * FIPS settings.
 */
export interface FipsSettingsParam {
    /**
     * Enable only cipher suites and TLS versions compliant with FIPS 140-2.
     */
    tls?: boolean;
}
/**
 * Account settings
 */
export interface GatewayConfigurationSettings {
    /**
     * Activity log settings.
     */
    activity_log?: ActivityLogSettings | null;
    /**
     * Anti-virus settings.
     */
    antivirus?: AntiVirusSettings | null;
    /**
     * Block page layout settings.
     */
    block_page?: BlockPageSettings | null;
    /**
     * DLP body scanning settings.
     */
    body_scanning?: BodyScanningSettings | null;
    /**
     * Browser isolation settings.
     */
    browser_isolation?: BrowserIsolationSettings | null;
    /**
     * Certificate settings for Gateway TLS interception. If not specified, the
     * Cloudflare Root CA will be used.
     */
    certificate?: GatewayConfigurationSettings.Certificate | null;
    /**
     * @deprecated Custom certificate settings for BYO-PKI. (deprecated and replaced by
     * `certificate`)
     */
    custom_certificate?: CustomCertificateSettings | null;
    /**
     * Extended e-mail matching settings.
     */
    extended_email_matching?: ExtendedEmailMatching | null;
    /**
     * FIPS settings.
     */
    fips?: FipsSettings | null;
    /**
     * Setting to enable host selector in egress policies.
     */
    host_selector?: GatewayConfigurationSettings.HostSelector | null;
    /**
     * Protocol Detection settings.
     */
    protocol_detection?: ProtocolDetection | null;
    /**
     * Sandbox settings.
     */
    sandbox?: GatewayConfigurationSettings.Sandbox | null;
    /**
     * TLS interception settings.
     */
    tls_decrypt?: TLSSettings | null;
}
export declare namespace GatewayConfigurationSettings {
    /**
     * Certificate settings for Gateway TLS interception. If not specified, the
     * Cloudflare Root CA will be used.
     */
    interface Certificate {
        /**
         * UUID of certificate to be used for interception. Certificate must be available
         * (previously called 'active') on the edge. A nil UUID will indicate the
         * Cloudflare Root CA should be used.
         */
        id: string;
    }
    /**
     * Setting to enable host selector in egress policies.
     */
    interface HostSelector {
        /**
         * Enable filtering via hosts for egress policies.
         */
        enabled?: boolean;
    }
    /**
     * Sandbox settings.
     */
    interface Sandbox {
        /**
         * Enable sandbox.
         */
        enabled?: boolean;
        /**
         * Action to take when the file cannot be scanned.
         */
        fallback_action?: 'allow' | 'block';
    }
}
/**
 * Account settings
 */
export interface GatewayConfigurationSettingsParam {
    /**
     * Activity log settings.
     */
    activity_log?: ActivityLogSettingsParam | null;
    /**
     * Anti-virus settings.
     */
    antivirus?: AntiVirusSettingsParam | null;
    /**
     * Block page layout settings.
     */
    block_page?: BlockPageSettingsParam | null;
    /**
     * DLP body scanning settings.
     */
    body_scanning?: BodyScanningSettingsParam | null;
    /**
     * Browser isolation settings.
     */
    browser_isolation?: BrowserIsolationSettingsParam | null;
    /**
     * Certificate settings for Gateway TLS interception. If not specified, the
     * Cloudflare Root CA will be used.
     */
    certificate?: GatewayConfigurationSettingsParam.Certificate | null;
    /**
     * @deprecated Custom certificate settings for BYO-PKI. (deprecated and replaced by
     * `certificate`)
     */
    custom_certificate?: CustomCertificateSettingsParam | null;
    /**
     * Extended e-mail matching settings.
     */
    extended_email_matching?: ExtendedEmailMatchingParam | null;
    /**
     * FIPS settings.
     */
    fips?: FipsSettingsParam | null;
    /**
     * Setting to enable host selector in egress policies.
     */
    host_selector?: GatewayConfigurationSettingsParam.HostSelector | null;
    /**
     * Protocol Detection settings.
     */
    protocol_detection?: ProtocolDetectionParam | null;
    /**
     * Sandbox settings.
     */
    sandbox?: GatewayConfigurationSettingsParam.Sandbox | null;
    /**
     * TLS interception settings.
     */
    tls_decrypt?: TLSSettingsParam | null;
}
export declare namespace GatewayConfigurationSettingsParam {
    /**
     * Certificate settings for Gateway TLS interception. If not specified, the
     * Cloudflare Root CA will be used.
     */
    interface Certificate {
        /**
         * UUID of certificate to be used for interception. Certificate must be available
         * (previously called 'active') on the edge. A nil UUID will indicate the
         * Cloudflare Root CA should be used.
         */
        id: string;
    }
    /**
     * Setting to enable host selector in egress policies.
     */
    interface HostSelector {
        /**
         * Enable filtering via hosts for egress policies.
         */
        enabled?: boolean;
    }
    /**
     * Sandbox settings.
     */
    interface Sandbox {
        /**
         * Enable sandbox.
         */
        enabled?: boolean;
        /**
         * Action to take when the file cannot be scanned.
         */
        fallback_action?: 'allow' | 'block';
    }
}
/**
 * Configure a message to display on the user's device when an antivirus search is
 * performed.
 */
export interface NotificationSettings {
    /**
     * Set notification on
     */
    enabled?: boolean;
    /**
     * If true, context information will be passed as query parameters
     */
    include_context?: boolean;
    /**
     * Customize the message shown in the notification.
     */
    msg?: string;
    /**
     * Optional URL to direct users to additional information. If not set, the
     * notification will open a block page.
     */
    support_url?: string;
}
/**
 * Configure a message to display on the user's device when an antivirus search is
 * performed.
 */
export interface NotificationSettingsParam {
    /**
     * Set notification on
     */
    enabled?: boolean;
    /**
     * If true, context information will be passed as query parameters
     */
    include_context?: boolean;
    /**
     * Customize the message shown in the notification.
     */
    msg?: string;
    /**
     * Optional URL to direct users to additional information. If not set, the
     * notification will open a block page.
     */
    support_url?: string;
}
/**
 * Protocol Detection settings.
 */
export interface ProtocolDetection {
    /**
     * Enable detecting protocol on initial bytes of client traffic.
     */
    enabled?: boolean;
}
/**
 * Protocol Detection settings.
 */
export interface ProtocolDetectionParam {
    /**
     * Enable detecting protocol on initial bytes of client traffic.
     */
    enabled?: boolean;
}
/**
 * TLS interception settings.
 */
export interface TLSSettings {
    /**
     * Enable inspecting encrypted HTTP traffic.
     */
    enabled?: boolean;
}
/**
 * TLS interception settings.
 */
export interface TLSSettingsParam {
    /**
     * Enable inspecting encrypted HTTP traffic.
     */
    enabled?: boolean;
}
/**
 * Account settings
 */
export interface ConfigurationUpdateResponse {
    created_at?: string;
    /**
     * Account settings
     */
    settings?: GatewayConfigurationSettings;
    updated_at?: string;
}
/**
 * Account settings
 */
export interface ConfigurationEditResponse {
    created_at?: string;
    /**
     * Account settings
     */
    settings?: GatewayConfigurationSettings;
    updated_at?: string;
}
/**
 * Account settings
 */
export interface ConfigurationGetResponse {
    created_at?: string;
    /**
     * Account settings
     */
    settings?: GatewayConfigurationSettings;
    updated_at?: string;
}
export interface ConfigurationUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: Account settings
     */
    settings?: GatewayConfigurationSettingsParam;
}
export interface ConfigurationEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: Account settings
     */
    settings?: GatewayConfigurationSettingsParam;
}
export interface ConfigurationGetParams {
    account_id: string;
}
export declare namespace Configurations {
    export { type ActivityLogSettings as ActivityLogSettings, type AntiVirusSettings as AntiVirusSettings, type BlockPageSettings as BlockPageSettings, type BodyScanningSettings as BodyScanningSettings, type BrowserIsolationSettings as BrowserIsolationSettings, type CustomCertificateSettings as CustomCertificateSettings, type ExtendedEmailMatching as ExtendedEmailMatching, type FipsSettings as FipsSettings, type GatewayConfigurationSettings as GatewayConfigurationSettings, type NotificationSettings as NotificationSettings, type ProtocolDetection as ProtocolDetection, type TLSSettings as TLSSettings, type ConfigurationUpdateResponse as ConfigurationUpdateResponse, type ConfigurationEditResponse as ConfigurationEditResponse, type ConfigurationGetResponse as ConfigurationGetResponse, type ConfigurationUpdateParams as ConfigurationUpdateParams, type ConfigurationEditParams as ConfigurationEditParams, type ConfigurationGetParams as ConfigurationGetParams, };
    export { CustomCertificate as CustomCertificate, type CustomCertificateGetParams as CustomCertificateGetParams, };
}
//# sourceMappingURL=configurations.d.ts.map