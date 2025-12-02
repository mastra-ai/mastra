import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Apps extends APIResource {
    /**
     * Creates a new App for an account
     *
     * @example
     * ```ts
     * const app = await client.magicTransit.apps.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'Cloudflare Dashboard',
     *   type: 'Development',
     * });
     * ```
     */
    create(params: AppCreateParams, options?: Core.RequestOptions): Core.APIPromise<AppCreateResponse | null>;
    /**
     * Updates an Account App
     *
     * @example
     * ```ts
     * const app = await client.magicTransit.apps.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(accountAppId: string, params: AppUpdateParams, options?: Core.RequestOptions): Core.APIPromise<AppUpdateResponse | null>;
    /**
     * Lists Apps associated with an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const appListResponse of client.magicTransit.apps.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: AppListParams, options?: Core.RequestOptions): Core.PagePromise<AppListResponsesSinglePage, AppListResponse>;
    /**
     * Deletes specific Account App.
     *
     * @example
     * ```ts
     * const app = await client.magicTransit.apps.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(accountAppId: string, params: AppDeleteParams, options?: Core.RequestOptions): Core.APIPromise<AppDeleteResponse | null>;
    /**
     * Updates an Account App
     *
     * @example
     * ```ts
     * const response = await client.magicTransit.apps.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(accountAppId: string, params: AppEditParams, options?: Core.RequestOptions): Core.APIPromise<AppEditResponse | null>;
}
export declare class AppListResponsesSinglePage extends SinglePage<AppListResponse> {
}
/**
 * Custom app defined for an account.
 */
export interface AppCreateResponse {
    /**
     * Magic account app ID.
     */
    account_app_id: string;
    /**
     * FQDNs to associate with traffic decisions.
     */
    hostnames?: Array<string>;
    /**
     * IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are currently
     * unsupported)
     */
    ip_subnets?: Array<string>;
    /**
     * Display name for the app.
     */
    name?: string;
    /**
     * Category of the app.
     */
    type?: string;
}
/**
 * Custom app defined for an account.
 */
export interface AppUpdateResponse {
    /**
     * Magic account app ID.
     */
    account_app_id: string;
    /**
     * FQDNs to associate with traffic decisions.
     */
    hostnames?: Array<string>;
    /**
     * IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are currently
     * unsupported)
     */
    ip_subnets?: Array<string>;
    /**
     * Display name for the app.
     */
    name?: string;
    /**
     * Category of the app.
     */
    type?: string;
}
/**
 * Collection of Hostnames and/or IP Subnets to associate with traffic decisions.
 */
export type AppListResponse = AppListResponse.MagicAccountApp | AppListResponse.MagicManagedApp;
export declare namespace AppListResponse {
    /**
     * Custom app defined for an account.
     */
    interface MagicAccountApp {
        /**
         * Magic account app ID.
         */
        account_app_id: string;
        /**
         * FQDNs to associate with traffic decisions.
         */
        hostnames?: Array<string>;
        /**
         * IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are currently
         * unsupported)
         */
        ip_subnets?: Array<string>;
        /**
         * Display name for the app.
         */
        name?: string;
        /**
         * Category of the app.
         */
        type?: string;
    }
    /**
     * Managed app defined by Cloudflare.
     */
    interface MagicManagedApp {
        /**
         * Managed app ID.
         */
        managed_app_id: string;
        /**
         * FQDNs to associate with traffic decisions.
         */
        hostnames?: Array<string>;
        /**
         * IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are currently
         * unsupported)
         */
        ip_subnets?: Array<string>;
        /**
         * Display name for the app.
         */
        name?: string;
        /**
         * Category of the app.
         */
        type?: string;
    }
}
/**
 * Custom app defined for an account.
 */
export interface AppDeleteResponse {
    /**
     * Magic account app ID.
     */
    account_app_id: string;
    /**
     * FQDNs to associate with traffic decisions.
     */
    hostnames?: Array<string>;
    /**
     * IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are currently
     * unsupported)
     */
    ip_subnets?: Array<string>;
    /**
     * Display name for the app.
     */
    name?: string;
    /**
     * Category of the app.
     */
    type?: string;
}
/**
 * Custom app defined for an account.
 */
export interface AppEditResponse {
    /**
     * Magic account app ID.
     */
    account_app_id: string;
    /**
     * FQDNs to associate with traffic decisions.
     */
    hostnames?: Array<string>;
    /**
     * IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are currently
     * unsupported)
     */
    ip_subnets?: Array<string>;
    /**
     * Display name for the app.
     */
    name?: string;
    /**
     * Category of the app.
     */
    type?: string;
}
export interface AppCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: Display name for the app.
     */
    name: string;
    /**
     * Body param: Category of the app.
     */
    type: string;
    /**
     * Body param: FQDNs to associate with traffic decisions.
     */
    hostnames?: Array<string>;
    /**
     * Body param: IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are
     * currently unsupported)
     */
    ip_subnets?: Array<string>;
}
export interface AppUpdateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: FQDNs to associate with traffic decisions.
     */
    hostnames?: Array<string>;
    /**
     * Body param: IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are
     * currently unsupported)
     */
    ip_subnets?: Array<string>;
    /**
     * Body param: Display name for the app.
     */
    name?: string;
    /**
     * Body param: Category of the app.
     */
    type?: string;
}
export interface AppListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface AppDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface AppEditParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: FQDNs to associate with traffic decisions.
     */
    hostnames?: Array<string>;
    /**
     * Body param: IPv4 CIDRs to associate with traffic decisions. (IPv6 CIDRs are
     * currently unsupported)
     */
    ip_subnets?: Array<string>;
    /**
     * Body param: Display name for the app.
     */
    name?: string;
    /**
     * Body param: Category of the app.
     */
    type?: string;
}
export declare namespace Apps {
    export { type AppCreateResponse as AppCreateResponse, type AppUpdateResponse as AppUpdateResponse, type AppListResponse as AppListResponse, type AppDeleteResponse as AppDeleteResponse, type AppEditResponse as AppEditResponse, AppListResponsesSinglePage as AppListResponsesSinglePage, type AppCreateParams as AppCreateParams, type AppUpdateParams as AppUpdateParams, type AppListParams as AppListParams, type AppDeleteParams as AppDeleteParams, type AppEditParams as AppEditParams, };
}
//# sourceMappingURL=apps.d.ts.map