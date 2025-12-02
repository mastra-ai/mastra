import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class TLS extends APIResource {
    /**
     * Update the tls setting value for the hostname.
     *
     * @example
     * ```ts
     * const setting = await client.hostnames.settings.tls.update(
     *   'ciphers',
     *   'app.example.com',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     value: [
     *       'ECDHE-RSA-AES128-GCM-SHA256',
     *       'AES128-GCM-SHA256',
     *     ],
     *   },
     * );
     * ```
     */
    update(settingId: 'ciphers' | 'min_tls_version' | 'http2', hostname: string, params: TLSUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Setting>;
    /**
     * Delete the tls setting value for the hostname.
     *
     * @example
     * ```ts
     * const tls = await client.hostnames.settings.tls.delete(
     *   'ciphers',
     *   'app.example.com',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(settingId: 'ciphers' | 'min_tls_version' | 'http2', hostname: string, params: TLSDeleteParams, options?: Core.RequestOptions): Core.APIPromise<TLSDeleteResponse>;
    /**
     * List the requested TLS setting for the hostnames under this zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tlsGetResponse of client.hostnames.settings.tls.get(
     *   'ciphers',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(settingId: 'ciphers' | 'min_tls_version' | 'http2', params: TLSGetParams, options?: Core.RequestOptions): Core.PagePromise<TLSGetResponsesSinglePage, TLSGetResponse>;
}
export declare class TLSGetResponsesSinglePage extends SinglePage<TLSGetResponse> {
}
export interface Setting {
    /**
     * This is the time the tls setting was originally created for this hostname.
     */
    created_at?: string;
    /**
     * The hostname for which the tls settings are set.
     */
    hostname?: string;
    /**
     * Deployment status for the given tls setting.
     */
    status?: string;
    /**
     * This is the time the tls setting was updated.
     */
    updated_at?: string;
    /**
     * The tls setting value.
     */
    value?: SettingValue;
}
/**
 * The tls setting value.
 */
export type SettingValue = number | string | Array<string>;
/**
 * The tls setting value.
 */
export type SettingValueParam = number | string | Array<string>;
export interface TLSDeleteResponse {
    /**
     * This is the time the tls setting was originally created for this hostname.
     */
    created_at?: string;
    /**
     * The hostname for which the tls settings are set.
     */
    hostname?: string;
    /**
     * Deployment status for the given tls setting.
     */
    status?: string;
    /**
     * This is the time the tls setting was updated.
     */
    updated_at?: string;
    /**
     * The tls setting value.
     */
    value?: SettingValue;
}
export interface TLSGetResponse {
    /**
     * This is the time the tls setting was originally created for this hostname.
     */
    created_at?: string;
    /**
     * The hostname for which the tls settings are set.
     */
    hostname?: string;
    /**
     * Deployment status for the given tls setting.
     */
    status?: string;
    /**
     * This is the time the tls setting was updated.
     */
    updated_at?: string;
    /**
     * The tls setting value.
     */
    value?: SettingValue;
}
export interface TLSUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The tls setting value.
     */
    value: SettingValueParam;
}
export interface TLSDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface TLSGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace TLS {
    export { type Setting as Setting, type SettingValue as SettingValue, type TLSDeleteResponse as TLSDeleteResponse, type TLSGetResponse as TLSGetResponse, TLSGetResponsesSinglePage as TLSGetResponsesSinglePage, type TLSUpdateParams as TLSUpdateParams, type TLSDeleteParams as TLSDeleteParams, type TLSGetParams as TLSGetParams, };
}
//# sourceMappingURL=tls.d.ts.map