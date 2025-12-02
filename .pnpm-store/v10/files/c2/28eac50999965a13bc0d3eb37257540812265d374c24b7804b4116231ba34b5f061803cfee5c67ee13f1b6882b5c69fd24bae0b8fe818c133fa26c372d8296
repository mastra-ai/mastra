import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as RulesAPI from "../rules.js";
import * as RulesetsAPI from "../rulesets.js";
import { SinglePage } from "../../../pagination.js";
export declare class Versions extends APIResource {
    /**
     * Fetches the versions of an account or zone entry point ruleset.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const versionListResponse of client.rulesets.phases.versions.list(
     *   'http_request_firewall_custom',
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(rulesetPhase: RulesetsAPI.PhaseParam, params?: VersionListParams, options?: Core.RequestOptions): Core.PagePromise<VersionListResponsesSinglePage, VersionListResponse>;
    list(rulesetPhase: RulesetsAPI.PhaseParam, options?: Core.RequestOptions): Core.PagePromise<VersionListResponsesSinglePage, VersionListResponse>;
    /**
     * Fetches a specific version of an account or zone entry point ruleset.
     *
     * @example
     * ```ts
     * const version = await client.rulesets.phases.versions.get(
     *   'http_request_firewall_custom',
     *   '1',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(rulesetPhase: RulesetsAPI.PhaseParam, rulesetVersion: string, params?: VersionGetParams, options?: Core.RequestOptions): Core.APIPromise<VersionGetResponse>;
    get(rulesetPhase: RulesetsAPI.PhaseParam, rulesetVersion: string, options?: Core.RequestOptions): Core.APIPromise<VersionGetResponse>;
}
export declare class VersionListResponsesSinglePage extends SinglePage<VersionListResponse> {
}
/**
 * A ruleset object.
 */
export interface VersionListResponse {
    /**
     * The unique ID of the ruleset.
     */
    id: string;
    /**
     * The kind of the ruleset.
     */
    kind: RulesetsAPI.Kind;
    /**
     * The timestamp of when the ruleset was last modified.
     */
    last_updated: string;
    /**
     * The human-readable name of the ruleset.
     */
    name: string;
    /**
     * The phase of the ruleset.
     */
    phase: RulesetsAPI.Phase;
    /**
     * The version of the ruleset.
     */
    version: string;
    /**
     * An informative description of the ruleset.
     */
    description?: string;
}
/**
 * A ruleset object.
 */
export interface VersionGetResponse {
    /**
     * The unique ID of the ruleset.
     */
    id: string;
    /**
     * The kind of the ruleset.
     */
    kind: RulesetsAPI.Kind;
    /**
     * The timestamp of when the ruleset was last modified.
     */
    last_updated: string;
    /**
     * The human-readable name of the ruleset.
     */
    name: string;
    /**
     * The phase of the ruleset.
     */
    phase: RulesetsAPI.Phase;
    /**
     * The list of rules in the ruleset.
     */
    rules: Array<RulesAPI.BlockRule | VersionGetResponse.RulesetsChallengeRule | RulesAPI.CompressResponseRule | RulesAPI.ExecuteRule | VersionGetResponse.RulesetsJSChallengeRule | RulesAPI.LogRule | RulesAPI.ManagedChallengeRule | RulesAPI.RedirectRule | RulesAPI.RewriteRule | RulesAPI.RouteRule | RulesAPI.ScoreRule | RulesAPI.ServeErrorRule | RulesAPI.SetConfigRule | RulesAPI.SkipRule | RulesAPI.SetCacheSettingsRule | RulesAPI.LogCustomFieldRule | RulesAPI.DDoSDynamicRule | RulesAPI.ForceConnectionCloseRule>;
    /**
     * The version of the ruleset.
     */
    version: string;
    /**
     * An informative description of the ruleset.
     */
    description?: string;
}
export declare namespace VersionGetResponse {
    interface RulesetsChallengeRule {
        /**
         * The timestamp of when the rule was last modified.
         */
        last_updated: string;
        /**
         * The version of the rule.
         */
        version: string;
        /**
         * The unique ID of the rule.
         */
        id?: string;
        /**
         * The action to perform when the rule matches.
         */
        action?: 'challenge';
        /**
         * The parameters configuring the rule's action.
         */
        action_parameters?: unknown;
        /**
         * The categories of the rule.
         */
        categories?: Array<string>;
        /**
         * An informative description of the rule.
         */
        description?: string;
        /**
         * Whether the rule should be executed.
         */
        enabled?: boolean;
        /**
         * Configure checks for exposed credentials.
         */
        exposed_credential_check?: RulesetsChallengeRule.ExposedCredentialCheck;
        /**
         * The expression defining which traffic will match the rule.
         */
        expression?: string;
        /**
         * An object configuring the rule's logging behavior.
         */
        logging?: RulesAPI.Logging;
        /**
         * An object configuring the rule's ratelimit behavior.
         */
        ratelimit?: RulesetsChallengeRule.Ratelimit;
        /**
         * The reference of the rule (the rule ID by default).
         */
        ref?: string;
    }
    namespace RulesetsChallengeRule {
        /**
         * Configure checks for exposed credentials.
         */
        interface ExposedCredentialCheck {
            /**
             * Expression that selects the password used in the credentials check.
             */
            password_expression: string;
            /**
             * Expression that selects the user ID used in the credentials check.
             */
            username_expression: string;
        }
        /**
         * An object configuring the rule's ratelimit behavior.
         */
        interface Ratelimit {
            /**
             * Characteristics of the request on which the ratelimiter counter will be
             * incremented.
             */
            characteristics: Array<string>;
            /**
             * Period in seconds over which the counter is being incremented.
             */
            period: number;
            /**
             * Defines when the ratelimit counter should be incremented. It is optional and
             * defaults to the same as the rule's expression.
             */
            counting_expression?: string;
            /**
             * Period of time in seconds after which the action will be disabled following its
             * first execution.
             */
            mitigation_timeout?: number;
            /**
             * The threshold of requests per period after which the action will be executed for
             * the first time.
             */
            requests_per_period?: number;
            /**
             * Defines if ratelimit counting is only done when an origin is reached.
             */
            requests_to_origin?: boolean;
            /**
             * The score threshold per period for which the action will be executed the first
             * time.
             */
            score_per_period?: number;
            /**
             * The response header name provided by the origin which should contain the score
             * to increment ratelimit counter on.
             */
            score_response_header_name?: string;
        }
    }
    interface RulesetsJSChallengeRule {
        /**
         * The timestamp of when the rule was last modified.
         */
        last_updated: string;
        /**
         * The version of the rule.
         */
        version: string;
        /**
         * The unique ID of the rule.
         */
        id?: string;
        /**
         * The action to perform when the rule matches.
         */
        action?: 'js_challenge';
        /**
         * The parameters configuring the rule's action.
         */
        action_parameters?: unknown;
        /**
         * The categories of the rule.
         */
        categories?: Array<string>;
        /**
         * An informative description of the rule.
         */
        description?: string;
        /**
         * Whether the rule should be executed.
         */
        enabled?: boolean;
        /**
         * Configure checks for exposed credentials.
         */
        exposed_credential_check?: RulesetsJSChallengeRule.ExposedCredentialCheck;
        /**
         * The expression defining which traffic will match the rule.
         */
        expression?: string;
        /**
         * An object configuring the rule's logging behavior.
         */
        logging?: RulesAPI.Logging;
        /**
         * An object configuring the rule's ratelimit behavior.
         */
        ratelimit?: RulesetsJSChallengeRule.Ratelimit;
        /**
         * The reference of the rule (the rule ID by default).
         */
        ref?: string;
    }
    namespace RulesetsJSChallengeRule {
        /**
         * Configure checks for exposed credentials.
         */
        interface ExposedCredentialCheck {
            /**
             * Expression that selects the password used in the credentials check.
             */
            password_expression: string;
            /**
             * Expression that selects the user ID used in the credentials check.
             */
            username_expression: string;
        }
        /**
         * An object configuring the rule's ratelimit behavior.
         */
        interface Ratelimit {
            /**
             * Characteristics of the request on which the ratelimiter counter will be
             * incremented.
             */
            characteristics: Array<string>;
            /**
             * Period in seconds over which the counter is being incremented.
             */
            period: number;
            /**
             * Defines when the ratelimit counter should be incremented. It is optional and
             * defaults to the same as the rule's expression.
             */
            counting_expression?: string;
            /**
             * Period of time in seconds after which the action will be disabled following its
             * first execution.
             */
            mitigation_timeout?: number;
            /**
             * The threshold of requests per period after which the action will be executed for
             * the first time.
             */
            requests_per_period?: number;
            /**
             * Defines if ratelimit counting is only done when an origin is reached.
             */
            requests_to_origin?: boolean;
            /**
             * The score threshold per period for which the action will be executed the first
             * time.
             */
            score_per_period?: number;
            /**
             * The response header name provided by the origin which should contain the score
             * to increment ratelimit counter on.
             */
            score_response_header_name?: string;
        }
    }
}
export interface VersionListParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface VersionGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace Versions {
    export { type VersionListResponse as VersionListResponse, type VersionGetResponse as VersionGetResponse, VersionListResponsesSinglePage as VersionListResponsesSinglePage, type VersionListParams as VersionListParams, type VersionGetParams as VersionGetParams, };
}
//# sourceMappingURL=versions.d.ts.map