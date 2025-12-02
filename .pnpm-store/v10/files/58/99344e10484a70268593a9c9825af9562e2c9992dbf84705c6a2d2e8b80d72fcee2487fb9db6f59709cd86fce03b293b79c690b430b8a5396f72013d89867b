import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as FiltersAPI from "../filters.js";
import * as RateLimitsAPI from "../rate-limits.js";
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
/**
 * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
 */
export declare class Rules extends APIResource {
    /**
     * Create one or more firewall rules.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    create(params: RuleCreateParams, options?: Core.RequestOptions): Core.PagePromise<FirewallRulesSinglePage, FirewallRule>;
    /**
     * Updates an existing firewall rule.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    update(ruleId: string, params: RuleUpdateParams, options?: Core.RequestOptions): Core.APIPromise<FirewallRule>;
    /**
     * Fetches firewall rules in a zone. You can filter the results using several
     * optional parameters.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    list(params: RuleListParams, options?: Core.RequestOptions): Core.PagePromise<FirewallRulesV4PagePaginationArray, FirewallRule>;
    /**
     * Deletes an existing firewall rule.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    delete(ruleId: string, params: RuleDeleteParams, options?: Core.RequestOptions): Core.APIPromise<FirewallRule>;
    /**
     * Deletes existing firewall rules.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    bulkDelete(params: RuleBulkDeleteParams, options?: Core.RequestOptions): Core.PagePromise<FirewallRulesSinglePage, FirewallRule>;
    /**
     * Updates the priority of existing firewall rules.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    bulkEdit(params: RuleBulkEditParams, options?: Core.RequestOptions): Core.PagePromise<FirewallRulesSinglePage, FirewallRule>;
    /**
     * Updates one or more existing firewall rules.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    bulkUpdate(params: RuleBulkUpdateParams, options?: Core.RequestOptions): Core.PagePromise<FirewallRulesSinglePage, FirewallRule>;
    /**
     * Updates the priority of an existing firewall rule.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    edit(ruleId: string, params: RuleEditParams, options?: Core.RequestOptions): Core.PagePromise<FirewallRulesSinglePage, FirewallRule>;
    /**
     * Fetches the details of a firewall rule.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    get(ruleId: string, params: RuleGetParams, options?: Core.RequestOptions): Core.APIPromise<FirewallRule>;
}
export declare class FirewallRulesSinglePage extends SinglePage<FirewallRule> {
}
export declare class FirewallRulesV4PagePaginationArray extends V4PagePaginationArray<FirewallRule> {
}
export interface DeletedFilter {
    /**
     * The unique identifier of the filter.
     */
    id: string;
    /**
     * When true, indicates that the firewall rule was deleted.
     */
    deleted: boolean;
}
export interface FirewallRule {
    /**
     * The unique identifier of the firewall rule.
     */
    id?: string;
    /**
     * The action to apply to a matched request. The `log` action is only available on
     * an Enterprise plan.
     */
    action?: RateLimitsAPI.Action;
    /**
     * An informative summary of the firewall rule.
     */
    description?: string;
    filter?: FiltersAPI.FirewallFilter | DeletedFilter;
    /**
     * When true, indicates that the firewall rule is currently paused.
     */
    paused?: boolean;
    /**
     * The priority of the rule. Optional value used to define the processing order. A
     * lower number indicates a higher priority. If not provided, rules with a defined
     * priority will be processed before rules without a priority.
     */
    priority?: number;
    products?: Array<Product>;
    /**
     * A short reference tag. Allows you to select related firewall rules.
     */
    ref?: string;
}
/**
 * A list of products to bypass for a request when using the `bypass` action.
 */
export type Product = 'zoneLockdown' | 'uaBlock' | 'bic' | 'hot' | 'securityLevel' | 'rateLimit' | 'waf';
export interface RuleCreateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: The action to perform when the threshold of matched traffic within
     * the configured period is exceeded.
     */
    action: RuleCreateParams.Action;
    /**
     * Body param:
     */
    filter: FiltersAPI.FirewallFilterParam;
}
export declare namespace RuleCreateParams {
    /**
     * The action to perform when the threshold of matched traffic within the
     * configured period is exceeded.
     */
    interface Action {
        /**
         * The action to perform.
         */
        mode?: 'simulate' | 'ban' | 'challenge' | 'js_challenge' | 'managed_challenge';
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        response?: Action.Response;
        /**
         * The time in seconds during which Cloudflare will perform the mitigation action.
         * Must be an integer value greater than or equal to the period. Notes: If "mode"
         * is "challenge", "managed_challenge", or "js_challenge", Cloudflare will use the
         * zone's Challenge Passage time and you should not provide this value.
         */
        timeout?: number;
    }
    namespace Action {
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        interface Response {
            /**
             * The response body to return. The value must conform to the configured content
             * type.
             */
            body?: string;
            /**
             * The content type of the body. Must be one of the following: `text/plain`,
             * `text/xml`, or `application/json`.
             */
            content_type?: string;
        }
    }
}
export interface RuleUpdateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: The action to perform when the threshold of matched traffic within
     * the configured period is exceeded.
     */
    action: RuleUpdateParams.Action;
    /**
     * Body param:
     */
    filter: FiltersAPI.FirewallFilterParam;
}
export declare namespace RuleUpdateParams {
    /**
     * The action to perform when the threshold of matched traffic within the
     * configured period is exceeded.
     */
    interface Action {
        /**
         * The action to perform.
         */
        mode?: 'simulate' | 'ban' | 'challenge' | 'js_challenge' | 'managed_challenge';
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        response?: Action.Response;
        /**
         * The time in seconds during which Cloudflare will perform the mitigation action.
         * Must be an integer value greater than or equal to the period. Notes: If "mode"
         * is "challenge", "managed_challenge", or "js_challenge", Cloudflare will use the
         * zone's Challenge Passage time and you should not provide this value.
         */
        timeout?: number;
    }
    namespace Action {
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        interface Response {
            /**
             * The response body to return. The value must conform to the configured content
             * type.
             */
            body?: string;
            /**
             * The content type of the body. Must be one of the following: `text/plain`,
             * `text/xml`, or `application/json`.
             */
            content_type?: string;
        }
    }
}
export interface RuleListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Query param: The unique identifier of the firewall rule.
     */
    id?: string;
    /**
     * Query param: The action to search for. Must be an exact match.
     */
    action?: string;
    /**
     * Query param: A case-insensitive string to find in the description.
     */
    description?: string;
    /**
     * Query param: When true, indicates that the firewall rule is currently paused.
     */
    paused?: boolean;
}
export interface RuleDeleteParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface RuleBulkDeleteParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface RuleBulkEditParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface RuleBulkUpdateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface RuleEditParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface RuleGetParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace Rules {
    export { type DeletedFilter as DeletedFilter, type FirewallRule as FirewallRule, type Product as Product, FirewallRulesSinglePage as FirewallRulesSinglePage, FirewallRulesV4PagePaginationArray as FirewallRulesV4PagePaginationArray, type RuleCreateParams as RuleCreateParams, type RuleUpdateParams as RuleUpdateParams, type RuleListParams as RuleListParams, type RuleDeleteParams as RuleDeleteParams, type RuleBulkDeleteParams as RuleBulkDeleteParams, type RuleBulkEditParams as RuleBulkEditParams, type RuleBulkUpdateParams as RuleBulkUpdateParams, type RuleEditParams as RuleEditParams, type RuleGetParams as RuleGetParams, };
}
//# sourceMappingURL=rules.d.ts.map