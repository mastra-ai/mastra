import { APIResource } from "../resource.js";
import * as Core from "../core.js";
import * as SettingsAPI from "./zones/settings.js";
export declare class PageRules extends APIResource {
    /**
     * Creates a new Page Rule.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   actions: [{}],
     *   targets: [{}],
     * });
     * ```
     */
    create(params: PageRuleCreateParams, options?: Core.RequestOptions): Core.APIPromise<PageRule>;
    /**
     * Replaces the configuration of an existing Page Rule. The configuration of the
     * updated Page Rule will exactly match the data passed in the API request.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     actions: [{}],
     *     targets: [{}],
     *   },
     * );
     * ```
     */
    update(pageruleId: string, params: PageRuleUpdateParams, options?: Core.RequestOptions): Core.APIPromise<PageRule>;
    /**
     * Fetches Page Rules in a zone.
     *
     * @example
     * ```ts
     * const pageRules = await client.pageRules.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params: PageRuleListParams, options?: Core.RequestOptions): Core.APIPromise<PageRuleListResponse>;
    /**
     * Deletes an existing Page Rule.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(pageruleId: string, params: PageRuleDeleteParams, options?: Core.RequestOptions): Core.APIPromise<PageRuleDeleteResponse | null>;
    /**
     * Updates one or more fields of an existing Page Rule.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(pageruleId: string, params: PageRuleEditParams, options?: Core.RequestOptions): Core.APIPromise<PageRule>;
    /**
     * Fetches the details of a Page Rule.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(pageruleId: string, params: PageRuleGetParams, options?: Core.RequestOptions): Core.APIPromise<PageRule>;
}
export interface PageRule {
    /**
     * Identifier.
     */
    id: string;
    /**
     * The set of actions to perform if the targets of this rule match the request.
     * Actions can redirect to another URL or override settings, but not both.
     */
    actions: Array<SettingsAPI.AlwaysUseHTTPS | SettingsAPI.AutomaticHTTPSRewrites | SettingsAPI.BrowserCacheTTL | SettingsAPI.BrowserCheck | PageRule.BypassCacheOnCookie | PageRule.CacheByDeviceType | PageRule.CacheDeceptionArmor | PageRule.CacheKeyFields | SettingsAPI.CacheLevel | PageRule.CacheOnCookie | PageRule.CacheTTLByStatus | PageRule.DisableApps | PageRule.DisablePerformance | PageRule.DisableSecurity | PageRule.DisableZaraz | PageRule.EdgeCacheTTL | SettingsAPI.EmailObfuscation | PageRule.ExplicitCacheControl | PageRule.ForwardingURL | PageRule.HostHeaderOverride | SettingsAPI.IPGeolocation | SettingsAPI.Mirage | SettingsAPI.OpportunisticEncryption | SettingsAPI.OriginErrorPagePassThru | SettingsAPI.Polish | PageRule.ResolveOverride | PageRule.RespectStrongEtag | SettingsAPI.ResponseBuffering | SettingsAPI.RocketLoader | SettingsAPI.SecurityLevel | SettingsAPI.SortQueryStringForCache | SettingsAPI.SSL | SettingsAPI.TrueClientIPHeader | SettingsAPI.WAF>;
    /**
     * The timestamp of when the Page Rule was created.
     */
    created_on: string;
    /**
     * The timestamp of when the Page Rule was last modified.
     */
    modified_on: string;
    /**
     * The priority of the rule, used to define which Page Rule is processed over
     * another. A higher number indicates a higher priority. For example, if you have a
     * catch-all Page Rule (rule A: `/images/*`) but want a more specific Page Rule to
     * take precedence (rule B: `/images/special/*`), specify a higher priority for
     * rule B so it overrides rule A.
     */
    priority: number;
    /**
     * The status of the Page Rule.
     */
    status: 'active' | 'disabled';
    /**
     * The rule targets to evaluate on each request.
     */
    targets: Array<Target>;
}
export declare namespace PageRule {
    interface BypassCacheOnCookie {
        /**
         * Bypass cache and fetch resources from the origin server if a regular expression
         * matches against a cookie name present in the request.
         */
        id?: 'bypass_cache_on_cookie';
        /**
         * The regular expression to use for matching cookie names in the request. Refer to
         * [Bypass Cache on Cookie setting](https://developers.cloudflare.com/rules/page-rules/reference/additional-reference/#bypass-cache-on-cookie-setting)
         * to learn about limited regular expression support.
         */
        value?: string;
    }
    interface CacheByDeviceType {
        /**
         * Separate cached content based on the visitor's device type.
         */
        id?: 'cache_by_device_type';
        /**
         * The status of Cache By Device Type.
         */
        value?: 'on' | 'off';
    }
    interface CacheDeceptionArmor {
        /**
         * Protect from web cache deception attacks while still allowing static assets to
         * be cached. This setting verifies that the URL's extension matches the returned
         * `Content-Type`.
         */
        id?: 'cache_deception_armor';
        /**
         * The status of Cache Deception Armor.
         */
        value?: 'on' | 'off';
    }
    interface CacheKeyFields {
        /**
         * Control specifically what variables to include when deciding which resources to
         * cache. This allows customers to determine what to cache based on something other
         * than just the URL.
         */
        id?: 'cache_key_fields';
        value?: CacheKeyFields.Value;
    }
    namespace CacheKeyFields {
        interface Value {
            /**
             * Controls which cookies appear in the Cache Key.
             */
            cookie?: Value.Cookie;
            /**
             * Controls which headers go into the Cache Key. Exactly one of `include` or
             * `exclude` is expected.
             */
            header?: Value.Header;
            /**
             * Determines which host header to include in the Cache Key.
             */
            host?: Value.Host;
            /**
             * Controls which URL query string parameters go into the Cache Key. Exactly one of
             * `include` or `exclude` is expected.
             */
            query_string?: Value.QueryString;
            /**
             * Feature fields to add features about the end-user (client) into the Cache Key.
             */
            user?: Value.User;
        }
        namespace Value {
            /**
             * Controls which cookies appear in the Cache Key.
             */
            interface Cookie {
                /**
                 * A list of cookies to check for the presence of, without including their actual
                 * values.
                 */
                check_presence?: Array<string>;
                /**
                 * A list of cookies to include.
                 */
                include?: Array<string>;
            }
            /**
             * Controls which headers go into the Cache Key. Exactly one of `include` or
             * `exclude` is expected.
             */
            interface Header {
                /**
                 * A list of headers to check for the presence of, without including their actual
                 * values.
                 */
                check_presence?: Array<string>;
                /**
                 * A list of headers to ignore.
                 */
                exclude?: Array<string>;
                /**
                 * A list of headers to include.
                 */
                include?: Array<string>;
            }
            /**
             * Determines which host header to include in the Cache Key.
             */
            interface Host {
                /**
                 * Whether to include the Host header in the HTTP request sent to the origin.
                 */
                resolved?: boolean;
            }
            /**
             * Controls which URL query string parameters go into the Cache Key. Exactly one of
             * `include` or `exclude` is expected.
             */
            interface QueryString {
                /**
                 * Ignore all query string parameters.
                 */
                exclude?: '*' | Array<string>;
                /**
                 * Include all query string parameters.
                 */
                include?: '*' | Array<string>;
            }
            /**
             * Feature fields to add features about the end-user (client) into the Cache Key.
             */
            interface User {
                /**
                 * Classifies a request as `mobile`, `desktop`, or `tablet` based on the User
                 * Agent.
                 */
                device_type?: boolean;
                /**
                 * Includes the client's country, derived from the IP address.
                 */
                geo?: boolean;
                /**
                 * Includes the first language code contained in the `Accept-Language` header sent
                 * by the client.
                 */
                lang?: boolean;
            }
        }
    }
    interface CacheOnCookie {
        /**
         * Apply the Cache Everything option (Cache Level setting) based on a regular
         * expression match against a cookie name.
         */
        id?: 'cache_on_cookie';
        /**
         * The regular expression to use for matching cookie names in the request.
         */
        value?: string;
    }
    interface CacheTTLByStatus {
        /**
         * Enterprise customers can set cache time-to-live (TTL) based on the response
         * status from the origin web server. Cache TTL refers to the duration of a
         * resource in the Cloudflare network before being marked as stale or discarded
         * from cache. Status codes are returned by a resource's origin. Setting cache TTL
         * based on response status overrides the default cache behavior (standard caching)
         * for static files and overrides cache instructions sent by the origin web server.
         * To cache non-static assets, set a Cache Level of Cache Everything using a Page
         * Rule. Setting no-store Cache-Control or a low TTL (using `max-age`/`s-maxage`)
         * increases requests to origin web servers and decreases performance.
         */
        id?: 'cache_ttl_by_status';
        /**
         * A JSON object containing status codes and their corresponding TTLs. Each
         * key-value pair in the cache TTL by status cache rule has the following syntax
         *
         * - `status_code`: An integer value such as 200 or 500. status_code matches the
         *   exact status code from the origin web server. Valid status codes are between
         *   100-999.
         * - `status_code_range`: Integer values for from and to. status_code_range matches
         *   any status code from the origin web server within the specified range.
         * - `value`: An integer value that defines the duration an asset is valid in
         *   seconds or one of the following strings: no-store (equivalent to -1), no-cache
         *   (equivalent to 0).
         */
        value?: {
            [key: string]: 'no-cache' | 'no-store' | number;
        };
    }
    interface DisableApps {
        /**
         * Turn off all active
         * [Cloudflare Apps](https://developers.cloudflare.com/support/more-dashboard-apps/cloudflare-apps/)
         * (deprecated).
         */
        id?: 'disable_apps';
    }
    interface DisablePerformance {
        /**
         * Turn off
         * [Rocket Loader](https://developers.cloudflare.com/speed/optimization/content/rocket-loader/),
         * [Mirage](https://developers.cloudflare.com/speed/optimization/images/mirage/),
         * and [Polish](https://developers.cloudflare.com/images/polish/).
         */
        id?: 'disable_performance';
    }
    interface DisableSecurity {
        /**
         * Turn off
         * [Email Obfuscation](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/),
         * [Rate Limiting (previous version, deprecated)](https://developers.cloudflare.com/waf/reference/legacy/old-rate-limiting/),
         * [Scrape Shield](https://developers.cloudflare.com/waf/tools/scrape-shield/),
         * [URL (Zone) Lockdown](https://developers.cloudflare.com/waf/tools/zone-lockdown/),
         * and
         * [WAF managed rules (previous version, deprecated)](https://developers.cloudflare.com/waf/reference/legacy/old-waf-managed-rules/).
         */
        id?: 'disable_security';
    }
    interface DisableZaraz {
        /**
         * Turn off [Zaraz](https://developers.cloudflare.com/zaraz/).
         */
        id?: 'disable_zaraz';
    }
    interface EdgeCacheTTL {
        /**
         * Specify how long to cache a resource in the Cloudflare global network. _Edge
         * Cache TTL_ is not visible in response headers.
         */
        id?: 'edge_cache_ttl';
        value?: number;
    }
    interface ExplicitCacheControl {
        /**
         * Origin Cache Control is enabled by default for Free, Pro, and Business domains
         * and disabled by default for Enterprise domains.
         */
        id?: 'explicit_cache_control';
        /**
         * The status of Origin Cache Control.
         */
        value?: 'on' | 'off';
    }
    interface ForwardingURL {
        /**
         * Redirects one URL to another using an `HTTP 301/302` redirect. Refer to
         * [Wildcard matching and referencing](https://developers.cloudflare.com/rules/page-rules/reference/wildcard-matching/).
         */
        id?: 'forwarding_url';
        value?: ForwardingURL.Value;
    }
    namespace ForwardingURL {
        interface Value {
            /**
             * The status code to use for the URL redirect. 301 is a permanent redirect. 302 is
             * a temporary redirect.
             */
            status_code?: 301 | 302;
            /**
             * The URL to redirect the request to. Notes: ${num} refers to the position of '\*'
             * in the constraint value.
             */
            url?: string;
        }
    }
    interface HostHeaderOverride {
        /**
         * Apply a specific host header.
         */
        id?: 'host_header_override';
        /**
         * The hostname to use in the `Host` header
         */
        value?: string;
    }
    interface ResolveOverride {
        /**
         * Change the origin address to the value specified in this setting.
         */
        id?: 'resolve_override';
        /**
         * The origin address you want to override with.
         */
        value?: string;
    }
    interface RespectStrongEtag {
        /**
         * Turn on or off byte-for-byte equivalency checks between the Cloudflare cache and
         * the origin server.
         */
        id?: 'respect_strong_etag';
        /**
         * The status of Respect Strong ETags
         */
        value?: 'on' | 'off';
    }
}
/**
 * URL target.
 */
