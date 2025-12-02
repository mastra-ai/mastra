import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as CatchAllsAPI from "./catch-alls.js";
import { CatchAllAction, CatchAllGetParams, CatchAllGetResponse, CatchAllMatcher, CatchAllUpdateParams, CatchAllUpdateResponse, CatchAlls } from "./catch-alls.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Rules extends APIResource {
    catchAlls: CatchAllsAPI.CatchAlls;
    /**
     * Rules consist of a set of criteria for matching emails (such as an email being
     * sent to a specific custom email address) plus a set of actions to take on the
     * email (like forwarding it to a specific destination address).
     *
     * @example
     * ```ts
     * const emailRoutingRule =
     *   await client.emailRouting.rules.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     actions: [{ type: 'forward' }],
     *     matchers: [{ type: 'literal' }],
     *   });
     * ```
     */
    create(params: RuleCreateParams, options?: Core.RequestOptions): Core.APIPromise<EmailRoutingRule>;
    /**
     * Update actions and matches, or enable/disable specific routing rules.
     *
     * @example
     * ```ts
     * const emailRoutingRule =
     *   await client.emailRouting.rules.update(
     *     'a7e6fb77503c41d8a7f3113c6918f10c',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       actions: [{ type: 'forward' }],
     *       matchers: [{ type: 'literal' }],
     *     },
     *   );
     * ```
     */
    update(ruleIdentifier: string, params: RuleUpdateParams, options?: Core.RequestOptions): Core.APIPromise<EmailRoutingRule>;
    /**
     * Lists existing routing rules.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const emailRoutingRule of client.emailRouting.rules.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: RuleListParams, options?: Core.RequestOptions): Core.PagePromise<EmailRoutingRulesV4PagePaginationArray, EmailRoutingRule>;
    /**
     * Delete a specific routing rule.
     *
     * @example
     * ```ts
     * const emailRoutingRule =
     *   await client.emailRouting.rules.delete(
     *     'a7e6fb77503c41d8a7f3113c6918f10c',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(ruleIdentifier: string, params: RuleDeleteParams, options?: Core.RequestOptions): Core.APIPromise<EmailRoutingRule>;
    /**
     * Get information for a specific routing rule already created.
     *
     * @example
     * ```ts
     * const emailRoutingRule =
     *   await client.emailRouting.rules.get(
     *     'a7e6fb77503c41d8a7f3113c6918f10c',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(ruleIdentifier: string, params: RuleGetParams, options?: Core.RequestOptions): Core.APIPromise<EmailRoutingRule>;
}
export declare class EmailRoutingRulesV4PagePaginationArray extends V4PagePaginationArray<EmailRoutingRule> {
}
/**
 * Actions pattern.
 */
export interface Action {
    /**
     * Type of supported action.
     */
    type: 'drop' | 'forward' | 'worker';
    value?: Array<string>;
}
/**
 * Actions pattern.
 */
export interface ActionParam {
    /**
     * Type of supported action.
     */
    type: 'drop' | 'forward' | 'worker';
    value?: Array<string>;
}
export interface EmailRoutingRule {
    /**
     * Routing rule identifier.
     */
    id?: string;
    /**
     * List actions patterns.
     */
    actions?: Array<Action>;
    /**
     * Routing rule status.
     */
    enabled?: true | false;
    /**
     * Matching patterns to forward to your actions.
     */
    matchers?: Array<Matcher>;
    /**
     * Routing rule name.
     */
    name?: string;
    /**
     * Priority of the routing rule.
     */
    priority?: number;
    /**
     * @deprecated Routing rule tag. (Deprecated, replaced by routing rule identifier)
     */
    tag?: string;
}
/**
 * Matching pattern to forward your actions.
 */
export interface Matcher {
    /**
     * Type of matcher.
     */
    type: 'all' | 'literal';
    /**
     * Field for type matcher.
     */
    field?: 'to';
    /**
     * Value for matcher.
     */
    value?: string;
}
/**
 * Matching pattern to forward your actions.
 */
export interface MatcherParam {
    /**
     * Type of matcher.
     */
    type: 'all' | 'literal';
    /**
     * Field for type matcher.
     */
    field?: 'to';
    /**
     * Value for matcher.
     */
    value?: string;
}
export interface RuleCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: List actions patterns.
     */
    actions: Array<ActionParam>;
    /**
     * Body param: Matching patterns to forward to your actions.
     */
    matchers: Array<MatcherParam>;
    /**
     * Body param: Routing rule status.
     */
    enabled?: true | false;
    /**
     * Body param: Routing rule name.
     */
    name?: string;
    /**
     * Body param: Priority of the routing rule.
     */
    priority?: number;
}
export interface RuleUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: List actions patterns.
     */
    actions: Array<ActionParam>;
    /**
     * Body param: Matching patterns to forward to your actions.
     */
    matchers: Array<MatcherParam>;
    /**
     * Body param: Routing rule status.
     */
    enabled?: true | false;
    /**
     * Body param: Routing rule name.
     */
    name?: string;
    /**
     * Body param: Priority of the routing rule.
     */
    priority?: number;
}
export interface RuleListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Filter by enabled routing rules.
     */
    enabled?: true | false;
}
export interface RuleDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface RuleGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Rules {
    export { type Action as Action, type EmailRoutingRule as EmailRoutingRule, type Matcher as Matcher, EmailRoutingRulesV4PagePaginationArray as EmailRoutingRulesV4PagePaginationArray, type RuleCreateParams as RuleCreateParams, type RuleUpdateParams as RuleUpdateParams, type RuleListParams as RuleListParams, type RuleDeleteParams as RuleDeleteParams, type RuleGetParams as RuleGetParams, };
    export { CatchAlls as CatchAlls, type CatchAllAction as CatchAllAction, type CatchAllMatcher as CatchAllMatcher, type CatchAllUpdateResponse as CatchAllUpdateResponse, type CatchAllGetResponse as CatchAllGetResponse, type CatchAllUpdateParams as CatchAllUpdateParams, type CatchAllGetParams as CatchAllGetParams, };
}
//# sourceMappingURL=rules.d.ts.map