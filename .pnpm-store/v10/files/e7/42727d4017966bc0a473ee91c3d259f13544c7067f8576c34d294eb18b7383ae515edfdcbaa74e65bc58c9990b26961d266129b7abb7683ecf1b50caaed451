import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class AccessRules extends APIResource {
    /**
     * Creates a new IP Access rule for an account or zone. The rule will apply to all
     * zones in the account or zone.
     *
     * Note: To create an IP Access rule that applies to a single zone, refer to the
     * [IP Access rules for a zone](#ip-access-rules-for-a-zone) endpoints.
     *
     * @example
     * ```ts
     * const accessRule = await client.firewall.accessRules.create(
     *   {
     *     configuration: {},
     *     mode: 'challenge',
     *     account_id: 'account_id',
     *   },
     * );
     * ```
     */
    create(params: AccessRuleCreateParams, options?: Core.RequestOptions): Core.APIPromise<AccessRuleCreateResponse>;
    /**
     * Fetches IP Access rules of an account or zone. These rules apply to all the
     * zones in the account or zone. You can filter the results using several optional
     * parameters.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const accessRuleListResponse of client.firewall.accessRules.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params?: AccessRuleListParams, options?: Core.RequestOptions): Core.PagePromise<AccessRuleListResponsesV4PagePaginationArray, AccessRuleListResponse>;
    list(options?: Core.RequestOptions): Core.PagePromise<AccessRuleListResponsesV4PagePaginationArray, AccessRuleListResponse>;
    /**
     * Deletes an existing IP Access rule defined.
     *
     * Note: This operation will affect all zones in the account or zone.
     *
     * @example
     * ```ts
     * const accessRule = await client.firewall.accessRules.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    delete(ruleId: string, params?: AccessRuleDeleteParams, options?: Core.RequestOptions): Core.APIPromise<AccessRuleDeleteResponse | null>;
    delete(ruleId: string, options?: Core.RequestOptions): Core.APIPromise<AccessRuleDeleteResponse | null>;
    /**
     * Updates an IP Access rule defined.
     *
     * Note: This operation will affect all zones in the account or zone.
     *
     * @example
     * ```ts
     * const response = await client.firewall.accessRules.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     configuration: {},
     *     mode: 'challenge',
     *     account_id: 'account_id',
     *   },
     * );
     * ```
     */
    edit(ruleId: string, params: AccessRuleEditParams, options?: Core.RequestOptions): Core.APIPromise<AccessRuleEditResponse>;
    /**
     * Fetches the details of an IP Access rule defined.
     *
     * @example
     * ```ts
     * const accessRule = await client.firewall.accessRules.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(ruleId: string, params?: AccessRuleGetParams, options?: Core.RequestOptions): Core.APIPromise<AccessRuleGetResponse>;
    get(ruleId: string, options?: Core.RequestOptions): Core.APIPromise<AccessRuleGetResponse>;
}
export declare class AccessRuleListResponsesV4PagePaginationArray extends V4PagePaginationArray<AccessRuleListResponse> {
}
export interface AccessRuleCIDRConfiguration {
    /**
     * The configuration target. You must set the target to `ip_range` when specifying
     * an IP address range in the rule.
     */
    target?: 'ip_range';
    /**
     * The IP address range to match. You can only use prefix lengths `/16` and `/24`
     * for IPv4 ranges, and prefix lengths `/32`, `/48`, and `/64` for IPv6 ranges.
     */
    value?: string;
}
export interface AccessRuleCIDRConfigurationParam {
    /**
     * The configuration target. You must set the target to `ip_range` when specifying
     * an IP address range in the rule.
     */
    target?: 'ip_range';
    /**
     * The IP address range to match. You can only use prefix lengths `/16` and `/24`
     * for IPv4 ranges, and prefix lengths `/32`, `/48`, and `/64` for IPv6 ranges.
     */
    value?: string;
}
export interface AccessRuleIPConfiguration {
    /**
     * The configuration target. You must set the target to `ip` when specifying an IP
     * address in the rule.
     */
    target?: 'ip';
    /**
     * The IP address to match. This address will be compared to the IP address of
     * incoming requests.
     */
    value?: string;
}
export interface AccessRuleIPConfigurationParam {
    /**
     * The configuration target. You must set the target to `ip` when specifying an IP
     * address in the rule.
     */
    target?: 'ip';
    /**
     * The IP address to match. This address will be compared to the IP address of
     * incoming requests.
     */
    value?: string;
}
export interface ASNConfiguration {
    /**
     * The configuration target. You must set the target to `asn` when specifying an
     * Autonomous System Number (ASN) in the rule.
     */
    target?: 'asn';
    /**
     * The AS number to match.
     */
    value?: string;
}
export interface ASNConfigurationParam {
    /**
     * The configuration target. You must set the target to `asn` when specifying an
     * Autonomous System Number (ASN) in the rule.
     */
    target?: 'asn';
    /**
     * The AS number to match.
     */
    value?: string;
}
export interface CountryConfiguration {
    /**
     * The configuration target. You must set the target to `country` when specifying a
     * country code in the rule.
     */
    target?: 'country';
    /**
     * The two-letter ISO-3166-1 alpha-2 code to match. For more information, refer to
     * [IP Access rules: Parameters](https://developers.cloudflare.com/waf/tools/ip-access-rules/parameters/#country).
     */
    value?: string;
}
export interface CountryConfigurationParam {
    /**
     * The configuration target. You must set the target to `country` when specifying a
     * country code in the rule.
     */
    target?: 'country';
    /**
     * The two-letter ISO-3166-1 alpha-2 code to match. For more information, refer to
     * [IP Access rules: Parameters](https://developers.cloudflare.com/waf/tools/ip-access-rules/parameters/#country).
     */
    value?: string;
}
export interface IPV6Configuration {
    /**
     * The configuration target. You must set the target to `ip6` when specifying an
     * IPv6 address in the rule.
     */
    target?: 'ip6';
    /**
     * The IPv6 address to match.
     */
    value?: string;
}
export interface IPV6ConfigurationParam {
    /**
     * The configuration target. You must set the target to `ip6` when specifying an
     * IPv6 address in the rule.
     */
    target?: 'ip6';
    /**
     * The IPv6 address to match.
     */
    value?: string;
}
export interface AccessRuleCreateResponse {
    /**
     * The unique identifier of the IP Access rule.
     */
    id: string;
    /**
     * The available actions that a rule can apply to a matched request.
     */
    allowed_modes: Array<'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge'>;
    /**
     * The rule configuration.
     */
    configuration: AccessRuleIPConfiguration | IPV6Configuration | AccessRuleCIDRConfiguration | ASNConfiguration | CountryConfiguration;
    /**
     * The action to apply to a matched request.
     */
    mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
    /**
     * The timestamp of when the rule was created.
     */
    created_on?: string;
    /**
     * The timestamp of when the rule was last modified.
     */
    modified_on?: string;
    /**
     * An informative summary of the rule, typically used as a reminder or explanation.
     */
    notes?: string;
    /**
     * All zones owned by the user will have the rule applied.
     */
    scope?: AccessRuleCreateResponse.Scope;
}
export declare namespace AccessRuleCreateResponse {
    /**
     * All zones owned by the user will have the rule applied.
     */
    interface Scope {
        /**
         * Defines an identifier.
         */
        id?: string;
        /**
         * The contact email address of the user.
         */
        email?: string;
        /**
         * Defines the scope of the rule.
         */
        type?: 'user' | 'organization';
    }
}
export interface AccessRuleListResponse {
    /**
     * The unique identifier of the IP Access rule.
     */
    id: string;
    /**
     * The available actions that a rule can apply to a matched request.
     */
    allowed_modes: Array<'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge'>;
    /**
     * The rule configuration.
     */
    configuration: AccessRuleIPConfiguration | IPV6Configuration | AccessRuleCIDRConfiguration | ASNConfiguration | CountryConfiguration;
    /**
     * The action to apply to a matched request.
     */
    mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
    /**
     * The timestamp of when the rule was created.
     */
    created_on?: string;
    /**
     * The timestamp of when the rule was last modified.
     */
    modified_on?: string;
    /**
     * An informative summary of the rule, typically used as a reminder or explanation.
     */
    notes?: string;
    /**
     * All zones owned by the user will have the rule applied.
     */
    scope?: AccessRuleListResponse.Scope;
}
export declare namespace AccessRuleListResponse {
    /**
     * All zones owned by the user will have the rule applied.
     */
    interface Scope {
        /**
         * Defines an identifier.
         */
        id?: string;
        /**
         * The contact email address of the user.
         */
        email?: string;
        /**
         * Defines the scope of the rule.
         */
        type?: 'user' | 'organization';
    }
}
export interface AccessRuleDeleteResponse {
    /**
     * Defines an identifier.
     */
    id: string;
}
export interface AccessRuleEditResponse {
    /**
     * The unique identifier of the IP Access rule.
     */
    id: string;
    /**
     * The available actions that a rule can apply to a matched request.
     */
    allowed_modes: Array<'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge'>;
    /**
     * The rule configuration.
     */
    configuration: AccessRuleIPConfiguration | IPV6Configuration | AccessRuleCIDRConfiguration | ASNConfiguration | CountryConfiguration;
    /**
     * The action to apply to a matched request.
     */
    mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
    /**
     * The timestamp of when the rule was created.
     */
    created_on?: string;
    /**
     * The timestamp of when the rule was last modified.
     */
    modified_on?: string;
    /**
     * An informative summary of the rule, typically used as a reminder or explanation.
     */
    notes?: string;
    /**
     * All zones owned by the user will have the rule applied.
     */
    scope?: AccessRuleEditResponse.Scope;
}
export declare namespace AccessRuleEditResponse {
    /**
     * All zones owned by the user will have the rule applied.
     */
    interface Scope {
        /**
         * Defines an identifier.
         */
        id?: string;
        /**
         * The contact email address of the user.
         */
        email?: string;
        /**
         * Defines the scope of the rule.
         */
        type?: 'user' | 'organization';
    }
}
export interface AccessRuleGetResponse {
    /**
     * The unique identifier of the IP Access rule.
     */
    id: string;
    /**
     * The available actions that a rule can apply to a matched request.
     */
    allowed_modes: Array<'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge'>;
    /**
     * The rule configuration.
     */
    configuration: AccessRuleIPConfiguration | IPV6Configuration | AccessRuleCIDRConfiguration | ASNConfiguration | CountryConfiguration;
    /**
     * The action to apply to a matched request.
     */
    mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
    /**
     * The timestamp of when the rule was created.
     */
    created_on?: string;
    /**
     * The timestamp of when the rule was last modified.
     */
    modified_on?: string;
    /**
     * An informative summary of the rule, typically used as a reminder or explanation.
     */
    notes?: string;
    /**
     * All zones owned by the user will have the rule applied.
     */
    scope?: AccessRuleGetResponse.Scope;
}
export declare namespace AccessRuleGetResponse {
    /**
     * All zones owned by the user will have the rule applied.
     */
    interface Scope {
        /**
         * Defines an identifier.
         */
        id?: string;
        /**
         * The contact email address of the user.
         */
        email?: string;
        /**
         * Defines the scope of the rule.
         */
        type?: 'user' | 'organization';
    }
}
export interface AccessRuleCreateParams {
    /**
     * Body param: The rule configuration.
     */
    configuration: AccessRuleIPConfigurationParam | IPV6ConfigurationParam | AccessRuleCIDRConfigurationParam | ASNConfigurationParam | CountryConfigurationParam;
    /**
     * Body param: The action to apply to a matched request.
     */
    mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
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
    /**
     * Body param: An informative summary of the rule, typically used as a reminder or
     * explanation.
     */
    notes?: string;
}
export interface AccessRuleListParams extends V4PagePaginationArrayParams {
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
    /**
     * Query param:
     */
    configuration?: AccessRuleListParams.Configuration;
    /**
     * Query param: Defines the direction used to sort returned rules.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Defines the search requirements. When set to `all`, all the search
     * requirements must match. When set to `any`, only one of the search requirements
     * has to match.
     */
    match?: 'any' | 'all';
    /**
     * Query param: The action to apply to a matched request.
     */
    mode?: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
    /**
     * Query param: Defines the string to search for in the notes of existing IP Access
     * rules. Notes: For example, the string 'attack' would match IP Access rules with
     * notes 'Attack 26/02' and 'Attack 27/02'. The search is case insensitive.
     */
    notes?: string;
    /**
     * Query param: Defines the field used to sort returned rules.
     */
    order?: 'configuration.target' | 'configuration.value' | 'mode';
}
export declare namespace AccessRuleListParams {
    interface Configuration {
        /**
         * Defines the target to search in existing rules.
         */
        target?: 'ip' | 'ip_range' | 'asn' | 'country';
        /**
         * Defines the target value to search for in existing rules: an IP address, an IP
         * address range, or a country code, depending on the provided
         * `configuration.target`. Notes: You can search for a single IPv4 address, an IP
         * address range with a subnet of '/16' or '/24', or a two-letter ISO-3166-1
         * alpha-2 country code.
         */
        value?: string;
    }
}
export interface AccessRuleDeleteParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface AccessRuleEditParams {
    /**
     * Body param: The rule configuration.
     */
    configuration: AccessRuleIPConfigurationParam | IPV6ConfigurationParam | AccessRuleCIDRConfigurationParam | ASNConfigurationParam | CountryConfigurationParam;
    /**
     * Body param: The action to apply to a matched request.
     */
    mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
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
    /**
     * Body param: An informative summary of the rule, typically used as a reminder or
     * explanation.
     */
    notes?: string;
}
export interface AccessRuleGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace AccessRules {
    export { type AccessRuleCIDRConfiguration as AccessRuleCIDRConfiguration, type AccessRuleIPConfiguration as AccessRuleIPConfiguration, type ASNConfiguration as ASNConfiguration, type CountryConfiguration as CountryConfiguration, type IPV6Configuration as IPV6Configuration, type AccessRuleCreateResponse as AccessRuleCreateResponse, type AccessRuleListResponse as AccessRuleListResponse, type AccessRuleDeleteResponse as AccessRuleDeleteResponse, type AccessRuleEditResponse as AccessRuleEditResponse, type AccessRuleGetResponse as AccessRuleGetResponse, AccessRuleListResponsesV4PagePaginationArray as AccessRuleListResponsesV4PagePaginationArray, type AccessRuleCreateParams as AccessRuleCreateParams, type AccessRuleListParams as AccessRuleListParams, type AccessRuleDeleteParams as AccessRuleDeleteParams, type AccessRuleEditParams as AccessRuleEditParams, type AccessRuleGetParams as AccessRuleGetParams, };
}
//# sourceMappingURL=access-rules.d.ts.map