export interface Target {
    /**
     * String constraint.
     */
    constraint?: Target.Constraint;
    /**
     * A target based on the URL of the request.
     */
    target?: 'url';
}
export declare namespace Target {
    /**
     * String constraint.
     */
    interface Constraint {
        /**
         * The matches operator can use asterisks and pipes as wildcard and 'or' operators.
         */
        operator: 'matches' | 'contains' | 'equals' | 'not_equal' | 'not_contain';
        /**
         * The URL pattern to match against the current request. The pattern may contain up
         * to four asterisks ('\*') as placeholders.
         */
        value: string;
    }
}
/**
 * URL target.
 */
export interface TargetParam {
    /**
     * String constraint.
     */
    constraint?: TargetParam.Constraint;
    /**
     * A target based on the URL of the request.
     */
    target?: 'url';
}
export declare namespace TargetParam {
    /**
     * String constraint.
     */
    interface Constraint {
        /**
         * The matches operator can use asterisks and pipes as wildcard and 'or' operators.
         */
        operator: 'matches' | 'contains' | 'equals' | 'not_equal' | 'not_contain';
        /**
         * The URL pattern to match against the current request. The pattern may contain up
         * to four asterisks ('\*') as placeholders.
         */
        value: string;
    }
}
export type PageRuleListResponse = Array<PageRule>;
export interface PageRuleDeleteResponse {
    /**
     * Identifier.
     */
    id: string;
}
export interface PageRuleCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The set of actions to perform if the targets of this rule match the
     * request. Actions can redirect to another URL or override settings, but not both.
     */
    actions: Array<SettingsAPI.AlwaysUseHTTPSParam | SettingsAPI.AutomaticHTTPSRewritesParam | SettingsAPI.BrowserCacheTTLParam | SettingsAPI.BrowserCheckParam | PageRuleCreateParams.BypassCacheOnCookie | PageRuleCreateParams.CacheByDeviceType | PageRuleCreateParams.CacheDeceptionArmor | PageRuleCreateParams.CacheKeyFields | SettingsAPI.CacheLevelParam | PageRuleCreateParams.CacheOnCookie | PageRuleCreateParams.CacheTTLByStatus | PageRuleCreateParams.DisableApps | PageRuleCreateParams.DisablePerformance | PageRuleCreateParams.DisableSecurity | PageRuleCreateParams.DisableZaraz | PageRuleCreateParams.EdgeCacheTTL | SettingsAPI.EmailObfuscationParam | PageRuleCreateParams.ExplicitCacheControl | PageRuleCreateParams.ForwardingURL | PageRuleCreateParams.HostHeaderOverride | SettingsAPI.IPGeolocationParam | SettingsAPI.MirageParam | SettingsAPI.OpportunisticEncryptionParam | SettingsAPI.OriginErrorPagePassThruParam | SettingsAPI.PolishParam | PageRuleCreateParams.ResolveOverride | PageRuleCreateParams.RespectStrongEtag | SettingsAPI.ResponseBufferingParam | SettingsAPI.RocketLoaderParam | SettingsAPI.SecurityLevelParam | SettingsAPI.SortQueryStringForCacheParam | SettingsAPI.SSLParam | SettingsAPI.TrueClientIPHeaderParam | SettingsAPI.WAFParam>;
    /**
     * Body param: The rule targets to evaluate on each request.
     */
    targets: Array<TargetParam>;
    /**
     * Body param: The priority of the rule, used to define which Page Rule is
     * processed over another. A higher number indicates a higher priority. For
     * example, if you have a catch-all Page Rule (rule A: `/images/*`) but want a more
     * specific Page Rule to take precedence (rule B: `/images/special/*`), specify a
     * higher priority for rule B so it overrides rule A.
     */
    priority?: number;
    /**
     * Body param: The status of the Page Rule.
     */
    status?: 'active' | 'disabled';
}
export declare namespace PageRuleCreateParams {
    interface BypassCacheOnCookie {
        /**
         * Bypass cache and fetch resources from the origin server if a regular expression
         * matches against a cookie name present in the request.
         */
        id?: 'bypass_cache_on_cookie';
        /**
         * The regular expression to use for matching cookie names in the request. Refer to
         * [Bypass Cache on Cookie setting](https://developers.cloudflare.com/rules/page-rules/reference/additional-reference/#bypass-cache-on-cookie-setting)
         * to learn about limited regular expression support.
         */
        value?: string;
    }
    interface CacheByDeviceType {
        /**
         * Separate cached content based on the visitor's device type.
         */
        id?: 'cache_by_device_type';
        /**
         * The status of Cache By Device Type.
         */
        value?: 'on' | 'off';
    }
    interface CacheDeceptionArmor {
        /**
         * Protect from web cache deception attacks while still allowing static assets to
         * be cached. This setting verifies that the URL's extension matches the returned
         * `Content-Type`.
         */
        id?: 'cache_deception_armor';
        /**
         * The status of Cache Deception Armor.
         */
        value?: 'on' | 'off';
    }
    interface CacheKeyFields {
        /**
         * Control specifically what variables to include when deciding which resources to
         * cache. This allows customers to determine what to cache based on something other
         * than just the URL.
         */
        id?: 'cache_key_fields';
        value?: CacheKeyFields.Value;
    }
    namespace CacheKeyFields {
        interface Value {
            /**
             * Controls which cookies appear in the Cache Key.
             */
            cookie?: Value.Cookie;
            /**
             * Controls which headers go into the Cache Key. Exactly one of `include` or
             * `exclude` is expected.
             */
            header?: Value.Header;
            /**
             * Determines which host header to include in the Cache Key.
             */
            host?: Value.Host;
            /**
             * Controls which URL query string parameters go into the Cache Key. Exactly one of
             * `include` or `exclude` is expected.
             */
            query_string?: Value.QueryString;
            /**
             * Feature fields to add features about the end-user (client) into the Cache Key.
             */
            user?: Value.User;
        }
        namespace Value {
            /**
             * Controls which cookies appear in the Cache Key.
             */
            interface Cookie {
                /**
                 * A list of cookies to check for the presence of, without including their actual
                 * values.
                 */
                check_presence?: Array<string>;
                /**
                 * A list of cookies to include.
                 */
                include?: Array<string>;
            }
            /**
             * Controls which headers go into the Cache Key. Exactly one of `include` or
             * `exclude` is expected.
             */
            interface Header {
                /**
                 * A list of headers to check for the presence of, without including their actual
                 * values.
                 */
                check_presence?: Array<string>;
                /**
                 * A list of headers to ignore.
                 */
                exclude?: Array<string>;
                /**
                 * A list of headers to include.
                 */
                include?: Array<string>;
            }
            /**
             * Determines which host header to include in the Cache Key.
             */
            interface Host {
                /**
                 * Whether to include the Host header in the HTTP request sent to the origin.
                 */
                resolved?: boolean;
            }
            /**
             * Controls which URL query string parameters go into the Cache Key. Exactly one of
             * `include` or `exclude` is expected.
             */
            interface QueryString {
                /**
                 * Ignore all query string parameters.
                 */
                exclude?: '*' | Array<string>;
                /**
                 * Include all query string parameters.
                 */
                include?: '*' | Array<string>;
            }
            /**
             * Feature fields to add features about the end-user (client) into the Cache Key.
             */
            interface User {
                /**
                 * Classifies a request as `mobile`, `desktop`, or `tablet` based on the User
                 * Agent.
                 */
                device_type?: boolean;
                /**
                 * Includes the client's country, derived from the IP address.
                 */
                geo?: boolean;
                /**
                 * Includes the first language code contained in the `Accept-Language` header sent
                 * by the client.
                 */
                lang?: boolean;
            }
        }
    }
    interface CacheOnCookie {
        /**
         * Apply the Cache Everything option (Cache Level setting) based on a regular
         * expression match against a cookie name.
         */
        id?: 'cache_on_cookie';
        /**
         * The regular expression to use for matching cookie names in the request.
         */
        value?: string;
    }
    interface CacheTTLByStatus {
        /**
         * Enterprise customers can set cache time-to-live (TTL) based on the response
         * status from the origin web server. Cache TTL refers to the duration of a
         * resource in the Cloudflare network before being marked as stale or discarded
         * from cache. Status codes are returned by a resource's origin. Setting cache TTL
         * based on response status overrides the default cache behavior (standard caching)
         * for static files and overrides cache instructions sent by the origin web server.
         * To cache non-static assets, set a Cache Level of Cache Everything using a Page
         * Rule. Setting no-store Cache-Control or a low TTL (using `max-age`/`s-maxage`)
         * increases requests to origin web servers and decreases performance.
         */
        id?: 'cache_ttl_by_status';
        /**
         * A JSON object containing status codes and their corresponding TTLs. Each
         * key-value pair in the cache TTL by status cache rule has the following syntax
         *
         * - `status_code`: An integer value such as 200 or 500. status_code matches the
         *   exact status code from the origin web server. Valid status codes are between
         *   100-999.
         * - `status_code_range`: Integer values for from and to. status_code_range matches
         *   any status code from the origin web server within the specified range.
         * - `value`: An integer value that defines the duration an asset is valid in
         *   seconds or one of the following strings: no-store (equivalent to -1), no-cache
         *   (equivalent to 0).
         */
        value?: {
            [key: string]: 'no-cache' | 'no-store' | number;
        };
    }
    interface DisableApps {
        /**
         * Turn off all active
         * [Cloudflare Apps](https://developers.cloudflare.com/support/more-dashboard-apps/cloudflare-apps/)
         * (deprecated).
         */
        id?: 'disable_apps';
    }
    interface DisablePerformance {
        /**
         * Turn off
         * [Rocket Loader](https://developers.cloudflare.com/speed/optimization/content/rocket-loader/),
         * [Mirage](https://developers.cloudflare.com/speed/optimization/images/mirage/),
         * and [Polish](https://developers.cloudflare.com/images/polish/).
         */
        id?: 'disable_performance';
    }
    interface DisableSecurity {
        /**
         * Turn off
         * [Email Obfuscation](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/),
         * [Rate Limiting (previous version, deprecated)](https://developers.cloudflare.com/waf/reference/legacy/old-rate-limiting/),
         * [Scrape Shield](https://developers.cloudflare.com/waf/tools/scrape-shield/),
         * [URL (Zone) Lockdown](https://developers.cloudflare.com/waf/tools/zone-lockdown/),
         * and
         * [WAF managed rules (previous version, deprecated)](https://developers.cloudflare.com/waf/reference/legacy/old-waf-managed-rules/).
         */
        id?: 'disable_security';
    }
    interface DisableZaraz {
        /**
         * Turn off [Zaraz](https://developers.cloudflare.com/zaraz/).
         */
        id?: 'disable_zaraz';
    }
    interface EdgeCacheTTL {
        /**
         * Specify how long to cache a resource in the Cloudflare global network. _Edge
         * Cache TTL_ is not visible in response headers.
         */
        id?: 'edge_cache_ttl';
        value?: number;
    }
    interface ExplicitCacheControl {
        /**
         * Origin Cache Control is enabled by default for Free, Pro, and Business domains
         * and disabled by default for Enterprise domains.
         */
        id?: 'explicit_cache_control';
        /**
         * The status of Origin Cache Control.
         */
        value?: 'on' | 'off';
    }
    interface ForwardingURL {
        /**
         * Redirects one URL to another using an `HTTP 301/302` redirect. Refer to
         * [Wildcard matching and referencing](https://developers.cloudflare.com/rules/page-rules/reference/wildcard-matching/).
         */
        id?: 'forwarding_url';
        value?: ForwardingURL.Value;
    }
    namespace ForwardingURL {
        interface Value {
            /**
             * The status code to use for the URL redirect. 301 is a permanent redirect. 302 is
             * a temporary redirect.
             */
            status_code?: 301 | 302;
            /**
             * The URL to redirect the request to. Notes: ${num} refers to the position of '\*'
             * in the constraint value.
             */
            url?: string;
        }
    }
    interface HostHeaderOverride {
        /**
         * Apply a specific host header.
         */
        id?: 'host_header_override';
        /**
         * The hostname to use in the `Host` header
         */
        value?: string;
    }
    interface ResolveOverride {
        /**
         * Change the origin address to the value specified in this setting.
         */
        id?: 'resolve_override';
        /**
         * The origin address you want to override with.
         */
        value?: string;
    }
    interface RespectStrongEtag {
        /**
         * Turn on or off byte-for-byte equivalency checks between the Cloudflare cache and
         * the origin server.
         */
        id?: 'respect_strong_etag';
        /**
         * The status of Respect Strong ETags
         */
        value?: 'on' | 'off';
    }
}
export interface PageRuleUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The set of actions to perform if the targets of this rule match the
     * request. Actions can redirect to another URL or override settings, but not both.
     */
    actions: Array<SettingsAPI.AlwaysUseHTTPSParam | SettingsAPI.AutomaticHTTPSRewritesParam | SettingsAPI.BrowserCacheTTLParam | SettingsAPI.BrowserCheckParam | PageRuleUpdateParams.BypassCacheOnCookie | PageRuleUpdateParams.CacheByDeviceType | PageRuleUpdateParams.CacheDeceptionArmor | PageRuleUpdateParams.CacheKeyFields | SettingsAPI.CacheLevelParam | PageRuleUpdateParams.CacheOnCookie | PageRuleUpdateParams.CacheTTLByStatus | PageRuleUpdateParams.DisableApps | PageRuleUpdateParams.DisablePerformance | PageRuleUpdateParams.DisableSecurity | PageRuleUpdateParams.DisableZaraz | PageRuleUpdateParams.EdgeCacheTTL | SettingsAPI.EmailObfuscationParam | PageRuleUpdateParams.ExplicitCacheControl | PageRuleUpdateParams.ForwardingURL | PageRuleUpdateParams.HostHeaderOverride | SettingsAPI.IPGeolocationParam | SettingsAPI.MirageParam | SettingsAPI.OpportunisticEncryptionParam | SettingsAPI.OriginErrorPagePassThruParam | SettingsAPI.PolishParam | PageRuleUpdateParams.ResolveOverride | PageRuleUpdateParams.RespectStrongEtag | SettingsAPI.ResponseBufferingParam | SettingsAPI.RocketLoaderParam | SettingsAPI.SecurityLevelParam | SettingsAPI.SortQueryStringForCacheParam | SettingsAPI.SSLParam | SettingsAPI.TrueClientIPHeaderParam | SettingsAPI.WAFParam>;
    /**
     * Body param: The rule targets to evaluate on each request.
     */
    targets: Array<TargetParam>;
    /**
     * Body param: The priority of the rule, used to define which Page Rule is
     * processed over another. A higher number indicates a higher priority. For
     * example, if you have a catch-all Page Rule (rule A: `/images/*`) but want a more
     * specific Page Rule to take precedence (rule B: `/images/special/*`), specify a
     * higher priority for rule B so it overrides rule A.
     */
    priority?: number;
    /**
     * Body param: The status of the Page Rule.
     */
    status?: 'active' | 'disabled';
}
export declare namespace PageRuleUpdateParams {
    interface BypassCacheOnCookie {
        /**
         * Bypass cache and fetch resources from the origin server if a regular expression
         * matches against a cookie name present in the request.
         */
        id?: 'bypass_cache_on_cookie';
        /**
         * The regular expression to use for matching cookie names in the request. Refer to
         * [Bypass Cache on Cookie setting](https://developers.cloudflare.com/rules/page-rules/reference/additional-reference/#bypass-cache-on-cookie-setting)
         * to learn about limited regular expression support.
         */
        value?: string;
    }
    interface CacheByDeviceType {
        /**
         * Separate cached content based on the visitor's device type.
         */
        id?: 'cache_by_device_type';
        /**
         * The status of Cache By Device Type.
         */
        value?: 'on' | 'off';
    }
    interface CacheDeceptionArmor {
        /**
         * Protect from web cache deception attacks while still allowing static assets to
         * be cached. This setting verifies that the URL's extension matches the returned
         * `Content-Type`.
         */
        id?: 'cache_deception_armor';
        /**
         * The status of Cache Deception Armor.
         */
        value?: 'on' | 'off';
    }
    interface CacheKeyFields {
        /**
         * Control specifically what variables to include when deciding which resources to
         * cache. This allows customers to determine what to cache based on something other
         * than just the URL.
         */
        id?: 'cache_key_fields';
        value?: CacheKeyFields.Value;
    }
    namespace CacheKeyFields {
        interface Value {
            /**
             * Controls which cookies appear in the Cache Key.
             */
            cookie?: Value.Cookie;
            /**
             * Controls which headers go into the Cache Key. Exactly one of `include` or
             * `exclude` is expected.
             */
            header?: Value.Header;
            /**
             * Determines which host header to include in the Cache Key.
             */
            host?: Value.Host;
            /**
             * Controls which URL query string parameters go into the Cache Key. Exactly one of
             * `include` or `exclude` is expected.
             */
            query_string?: Value.QueryString;
            /**
             * Feature fields to add features about the end-user (client) into the Cache Key.
             */
            user?: Value.User;
        }
        namespace Value {
            /**
             * Controls which cookies appear in the Cache Key.
             */
            interface Cookie {
                /**
                 * A list of cookies to check for the presence of, without including their actual
                 * values.
                 */
                check_presence?: Array<string>;
                /**
                 * A list of cookies to include.
                 */
                include?: Array<string>;
            }
            /**
             * Controls which headers go into the Cache Key. Exactly one of `include` or
             * `exclude` is expected.
             */
            interface Header {
                /**
                 * A list of headers to check for the presence of, without including their actual
                 * values.
                 */
                check_presence?: Array<string>;
                /**
                 * A list of headers to ignore.
                 */
                exclude?: Array<string>;
                /**
                 * A list of headers to include.
                 */
                include?: Array<string>;
            }
            /**
             * Determines which host header to include in the Cache Key.
             */
            interface Host {
                /**
                 * Whether to include the Host header in the HTTP request sent to the origin.
                 */
                resolved?: boolean;
            }
            /**
             * Controls which URL query string parameters go into the Cache Key. Exactly one of
             * `include` or `exclude` is expected.
             */
            interface QueryString {
                /**
                 * Ignore all query string parameters.
                 */
                exclude?: '*' | Array<string>;
                /**
                 * Include all query string parameters.
                 */
                include?: '*' | Array<string>;
            }
            /**
             * Feature fields to add features about the end-user (client) into the Cache Key.
             */
            interface User {
                /**
                 * Classifies a request as `mobile`, `desktop`, or `tablet` based on the User
                 * Agent.
                 */
                device_type?: boolean;
                /**
                 * Includes the client's country, derived from the IP address.
                 */
                geo?: boolean;
                /**
                 * Includes the first language code contained in the `Accept-Language` header sent
                 * by the client.
                 */
                lang?: boolean;
            }
        }
    }
    interface CacheOnCookie {
        /**
         * Apply the Cache Everything option (Cache Level setting) based on a regular
         * expression match against a cookie name.
         */
        id?: 'cache_on_cookie';
        /**
         * The regular expression to use for matching cookie names in the request.
         */
        value?: string;
    }
    interface CacheTTLByStatus {
        /**
         * Enterprise customers can set cache time-to-live (TTL) based on the response
         * status from the origin web server. Cache TTL refers to the duration of a
         * resource in the Cloudflare network before being marked as stale or discarded
         * from cache. Status codes are returned by a resource's origin. Setting cache TTL
         * based on response status overrides the default cache behavior (standard caching)
         * for static files and overrides cache instructions sent by the origin web server.
         * To cache non-static assets, set a Cache Level of Cache Everything using a Page
         * Rule. Setting no-store Cache-Control or a low TTL (using `max-age`/`s-maxage`)
         * increases requests to origin web servers and decreases performance.
         */
        id?: 'cache_ttl_by_status';
        /**
         * A JSON object containing status codes and their corresponding TTLs. Each
         * key-value pair in the cache TTL by status cache rule has the following syntax
         *
         * - `status_code`: An integer value such as 200 or 500. status_code matches the
         *   exact status code from the origin web server. Valid status codes are between
         *   100-999.
         * - `status_code_range`: Integer values for from and to. status_code_range matches
         *   any status code from the origin web server within the specified range.
         * - `value`: An integer value that defines the duration an asset is valid in
         *   seconds or one of the following strings: no-store (equivalent to -1), no-cache
         *   (equivalent to 0).
         */
        value?: {
            [key: string]: 'no-cache' | 'no-store' | number;
        };
    }
    interface DisableApps {
        /**
         * Turn off all active
         * [Cloudflare Apps](https://developers.cloudflare.com/support/more-dashboard-apps/cloudflare-apps/)
         * (deprecated).
         */
        id?: 'disable_apps';
    }
    interface DisablePerformance {
        /**
         * Turn off
         * [Rocket Loader](https://developers.cloudflare.com/speed/optimization/content/rocket-loader/),
         * [Mirage](https://developers.cloudflare.com/speed/optimization/images/mirage/),
         * and [Polish](https://developers.cloudflare.com/images/polish/).
         */
        id?: 'disable_performance';
    }
    interface DisableSecurity {
        /**
         * Turn off
         * [Email Obfuscation](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/),
         * [Rate Limiting (previous version, deprecated)](https://developers.cloudflare.com/waf/reference/legacy/old-rate-limiting/),
         * [Scrape Shield](https://developers.cloudflare.com/waf/tools/scrape-shield/),
         * [URL (Zone) Lockdown](https://developers.cloudflare.com/waf/tools/zone-lockdown/),
         * and
         * [WAF managed rules (previous version, deprecated)](https://developers.cloudflare.com/waf/reference/legacy/old-waf-managed-rules/).
         */
        id?: 'disable_security';
    }
    interface DisableZaraz {
        /**
         * Turn off [Zaraz](https://developers.cloudflare.com/zaraz/).
         */
        id?: 'disable_zaraz';
    }
    interface EdgeCacheTTL {
        /**
         * Specify how long to cache a resource in the Cloudflare global network. _Edge
         * Cache TTL_ is not visible in response headers.
         */
        id?: 'edge_cache_ttl';
        value?: number;
    }
    interface ExplicitCacheControl {
        /**
         * Origin Cache Control is enabled by default for Free, Pro, and Business domains
         * and disabled by default for Enterprise domains.
         */
        id?: 'explicit_cache_control';
        /**
         * The status of Origin Cache Control.
         */
        value?: 'on' | 'off';
    }
    interface ForwardingURL {
        /**
         * Redirects one URL to another using an `HTTP 301/302` redirect. Refer to
         * [Wildcard matching and referencing](https://developers.cloudflare.com/rules/page-rules/reference/wildcard-matching/).
         */
        id?: 'forwarding_url';
        value?: ForwardingURL.Value;
    }
    namespace ForwardingURL {
        interface Value {
            /**
             * The status code to use for the URL redirect. 301 is a permanent redirect. 302 is
             * a temporary redirect.
             */
            status_code?: 301 | 302;
            /**
             * The URL to redirect the request to. Notes: ${num} refers to the position of '\*'
             * in the constraint value.
             */
            url?: string;
        }
    }
    interface HostHeaderOverride {
        /**
         * Apply a specific host header.
         */
        id?: 'host_header_override';
        /**
         * The hostname to use in the `Host` header
         */
        value?: string;
    }
    interface ResolveOverride {
        /**
         * Change the origin address to the value specified in this setting.
         */
        id?: 'resolve_override';
        /**
         * The origin address you want to override with.
         */
        value?: string;
    }
    interface RespectStrongEtag {
        /**
         * Turn on or off byte-for-byte equivalency checks between the Cloudflare cache and
         * the origin server.
         */
        id?: 'respect_strong_etag';
        /**
         * The status of Respect Strong ETags
         */
        value?: 'on' | 'off';
    }
}
export interface PageRuleListParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: The direction used to sort returned Page Rules.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: When set to `all`, all the search requirements must match. When set
     * to `any`, only one of the search requirements has to match.
     */
    match?: 'any' | 'all';
    /**
     * Query param: The field used to sort returned Page Rules.
     */
    order?: 'status' | 'priority';
    /**
     * Query param: The status of the Page Rule.
     */
    status?: 'active' | 'disabled';
}
export interface PageRuleDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface PageRuleEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The set of actions to perform if the targets of this rule match the
     * request. Actions can redirect to another URL or override settings, but not both.
     */
    actions?: Array<SettingsAPI.AlwaysUseHTTPSParam | SettingsAPI.AutomaticHTTPSRewritesParam | SettingsAPI.BrowserCacheTTLParam | SettingsAPI.BrowserCheckParam | PageRuleEditParams.BypassCacheOnCookie | PageRuleEditParams.CacheByDeviceType | PageRuleEditParams.CacheDeceptionArmor | PageRuleEditParams.CacheKeyFields | SettingsAPI.CacheLevelParam | PageRuleEditParams.CacheOnCookie | PageRuleEditParams.CacheTTLByStatus | PageRuleEditParams.DisableApps | PageRuleEditParams.DisablePerformance | PageRuleEditParams.DisableSecurity | PageRuleEditParams.DisableZaraz | PageRuleEditParams.EdgeCacheTTL | SettingsAPI.EmailObfuscationParam | PageRuleEditParams.ExplicitCacheControl | PageRuleEditParams.ForwardingURL | PageRuleEditParams.HostHeaderOverride | SettingsAPI.IPGeolocationParam | SettingsAPI.MirageParam | SettingsAPI.OpportunisticEncryptionParam | SettingsAPI.OriginErrorPagePassThruParam | SettingsAPI.PolishParam | PageRuleEditParams.ResolveOverride | PageRuleEditParams.RespectStrongEtag | SettingsAPI.ResponseBufferingParam | SettingsAPI.RocketLoaderParam | SettingsAPI.SecurityLevelParam | SettingsAPI.SortQueryStringForCacheParam | SettingsAPI.SSLParam | SettingsAPI.TrueClientIPHeaderParam | SettingsAPI.WAFParam>;
    /**
     * Body param: The priority of the rule, used to define which Page Rule is
     * processed over another. A higher number indicates a higher priority. For
     * example, if you have a catch-all Page Rule (rule A: `/images/*`) but want a more
     * specific Page Rule to take precedence (rule B: `/images/special/*`), specify a
     * higher priority for rule B so it overrides rule A.
     */
    priority?: number;
    /**
     * Body param: The status of the Page Rule.
     */
    status?: 'active' | 'disabled';
    /**
     * Body param: The rule targets to evaluate on each request.
     */
    targets?: Array<TargetParam>;
}
export declare namespace PageRuleEditParams {
    interface BypassCacheOnCookie {
        /**
         * Bypass cache and fetch resources from the origin server if a regular expression
         * matches against a cookie name present in the request.
         */
        id?: 'bypass_cache_on_cookie';
        /**
         * The regular expression to use for matching cookie names in the request. Refer to
         * [Bypass Cache on Cookie setting](https://developers.cloudflare.com/rules/page-rules/reference/additional-reference/#bypass-cache-on-cookie-setting)
         * to learn about limited regular expression support.
         */
        value?: string;
    }
    interface CacheByDeviceType {
        /**
         * Separate cached content based on the visitor's device type.
         */
        id?: 'cache_by_device_type';
        /**
         * The status of Cache By Device Type.
         */
        value?: 'on' | 'off';
    }
    interface CacheDeceptionArmor {
        /**
         * Protect from web cache deception attacks while still allowing static assets to
         * be cached. This setting verifies that the URL's extension matches the returned
         * `Content-Type`.
         */
        id?: 'cache_deception_armor';
        /**
         * The status of Cache Deception Armor.
         */
        value?: 'on' | 'off';
    }
    interface CacheKeyFields {
        /**
         * Control specifically what variables to include when deciding which resources to
         * cache. This allows customers to determine what to cache based on something other
         * than just the URL.
         */
        id?: 'cache_key_fields';
        value?: CacheKeyFields.Value;
    }
    namespace CacheKeyFields {
        interface Value {
            /**
             * Controls which cookies appear in the Cache Key.
             */
            cookie?: Value.Cookie;
            /**
             * Controls which headers go into the Cache Key. Exactly one of `include` or
             * `exclude` is expected.
             */
            header?: Value.Header;
            /**
             * Determines which host header to include in the Cache Key.
             */
            host?: Value.Host;
            /**
             * Controls which URL query string parameters go into the Cache Key. Exactly one of
             * `include` or `exclude` is expected.
             */
            query_string?: Value.QueryString;
            /**
             * Feature fields to add features about the end-user (client) into the Cache Key.
             */
            user?: Value.User;
        }
        namespace Value {
            /**
             * Controls which cookies appear in the Cache Key.
             */
            interface Cookie {
                /**
                 * A list of cookies to check for the presence of, without including their actual
                 * values.
                 */
                check_presence?: Array<string>;
                /**
                 * A list of cookies to include.
                 */
                include?: Array<string>;
            }
            /**
             * Controls which headers go into the Cache Key. Exactly one of `include` or
             * `exclude` is expected.
             */
            interface Header {
                /**
                 * A list of headers to check for the presence of, without including their actual
                 * values.
                 */
                check_presence?: Array<string>;
                /**
                 * A list of headers to ignore.
                 */
                exclude?: Array<string>;
                /**
                 * A list of headers to include.
                 */
                include?: Array<string>;
            }
            /**
             * Determines which host header to include in the Cache Key.
             */
            interface Host {
                /**
                 * Whether to include the Host header in the HTTP request sent to the origin.
                 */
                resolved?: boolean;
            }
            /**
             * Controls which URL query string parameters go into the Cache Key. Exactly one of
             * `include` or `exclude` is expected.
             */
            interface QueryString {
                /**
                 * Ignore all query string parameters.
                 */
                exclude?: '*' | Array<string>;
                /**
                 * Include all query string parameters.
                 */
                include?: '*' | Array<string>;
            }
            /**
             * Feature fields to add features about the end-user (client) into the Cache Key.
             */
            interface User {
                /**
                 * Classifies a request as `mobile`, `desktop`, or `tablet` based on the User
                 * Agent.
                 */
                device_type?: boolean;
                /**
                 * Includes the client's country, derived from the IP address.
                 */
                geo?: boolean;
                /**
                 * Includes the first language code contained in the `Accept-Language` header sent
                 * by the client.
                 */
                lang?: boolean;
            }
        }
    }
    interface CacheOnCookie {
        /**
         * Apply the Cache Everything option (Cache Level setting) based on a regular
         * expression match against a cookie name.
         */
        id?: 'cache_on_cookie';
        /**
         * The regular expression to use for matching cookie names in the request.
         */
        value?: string;
    }
    interface CacheTTLByStatus {
        /**
         * Enterprise customers can set cache time-to-live (TTL) based on the response
         * status from the origin web server. Cache TTL refers to the duration of a
         * resource in the Cloudflare network before being marked as stale or discarded
         * from cache. Status codes are returned by a resource's origin. Setting cache TTL
         * based on response status overrides the default cache behavior (standard caching)
         * for static files and overrides cache instructions sent by the origin web server.
         * To cache non-static assets, set a Cache Level of Cache Everything using a Page
         * Rule. Setting no-store Cache-Control or a low TTL (using `max-age`/`s-maxage`)
         * increases requests to origin web servers and decreases performance.
         */
        id?: 'cache_ttl_by_status';
        /**
         * A JSON object containing status codes and their corresponding TTLs. Each
         * key-value pair in the cache TTL by status cache rule has the following syntax
         *
         * - `status_code`: An integer value such as 200 or 500. status_code matches the
         *   exact status code from the origin web server. Valid status codes are between
         *   100-999.
         * - `status_code_range`: Integer values for from and to. status_code_range matches
         *   any status code from the origin web server within the specified range.
         * - `value`: An integer value that defines the duration an asset is valid in
         *   seconds or one of the following strings: no-store (equivalent to -1), no-cache
         *   (equivalent to 0).
         */
        value?: {
            [key: string]: 'no-cache' | 'no-store' | number;
        };
    }
    interface DisableApps {
        /**
         * Turn off all active
         * [Cloudflare Apps](https://developers.cloudflare.com/support/more-dashboard-apps/cloudflare-apps/)
         * (deprecated).
         */
        id?: 'disable_apps';
    }
    interface DisablePerformance {
        /**
         * Turn off
         * [Rocket Loader](https://developers.cloudflare.com/speed/optimization/content/rocket-loader/),
         * [Mirage](https://developers.cloudflare.com/speed/optimization/images/mirage/),
         * and [Polish](https://developers.cloudflare.com/images/polish/).
         */
        id?: 'disable_performance';
    }
    interface DisableSecurity {
        /**
         * Turn off
         * [Email Obfuscation](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/),
         * [Rate Limiting (previous version, deprecated)](https://developers.cloudflare.com/waf/reference/legacy/old-rate-limiting/),
         * [Scrape Shield](https://developers.cloudflare.com/waf/tools/scrape-shield/),
         * [URL (Zone) Lockdown](https://developers.cloudflare.com/waf/tools/zone-lockdown/),
         * and
         * [WAF managed rules (previous version, deprecated)](https://developers.cloudflare.com/waf/reference/legacy/old-waf-managed-rules/).
         */
        id?: 'disable_security';
    }
    interface DisableZaraz {
        /**
         * Turn off [Zaraz](https://developers.cloudflare.com/zaraz/).
         */
        id?: 'disable_zaraz';
    }
    interface EdgeCacheTTL {
        /**
         * Specify how long to cache a resource in the Cloudflare global network. _Edge
         * Cache TTL_ is not visible in response headers.
         */
        id?: 'edge_cache_ttl';
        value?: number;
    }
    interface ExplicitCacheControl {
        /**
         * Origin Cache Control is enabled by default for Free, Pro, and Business domains
         * and disabled by default for Enterprise domains.
         */
        id?: 'explicit_cache_control';
        /**
         * The status of Origin Cache Control.
         */
        value?: 'on' | 'off';
    }
    interface ForwardingURL {
        /**
         * Redirects one URL to another using an `HTTP 301/302` redirect. Refer to
         * [Wildcard matching and referencing](https://developers.cloudflare.com/rules/page-rules/reference/wildcard-matching/).
         */
        id?: 'forwarding_url';
        value?: ForwardingURL.Value;
    }
    namespace ForwardingURL {
        interface Value {
            /**
             * The status code to use for the URL redirect. 301 is a permanent redirect. 302 is
             * a temporary redirect.
             */
            status_code?: 301 | 302;
            /**
             * The URL to redirect the request to. Notes: ${num} refers to the position of '\*'
             * in the constraint value.
             */
            url?: string;
        }
    }
    interface HostHeaderOverride {
        /**
         * Apply a specific host header.
         */
        id?: 'host_header_override';
        /**
         * The hostname to use in the `Host` header
         */
        value?: string;
    }
    interface ResolveOverride {
        /**
         * Change the origin address to the value specified in this setting.
         */
        id?: 'resolve_override';
        /**
         * The origin address you want to override with.
         */
        value?: string;
    }
    interface RespectStrongEtag {
        /**
         * Turn on or off byte-for-byte equivalency checks between the Cloudflare cache and
         * the origin server.
         */
        id?: 'respect_strong_etag';
        /**
         * The status of Respect Strong ETags
         */
        value?: 'on' | 'off';
    }
}
export interface PageRuleGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace PageRules {
    export { type PageRule as PageRule, type Target as Target, type PageRuleListResponse as PageRuleListResponse, type PageRuleDeleteResponse as PageRuleDeleteResponse, type PageRuleCreateParams as PageRuleCreateParams, type PageRuleUpdateParams as PageRuleUpdateParams, type PageRuleListParams as PageRuleListParams, type PageRuleDeleteParams as PageRuleDeleteParams, type PageRuleEditParams as PageRuleEditParams, type PageRuleGetParams as PageRuleGetParams, };
}
//# sourceMappingURL=page-rules.d.ts.map