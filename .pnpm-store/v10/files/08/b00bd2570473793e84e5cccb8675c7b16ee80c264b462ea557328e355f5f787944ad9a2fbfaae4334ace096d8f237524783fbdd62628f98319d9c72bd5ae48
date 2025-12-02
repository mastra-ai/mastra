import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as OverridesAPI from "./waf/overrides.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Lockdowns extends APIResource {
    /**
     * Creates a new Zone Lockdown rule.
     *
     * @example
     * ```ts
     * const lockdown = await client.firewall.lockdowns.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   configurations: [{}],
     *   urls: ['shop.example.com/*'],
     * });
     * ```
     */
    create(params: LockdownCreateParams, options?: Core.RequestOptions): Core.APIPromise<Lockdown>;
    /**
     * Updates an existing Zone Lockdown rule.
     *
     * @example
     * ```ts
     * const lockdown = await client.firewall.lockdowns.update(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     configurations: [{}],
     *     urls: ['shop.example.com/*'],
     *   },
     * );
     * ```
     */
    update(lockDownsId: string, params: LockdownUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Lockdown>;
    /**
     * Fetches Zone Lockdown rules. You can filter the results using several optional
     * parameters.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const lockdown of client.firewall.lockdowns.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: LockdownListParams, options?: Core.RequestOptions): Core.PagePromise<LockdownsV4PagePaginationArray, Lockdown>;
    /**
     * Deletes an existing Zone Lockdown rule.
     *
     * @example
     * ```ts
     * const lockdown = await client.firewall.lockdowns.delete(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(lockDownsId: string, params: LockdownDeleteParams, options?: Core.RequestOptions): Core.APIPromise<LockdownDeleteResponse>;
    /**
     * Fetches the details of a Zone Lockdown rule.
     *
     * @example
     * ```ts
     * const lockdown = await client.firewall.lockdowns.get(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(lockDownsId: string, params: LockdownGetParams, options?: Core.RequestOptions): Core.APIPromise<Lockdown>;
}
export declare class LockdownsV4PagePaginationArray extends V4PagePaginationArray<Lockdown> {
}
/**
 * A list of IP addresses or CIDR ranges that will be allowed to access the URLs
 * specified in the Zone Lockdown rule. You can include any number of `ip` or
 * `ip_range` configurations.
 */
export type Configuration = Array<LockdownIPConfiguration | LockdownCIDRConfiguration>;
/**
 * A list of IP addresses or CIDR ranges that will be allowed to access the URLs
 * specified in the Zone Lockdown rule. You can include any number of `ip` or
 * `ip_range` configurations.
 */
export type ConfigurationParam = Array<LockdownIPConfigurationParam | LockdownCIDRConfigurationParam>;
export interface Lockdown {
    /**
     * The unique identifier of the Zone Lockdown rule.
     */
    id: string;
    /**
     * A list of IP addresses or CIDR ranges that will be allowed to access the URLs
     * specified in the Zone Lockdown rule. You can include any number of `ip` or
     * `ip_range` configurations.
     */
    configurations: Configuration;
    /**
     * The timestamp of when the rule was created.
     */
    created_on: string;
    /**
     * An informative summary of the rule.
     */
    description: string;
    /**
     * The timestamp of when the rule was last modified.
     */
    modified_on: string;
    /**
     * When true, indicates that the rule is currently paused.
     */
    paused: boolean;
    /**
     * The URLs to include in the rule definition. You can use wildcards. Each entered
     * URL will be escaped before use, which means you can only use simple wildcard
     * patterns.
     */
    urls: Array<LockdownURL>;
}
export interface LockdownCIDRConfiguration {
    /**
     * The configuration target. You must set the target to `ip_range` when specifying
     * an IP address range in the Zone Lockdown rule.
     */
    target?: 'ip_range';
    /**
     * The IP address range to match. You can only use prefix lengths `/16` and `/24`.
     */
    value?: string;
}
export interface LockdownCIDRConfigurationParam {
    /**
     * The configuration target. You must set the target to `ip_range` when specifying
     * an IP address range in the Zone Lockdown rule.
     */
    target?: 'ip_range';
    /**
     * The IP address range to match. You can only use prefix lengths `/16` and `/24`.
     */
    value?: string;
}
export interface LockdownIPConfiguration {
    /**
     * The configuration target. You must set the target to `ip` when specifying an IP
     * address in the Zone Lockdown rule.
     */
    target?: 'ip';
    /**
     * The IP address to match. This address will be compared to the IP address of
     * incoming requests.
     */
    value?: string;
}
export interface LockdownIPConfigurationParam {
    /**
     * The configuration target. You must set the target to `ip` when specifying an IP
     * address in the Zone Lockdown rule.
     */
    target?: 'ip';
    /**
     * The IP address to match. This address will be compared to the IP address of
     * incoming requests.
     */
    value?: string;
}
export type LockdownURL = string;
export interface LockdownDeleteResponse {
    /**
     * The unique identifier of the Zone Lockdown rule.
     */
    id?: string;
}
export interface LockdownCreateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: A list of IP addresses or CIDR ranges that will be allowed to access
     * the URLs specified in the Zone Lockdown rule. You can include any number of `ip`
     * or `ip_range` configurations.
     */
    configurations: ConfigurationParam;
    /**
     * Body param: The URLs to include in the current WAF override. You can use
     * wildcards. Each entered URL will be escaped before use, which means you can only
     * use simple wildcard patterns.
     */
    urls: Array<OverridesAPI.OverrideURLParam>;
    /**
     * Body param: An informative summary of the rule. This value is sanitized and any
     * tags will be removed.
     */
    description?: string;
    /**
     * Body param: When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
    /**
     * Body param: The priority of the rule to control the processing order. A lower
     * number indicates higher priority. If not provided, any rules with a configured
     * priority will be processed before rules without a priority.
     */
    priority?: number;
}
export interface LockdownUpdateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: A list of IP addresses or CIDR ranges that will be allowed to access
     * the URLs specified in the Zone Lockdown rule. You can include any number of `ip`
     * or `ip_range` configurations.
     */
    configurations: ConfigurationParam;
    /**
     * Body param: The URLs to include in the current WAF override. You can use
     * wildcards. Each entered URL will be escaped before use, which means you can only
     * use simple wildcard patterns.
     */
    urls: Array<OverridesAPI.OverrideURLParam>;
}
export interface LockdownListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Query param: The timestamp of when the rule was created.
     */
    created_on?: string;
    /**
     * Query param: A string to search for in the description of existing rules.
     */
    description?: string;
    /**
     * Query param: A string to search for in the description of existing rules.
     */
    description_search?: string;
    /**
     * Query param: A single IP address to search for in existing rules.
     */
    ip?: string;
    /**
     * Query param: A single IP address range to search for in existing rules.
     */
    ip_range_search?: string;
    /**
     * Query param: A single IP address to search for in existing rules.
     */
    ip_search?: string;
    /**
     * Query param: The timestamp of when the rule was last modified.
     */
    modified_on?: string;
    /**
     * Query param: The priority of the rule to control the processing order. A lower
     * number indicates higher priority. If not provided, any rules with a configured
     * priority will be processed before rules without a priority.
     */
    priority?: number;
    /**
     * Query param: A single URI to search for in the list of URLs of existing rules.
     */
    uri_search?: string;
}
export interface LockdownDeleteParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface LockdownGetParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace Lockdowns {
    export { type Configuration as Configuration, type Lockdown as Lockdown, type LockdownCIDRConfiguration as LockdownCIDRConfiguration, type LockdownIPConfiguration as LockdownIPConfiguration, type LockdownURL as LockdownURL, type LockdownDeleteResponse as LockdownDeleteResponse, LockdownsV4PagePaginationArray as LockdownsV4PagePaginationArray, type LockdownCreateParams as LockdownCreateParams, type LockdownUpdateParams as LockdownUpdateParams, type LockdownListParams as LockdownListParams, type LockdownDeleteParams as LockdownDeleteParams, type LockdownGetParams as LockdownGetParams, };
}
//# sourceMappingURL=lockdowns.d.ts.map