import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as RulesAPI from "./rules.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../../pagination.js";
export declare class Rules extends APIResource {
    /**
     * Fetches WAF rules in a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    list(packageId: string, params: RuleListParams, options?: Core.RequestOptions): Core.PagePromise<RuleListResponsesV4PagePaginationArray, RuleListResponse>;
    /**
     * Updates a WAF rule. You can only update the mode/action of the rule.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    edit(packageId: string, ruleId: string, params: RuleEditParams, options?: Core.RequestOptions): Core.APIPromise<RuleEditResponse>;
    /**
     * Fetches the details of a WAF rule in a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    get(packageId: string, ruleId: string, params: RuleGetParams, options?: Core.RequestOptions): Core.APIPromise<RuleGetResponse>;
}
export declare class RuleListResponsesV4PagePaginationArray extends V4PagePaginationArray<RuleListResponse> {
}
/**
 * Defines the mode anomaly. When set to `on`, the current WAF rule will be used
 * when evaluating the request. Applies to anomaly detection WAF rules.
 */
export type AllowedModesAnomaly = 'on' | 'off';
/**
 * Defines the rule group to which the current WAF rule belongs.
 */
export interface WAFRuleGroup {
    /**
     * Defines the unique identifier of the rule group.
     */
    id?: string;
    /**
     * Defines the name of the rule group.
     */
    name?: string;
}
/**
 * When triggered, anomaly detection WAF rules contribute to an overall threat
 * score that will determine if a request is considered malicious. You can
 * configure the total scoring threshold through the 'sensitivity' property of the
 * WAF package.
 */
export type RuleListResponse = RuleListResponse.WAFManagedRulesAnomalyRule | RuleListResponse.WAFManagedRulesTraditionalDenyRule | RuleListResponse.WAFManagedRulesTraditionalAllowRule;
export declare namespace RuleListResponse {
    /**
     * When triggered, anomaly detection WAF rules contribute to an overall threat
     * score that will determine if a request is considered malicious. You can
     * configure the total scoring threshold through the 'sensitivity' property of the
     * WAF package.
     */
    interface WAFManagedRulesAnomalyRule {
        /**
         * Defines the unique identifier of the WAF rule.
         */
        id: string;
        /**
         * Defines the available modes for the current WAF rule. Applies to anomaly
         * detection WAF rules.
         */
        allowed_modes: Array<RulesAPI.AllowedModesAnomaly>;
        /**
         * Defines the public description of the WAF rule.
         */
        description: string;
        /**
         * Defines the rule group to which the current WAF rule belongs.
         */
        group: RulesAPI.WAFRuleGroup;
        /**
         * Defines the mode anomaly. When set to `on`, the current WAF rule will be used
         * when evaluating the request. Applies to anomaly detection WAF rules.
         */
        mode: RulesAPI.AllowedModesAnomaly;
        /**
         * Defines the unique identifier of a WAF package.
         */
        package_id: string;
        /**
         * Defines the order in which the individual WAF rule is executed within its rule
         * group.
         */
        priority: string;
    }
    /**
     * When triggered, traditional WAF rules cause the firewall to immediately act upon
     * the request based on the configuration of the rule. A 'deny' rule will
     * immediately respond to the request based on the configured rule action/mode (for
     * example, 'block') and no other rules will be processed.
     */
    interface WAFManagedRulesTraditionalDenyRule {
        /**
         * Defines the unique identifier of the WAF rule.
         */
        id: string;
        /**
         * Defines the list of possible actions of the WAF rule when it is triggered.
         */
        allowed_modes: Array<'default' | 'disable' | 'simulate' | 'block' | 'challenge'>;
        /**
         * Defines the default action/mode of a rule.
         */
        default_mode: 'disable' | 'simulate' | 'block' | 'challenge';
        /**
         * Defines the public description of the WAF rule.
         */
        description: string;
        /**
         * Defines the rule group to which the current WAF rule belongs.
         */
        group: RulesAPI.WAFRuleGroup;
        /**
         * Defines the action that the current WAF rule will perform when triggered.
         * Applies to traditional (deny) WAF rules.
         */
        mode: 'default' | 'disable' | 'simulate' | 'block' | 'challenge';
        /**
         * Defines the unique identifier of a WAF package.
         */
        package_id: string;
        /**
         * Defines the order in which the individual WAF rule is executed within its rule
         * group.
         */
        priority: string;
    }
    /**
     * When triggered, traditional WAF rules cause the firewall to immediately act on
     * the request based on the rule configuration. An 'allow' rule will immediately
     * allow the request and no other rules will be processed.
     */
    interface WAFManagedRulesTraditionalAllowRule {
        /**
         * Defines the unique identifier of the WAF rule.
         */
        id: string;
        /**
         * Defines the available modes for the current WAF rule.
         */
        allowed_modes: Array<'on' | 'off'>;
        /**
         * Defines the public description of the WAF rule.
         */
        description: string;
        /**
         * Defines the rule group to which the current WAF rule belongs.
         */
        group: RulesAPI.WAFRuleGroup;
        /**
         * When set to `on`, the current rule will be used when evaluating the request.
         * Applies to traditional (allow) WAF rules.
         */
        mode: 'on' | 'off';
        /**
         * Defines the unique identifier of a WAF package.
         */
        package_id: string;
        /**
         * Defines the order in which the individual WAF rule is executed within its rule
         * group.
         */
        priority: string;
    }
}
/**
 * When triggered, anomaly detection WAF rules contribute to an overall threat
 * score that will determine if a request is considered malicious. You can
 * configure the total scoring threshold through the 'sensitivity' property of the
 * WAF package.
 */
export type RuleEditResponse = RuleEditResponse.WAFManagedRulesAnomalyRule | RuleEditResponse.WAFManagedRulesTraditionalDenyRule | RuleEditResponse.WAFManagedRulesTraditionalAllowRule;
export declare namespace RuleEditResponse {
    /**
     * When triggered, anomaly detection WAF rules contribute to an overall threat
     * score that will determine if a request is considered malicious. You can
     * configure the total scoring threshold through the 'sensitivity' property of the
     * WAF package.
     */
    interface WAFManagedRulesAnomalyRule {
        /**
         * Defines the unique identifier of the WAF rule.
         */
        id: string;
        /**
         * Defines the available modes for the current WAF rule. Applies to anomaly
         * detection WAF rules.
         */
        allowed_modes: Array<RulesAPI.AllowedModesAnomaly>;
        /**
         * Defines the public description of the WAF rule.
         */
        description: string;
        /**
         * Defines the rule group to which the current WAF rule belongs.
         */
        group: RulesAPI.WAFRuleGroup;
        /**
         * Defines the mode anomaly. When set to `on`, the current WAF rule will be used
         * when evaluating the request. Applies to anomaly detection WAF rules.
         */
        mode: RulesAPI.AllowedModesAnomaly;
        /**
         * Defines the unique identifier of a WAF package.
         */
        package_id: string;
        /**
         * Defines the order in which the individual WAF rule is executed within its rule
         * group.
         */
        priority: string;
    }
    /**
     * When triggered, traditional WAF rules cause the firewall to immediately act upon
     * the request based on the configuration of the rule. A 'deny' rule will
     * immediately respond to the request based on the configured rule action/mode (for
     * example, 'block') and no other rules will be processed.
     */
    interface WAFManagedRulesTraditionalDenyRule {
        /**
         * Defines the unique identifier of the WAF rule.
         */
        id: string;
        /**
         * Defines the list of possible actions of the WAF rule when it is triggered.
         */
        allowed_modes: Array<'default' | 'disable' | 'simulate' | 'block' | 'challenge'>;
        /**
         * Defines the default action/mode of a rule.
         */
        default_mode: 'disable' | 'simulate' | 'block' | 'challenge';
        /**
         * Defines the public description of the WAF rule.
         */
        description: string;
        /**
         * Defines the rule group to which the current WAF rule belongs.
         */
        group: RulesAPI.WAFRuleGroup;
        /**
         * Defines the action that the current WAF rule will perform when triggered.
         * Applies to traditional (deny) WAF rules.
         */
        mode: 'default' | 'disable' | 'simulate' | 'block' | 'challenge';
        /**
         * Defines the unique identifier of a WAF package.
         */
        package_id: string;
        /**
         * Defines the order in which the individual WAF rule is executed within its rule
         * group.
         */
        priority: string;
    }
    /**
     * When triggered, traditional WAF rules cause the firewall to immediately act on
     * the request based on the rule configuration. An 'allow' rule will immediately
     * allow the request and no other rules will be processed.
     */
    interface WAFManagedRulesTraditionalAllowRule {
        /**
         * Defines the unique identifier of the WAF rule.
         */
        id: string;
        /**
         * Defines the available modes for the current WAF rule.
         */
        allowed_modes: Array<'on' | 'off'>;
        /**
         * Defines the public description of the WAF rule.
         */
        description: string;
        /**
         * Defines the rule group to which the current WAF rule belongs.
         */
        group: RulesAPI.WAFRuleGroup;
        /**
         * When set to `on`, the current rule will be used when evaluating the request.
         * Applies to traditional (allow) WAF rules.
         */
        mode: 'on' | 'off';
        /**
         * Defines the unique identifier of a WAF package.
         */
        package_id: string;
        /**
         * Defines the order in which the individual WAF rule is executed within its rule
         * group.
         */
        priority: string;
    }
}
export type RuleGetResponse = unknown | string | null;
export interface RuleListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Defines an identifier of a schema.
     */
    zone_id: string;
    /**
     * Query param: Defines the public description of the WAF rule.
     */
    description?: string;
    /**
     * Query param: Defines the direction used to sort returned rules.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Defines the unique identifier of the rule group.
     */
    group_id?: string;
    /**
     * Query param: Defines the search requirements. When set to `all`, all the search
     * requirements must match. When set to `any`, only one of the search requirements
     * has to match.
     */
    match?: 'any' | 'all';
    /**
     * Query param: Defines the action/mode a rule has been overridden to perform.
     */
    mode?: 'DIS' | 'CHL' | 'BLK' | 'SIM';
    /**
     * Query param: Defines the field used to sort returned rules.
     */
    order?: 'priority' | 'group_id' | 'description';
    /**
     * Query param: Defines the order in which the individual WAF rule is executed
     * within its rule group.
     */
    priority?: string;
}
export interface RuleEditParams {
    /**
     * Path param: Defines an identifier of a schema.
     */
    zone_id: string;
    /**
     * Body param: Defines the mode/action of the rule when triggered. You must use a
     * value from the `allowed_modes` array of the current rule.
     */
    mode?: 'default' | 'disable' | 'simulate' | 'block' | 'challenge' | 'on' | 'off';
}
export interface RuleGetParams {
    /**
     * Defines an identifier of a schema.
     */
    zone_id: string;
}
export declare namespace Rules {
    export { type AllowedModesAnomaly as AllowedModesAnomaly, type WAFRuleGroup as WAFRuleGroup, type RuleListResponse as RuleListResponse, type RuleEditResponse as RuleEditResponse, type RuleGetResponse as RuleGetResponse, RuleListResponsesV4PagePaginationArray as RuleListResponsesV4PagePaginationArray, type RuleListParams as RuleListParams, type RuleEditParams as RuleEditParams, type RuleGetParams as RuleGetParams, };
}
//# sourceMappingURL=rules.d.ts.map