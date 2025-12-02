import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as AccessRulesAPI from "./access-rules.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class UARules extends APIResource {
    /**
     * Creates a new User Agent Blocking rule in a zone.
     *
     * @example
     * ```ts
     * const uaRule = await client.firewall.uaRules.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   configuration: {},
     *   mode: 'challenge',
     * });
     * ```
     */
    create(params: UARuleCreateParams, options?: Core.RequestOptions): Core.APIPromise<UARuleCreateResponse>;
    /**
     * Updates an existing User Agent Blocking rule.
     *
     * @example
     * ```ts
     * const uaRule = await client.firewall.uaRules.update(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     configuration: {},
     *     mode: 'challenge',
     *   },
     * );
     * ```
     */
    update(uaRuleId: string, params: UARuleUpdateParams, options?: Core.RequestOptions): Core.APIPromise<UARuleUpdateResponse>;
    /**
     * Fetches User Agent Blocking rules in a zone. You can filter the results using
     * several optional parameters.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const uaRuleListResponse of client.firewall.uaRules.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: UARuleListParams, options?: Core.RequestOptions): Core.PagePromise<UARuleListResponsesV4PagePaginationArray, UARuleListResponse>;
    /**
     * Deletes an existing User Agent Blocking rule.
     *
     * @example
     * ```ts
     * const uaRule = await client.firewall.uaRules.delete(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(uaRuleId: string, params: UARuleDeleteParams, options?: Core.RequestOptions): Core.APIPromise<UARuleDeleteResponse>;
    /**
     * Fetches the details of a User Agent Blocking rule.
     *
     * @example
     * ```ts
     * const uaRule = await client.firewall.uaRules.get(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(uaRuleId: string, params: UARuleGetParams, options?: Core.RequestOptions): Core.APIPromise<UARuleGetResponse>;
}
export declare class UARuleListResponsesV4PagePaginationArray extends V4PagePaginationArray<UARuleListResponse> {
}
export interface UARuleCreateResponse {
    /**
     * The unique identifier of the User Agent Blocking rule.
     */
    id?: string;
    /**
     * The configuration object for the current rule.
     */
    configuration?: UARuleCreateResponse.Configuration;
    /**
     * An informative summary of the rule.
     */
    description?: string;
    /**
     * The action to apply to a matched request.
     */
    mode?: 'block' | 'challenge' | 'js_challenge' | 'managed_challenge';
    /**
     * When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
}
export declare namespace UARuleCreateResponse {
    /**
     * The configuration object for the current rule.
     */
    interface Configuration {
        /**
         * The configuration target for this rule. You must set the target to `ua` for User
         * Agent Blocking rules.
         */
        target?: string;
        /**
         * The exact user agent string to match. This value will be compared to the
         * received `User-Agent` HTTP header value.
         */
        value?: string;
    }
}
export interface UARuleUpdateResponse {
    /**
     * The unique identifier of the User Agent Blocking rule.
     */
    id?: string;
    /**
     * The configuration object for the current rule.
     */
    configuration?: UARuleUpdateResponse.Configuration;
    /**
     * An informative summary of the rule.
     */
    description?: string;
    /**
     * The action to apply to a matched request.
     */
    mode?: 'block' | 'challenge' | 'js_challenge' | 'managed_challenge';
    /**
     * When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
}
export declare namespace UARuleUpdateResponse {
    /**
     * The configuration object for the current rule.
     */
    interface Configuration {
        /**
         * The configuration target for this rule. You must set the target to `ua` for User
         * Agent Blocking rules.
         */
        target?: string;
        /**
         * The exact user agent string to match. This value will be compared to the
         * received `User-Agent` HTTP header value.
         */
        value?: string;
    }
}
export interface UARuleListResponse {
    /**
     * The unique identifier of the User Agent Blocking rule.
     */
    id?: string;
    /**
     * The configuration object for the current rule.
     */
    configuration?: UARuleListResponse.Configuration;
    /**
     * An informative summary of the rule.
     */
    description?: string;
    /**
     * The action to apply to a matched request.
     */
    mode?: 'block' | 'challenge' | 'js_challenge' | 'managed_challenge';
    /**
     * When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
}
export declare namespace UARuleListResponse {
    /**
     * The configuration object for the current rule.
     */
    interface Configuration {
        /**
         * The configuration target for this rule. You must set the target to `ua` for User
         * Agent Blocking rules.
         */
        target?: string;
        /**
         * The exact user agent string to match. This value will be compared to the
         * received `User-Agent` HTTP header value.
         */
        value?: string;
    }
}
export interface UARuleDeleteResponse {
    /**
     * The unique identifier of the User Agent Blocking rule.
     */
    id?: string;
    /**
     * The configuration object for the current rule.
     */
    configuration?: UARuleDeleteResponse.Configuration;
    /**
     * An informative summary of the rule.
     */
    description?: string;
    /**
     * The action to apply to a matched request.
     */
    mode?: 'block' | 'challenge' | 'js_challenge' | 'managed_challenge';
    /**
     * When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
}
export declare namespace UARuleDeleteResponse {
    /**
     * The configuration object for the current rule.
     */
    interface Configuration {
        /**
         * The configuration target for this rule. You must set the target to `ua` for User
         * Agent Blocking rules.
         */
        target?: string;
        /**
         * The exact user agent string to match. This value will be compared to the
         * received `User-Agent` HTTP header value.
         */
        value?: string;
    }
}
export interface UARuleGetResponse {
    /**
     * The unique identifier of the User Agent Blocking rule.
     */
    id?: string;
    /**
     * The configuration object for the current rule.
     */
    configuration?: UARuleGetResponse.Configuration;
    /**
     * An informative summary of the rule.
     */
    description?: string;
    /**
     * The action to apply to a matched request.
     */
    mode?: 'block' | 'challenge' | 'js_challenge' | 'managed_challenge';
    /**
     * When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
}
export declare namespace UARuleGetResponse {
    /**
     * The configuration object for the current rule.
     */
    interface Configuration {
        /**
         * The configuration target for this rule. You must set the target to `ua` for User
         * Agent Blocking rules.
         */
        target?: string;
        /**
         * The exact user agent string to match. This value will be compared to the
         * received `User-Agent` HTTP header value.
         */
        value?: string;
    }
}
export interface UARuleCreateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    configuration: UARuleCreateParams.Configuration;
    /**
     * Body param: The action to apply to a matched request.
     */
    mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
    /**
     * Body param: An informative summary of the rule. This value is sanitized and any
     * tags will be removed.
     */
    description?: string;
    /**
     * Body param: When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
}
export declare namespace UARuleCreateParams {
    interface Configuration {
        /**
         * The configuration target. You must set the target to `ua` when specifying a user
         * agent in the rule.
         */
        target?: 'ua';
        /**
         * the user agent to exactly match
         */
        value?: string;
    }
}
export interface UARuleUpdateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: The rule configuration.
     */
    configuration: AccessRulesAPI.AccessRuleIPConfigurationParam | AccessRulesAPI.IPV6ConfigurationParam | AccessRulesAPI.AccessRuleCIDRConfigurationParam | AccessRulesAPI.ASNConfigurationParam | AccessRulesAPI.CountryConfigurationParam;
    /**
     * Body param: The action to apply to a matched request.
     */
    mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge' | 'managed_challenge';
    /**
     * Body param: An informative summary of the rule. This value is sanitized and any
     * tags will be removed.
     */
    description?: string;
    /**
     * Body param: When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
}
export interface UARuleListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Query param: A string to search for in the description of existing rules.
     */
    description?: string;
    /**
     * Query param: When true, indicates that the rule is currently paused.
     */
    paused?: boolean;
    /**
     * Query param: A string to search for in the user agent values of existing rules.
     */
    user_agent?: string;
}
export interface UARuleDeleteParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface UARuleGetParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace UARules {
    export { type UARuleCreateResponse as UARuleCreateResponse, type UARuleUpdateResponse as UARuleUpdateResponse, type UARuleListResponse as UARuleListResponse, type UARuleDeleteResponse as UARuleDeleteResponse, type UARuleGetResponse as UARuleGetResponse, UARuleListResponsesV4PagePaginationArray as UARuleListResponsesV4PagePaginationArray, type UARuleCreateParams as UARuleCreateParams, type UARuleUpdateParams as UARuleUpdateParams, type UARuleListParams as UARuleListParams, type UARuleDeleteParams as UARuleDeleteParams, type UARuleGetParams as UARuleGetParams, };
}
//# sourceMappingURL=ua-rules.d.ts.map