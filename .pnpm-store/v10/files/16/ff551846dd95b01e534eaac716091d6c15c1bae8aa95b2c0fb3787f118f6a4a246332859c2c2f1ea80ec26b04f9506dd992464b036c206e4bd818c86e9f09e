import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Rules extends APIResource {
    /**
     * Creates a new rule in a Web Analytics ruleset.
     *
     * @example
     * ```ts
     * const rumRule = await client.rum.rules.create(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(rulesetId: string, params: RuleCreateParams, options?: Core.RequestOptions): Core.APIPromise<RUMRule>;
    /**
     * Updates a rule in a Web Analytics ruleset.
     *
     * @example
     * ```ts
     * const rumRule = await client.rum.rules.update(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(rulesetId: string, ruleId: string, params: RuleUpdateParams, options?: Core.RequestOptions): Core.APIPromise<RUMRule>;
    /**
     * Lists all the rules in a Web Analytics ruleset.
     *
     * @example
     * ```ts
     * const rules = await client.rum.rules.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    list(rulesetId: string, params: RuleListParams, options?: Core.RequestOptions): Core.APIPromise<RuleListResponse>;
    /**
     * Deletes an existing rule from a Web Analytics ruleset.
     *
     * @example
     * ```ts
     * const rule = await client.rum.rules.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(rulesetId: string, ruleId: string, params: RuleDeleteParams, options?: Core.RequestOptions): Core.APIPromise<RuleDeleteResponse>;
    /**
     * Modifies one or more rules in a Web Analytics ruleset with a single request.
     *
     * @example
     * ```ts
     * const response = await client.rum.rules.bulkCreate(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    bulkCreate(rulesetId: string, params: RuleBulkCreateParams, options?: Core.RequestOptions): Core.APIPromise<RuleBulkCreateResponse>;
}
export interface RUMRule {
    /**
     * The Web Analytics rule identifier.
     */
    id?: string;
    created?: string;
    /**
     * The hostname the rule will be applied to.
     */
    host?: string;
    /**
     * Whether the rule includes or excludes traffic from being measured.
     */
    inclusive?: boolean;
    /**
     * Whether the rule is paused or not.
     */
    is_paused?: boolean;
    /**
     * The paths the rule will be applied to.
     */
    paths?: Array<string>;
    priority?: number;
}
export interface RuleListResponse {
    /**
     * A list of rules.
     */
    rules?: Array<RUMRule>;
    ruleset?: RuleListResponse.Ruleset;
}
export declare namespace RuleListResponse {
    interface Ruleset {
        /**
         * The Web Analytics ruleset identifier.
         */
        id?: string;
        /**
         * Whether the ruleset is enabled.
         */
        enabled?: boolean;
        zone_name?: string;
        /**
         * The zone identifier.
         */
        zone_tag?: string;
    }
}
export interface RuleDeleteResponse {
    /**
     * The Web Analytics rule identifier.
     */
    id?: string;
}
export interface RuleBulkCreateResponse {
    /**
     * A list of rules.
     */
    rules?: Array<RUMRule>;
    ruleset?: RuleBulkCreateResponse.Ruleset;
}
export declare namespace RuleBulkCreateResponse {
    interface Ruleset {
        /**
         * The Web Analytics ruleset identifier.
         */
        id?: string;
        /**
         * Whether the ruleset is enabled.
         */
        enabled?: boolean;
        zone_name?: string;
        /**
         * The zone identifier.
         */
        zone_tag?: string;
    }
}
export interface RuleCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    host?: string;
    /**
     * Body param: Whether the rule includes or excludes traffic from being measured.
     */
    inclusive?: boolean;
    /**
     * Body param: Whether the rule is paused or not.
     */
    is_paused?: boolean;
    /**
     * Body param:
     */
    paths?: Array<string>;
}
export interface RuleUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    host?: string;
    /**
     * Body param: Whether the rule includes or excludes traffic from being measured.
     */
    inclusive?: boolean;
    /**
     * Body param: Whether the rule is paused or not.
     */
    is_paused?: boolean;
    /**
     * Body param:
     */
    paths?: Array<string>;
}
export interface RuleListParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface RuleDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface RuleBulkCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: A list of rule identifiers to delete.
     */
    delete_rules?: Array<string>;
    /**
     * Body param: A list of rules to create or update.
     */
    rules?: Array<RuleBulkCreateParams.Rule>;
}
export declare namespace RuleBulkCreateParams {
    interface Rule {
        /**
         * The Web Analytics rule identifier.
         */
        id?: string;
        host?: string;
        inclusive?: boolean;
        is_paused?: boolean;
        paths?: Array<string>;
    }
}
export declare namespace Rules {
    export { type RUMRule as RUMRule, type RuleListResponse as RuleListResponse, type RuleDeleteResponse as RuleDeleteResponse, type RuleBulkCreateResponse as RuleBulkCreateResponse, type RuleCreateParams as RuleCreateParams, type RuleUpdateParams as RuleUpdateParams, type RuleListParams as RuleListParams, type RuleDeleteParams as RuleDeleteParams, type RuleBulkCreateParams as RuleBulkCreateParams, };
}
//# sourceMappingURL=rules.d.ts.map