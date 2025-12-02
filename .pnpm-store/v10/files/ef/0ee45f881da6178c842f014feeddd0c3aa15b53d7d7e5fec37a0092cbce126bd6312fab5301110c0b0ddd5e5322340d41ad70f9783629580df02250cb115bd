// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';
import * as RulesAPI from '../rules';
import * as RulesetsAPI from '../rulesets';
import * as VersionsAPI from './versions';
import {
  VersionGetParams,
  VersionGetResponse,
  VersionListParams,
  VersionListResponse,
  VersionListResponsesSinglePage,
  Versions,
} from './versions';
import { CloudflareError } from '../../../error';

export class Phases extends APIResource {
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);

  /**
   * Updates an account or zone entry point ruleset, creating a new version.
   *
   * @example
   * ```ts
   * const phase = await client.rulesets.phases.update(
   *   'http_request_firewall_custom',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  update(
    rulesetPhase: RulesetsAPI.PhaseParam,
    params: PhaseUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PhaseUpdateResponse> {
    const { account_id, zone_id, ...body } = params;
    if (!account_id && !zone_id) {
      throw new CloudflareError('You must provide either account_id or zone_id.');
    }
    if (account_id && zone_id) {
      throw new CloudflareError('You cannot provide both account_id and zone_id.');
    }
    const { accountOrZone, accountOrZoneId } =
      account_id ?
        {
          accountOrZone: 'accounts',
          accountOrZoneId: account_id,
        }
      : {
          accountOrZone: 'zones',
          accountOrZoneId: zone_id,
        };
    return (
      this._client.put(`/${accountOrZone}/${accountOrZoneId}/rulesets/phases/${rulesetPhase}/entrypoint`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PhaseUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches the latest version of the account or zone entry point ruleset for a
   * given phase.
   *
   * @example
   * ```ts
   * const phase = await client.rulesets.phases.get(
   *   'http_request_firewall_custom',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    rulesetPhase: RulesetsAPI.PhaseParam,
    params?: PhaseGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PhaseGetResponse>;
  get(rulesetPhase: RulesetsAPI.PhaseParam, options?: Core.RequestOptions): Core.APIPromise<PhaseGetResponse>;
  get(
    rulesetPhase: RulesetsAPI.PhaseParam,
    params: PhaseGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<PhaseGetResponse> {
    if (isRequestOptions(params)) {
      return this.get(rulesetPhase, {}, params);
    }
    const { account_id, zone_id } = params;
    if (!account_id && !zone_id) {
      throw new CloudflareError('You must provide either account_id or zone_id.');
    }
    if (account_id && zone_id) {
      throw new CloudflareError('You cannot provide both account_id and zone_id.');
    }
    const { accountOrZone, accountOrZoneId } =
      account_id ?
        {
          accountOrZone: 'accounts',
          accountOrZoneId: account_id,
        }
      : {
          accountOrZone: 'zones',
          accountOrZoneId: zone_id,
        };
    return (
      this._client.get(
        `/${accountOrZone}/${accountOrZoneId}/rulesets/phases/${rulesetPhase}/entrypoint`,
        options,
      ) as Core.APIPromise<{ result: PhaseGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * A ruleset object.
 */
export interface PhaseUpdateResponse {
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
  rules: Array<
    | RulesAPI.BlockRule
    | PhaseUpdateResponse.RulesetsChallengeRule
    | RulesAPI.CompressResponseRule
    | RulesAPI.ExecuteRule
    | PhaseUpdateResponse.RulesetsJSChallengeRule
    | RulesAPI.LogRule
    | RulesAPI.ManagedChallengeRule
    | RulesAPI.RedirectRule
    | RulesAPI.RewriteRule
    | RulesAPI.RouteRule
    | RulesAPI.ScoreRule
    | RulesAPI.ServeErrorRule
    | RulesAPI.SetConfigRule
    | RulesAPI.SkipRule
    | RulesAPI.SetCacheSettingsRule
    | RulesAPI.LogCustomFieldRule
    | RulesAPI.DDoSDynamicRule
    | RulesAPI.ForceConnectionCloseRule
  >;

  /**
   * The version of the ruleset.
   */
  version: string;

  /**
   * An informative description of the ruleset.
   */
  description?: string;
}

export namespace PhaseUpdateResponse {
  export interface RulesetsChallengeRule {
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

  export namespace RulesetsChallengeRule {
    /**
     * Configure checks for exposed credentials.
     */
    export interface ExposedCredentialCheck {
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
    export interface Ratelimit {
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

  export interface RulesetsJSChallengeRule {
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

  export namespace RulesetsJSChallengeRule {
    /**
     * Configure checks for exposed credentials.
     */
    export interface ExposedCredentialCheck {
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
    export interface Ratelimit {
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

/**
 * A ruleset object.
 */
export interface PhaseGetResponse {
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
  rules: Array<
    | RulesAPI.BlockRule
    | PhaseGetResponse.RulesetsChallengeRule
    | RulesAPI.CompressResponseRule
    | RulesAPI.ExecuteRule
    | PhaseGetResponse.RulesetsJSChallengeRule
    | RulesAPI.LogRule
    | RulesAPI.ManagedChallengeRule
    | RulesAPI.RedirectRule
    | RulesAPI.RewriteRule
    | RulesAPI.RouteRule
    | RulesAPI.ScoreRule
    | RulesAPI.ServeErrorRule
    | RulesAPI.SetConfigRule
    | RulesAPI.SkipRule
    | RulesAPI.SetCacheSettingsRule
    | RulesAPI.LogCustomFieldRule
    | RulesAPI.DDoSDynamicRule
    | RulesAPI.ForceConnectionCloseRule
  >;

  /**
   * The version of the ruleset.
   */
  version: string;

  /**
   * An informative description of the ruleset.
   */
  description?: string;
}

export namespace PhaseGetResponse {
  export interface RulesetsChallengeRule {
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

  export namespace RulesetsChallengeRule {
    /**
     * Configure checks for exposed credentials.
     */
    export interface ExposedCredentialCheck {
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
    export interface Ratelimit {
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

  export interface RulesetsJSChallengeRule {
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

  export namespace RulesetsJSChallengeRule {
    /**
     * Configure checks for exposed credentials.
     */
    export interface ExposedCredentialCheck {
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
    export interface Ratelimit {
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

export interface PhaseUpdateParams {
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
   * Body param: An informative description of the ruleset.
   */
  description?: string;

  /**
   * Body param: The human-readable name of the ruleset.
   */
  name?: string;

  /**
   * Body param: The list of rules in the ruleset.
   */
  rules?: Array<
    | RulesAPI.BlockRuleParam
    | PhaseUpdateParams.RulesetsChallengeRule
    | RulesAPI.CompressResponseRuleParam
    | RulesAPI.ExecuteRuleParam
    | PhaseUpdateParams.RulesetsJSChallengeRule
    | RulesAPI.LogRuleParam
    | RulesAPI.ManagedChallengeRuleParam
    | RulesAPI.RedirectRuleParam
    | RulesAPI.RewriteRuleParam
    | RulesAPI.RouteRuleParam
    | RulesAPI.ScoreRuleParam
    | RulesAPI.ServeErrorRuleParam
    | RulesAPI.SetConfigRuleParam
    | RulesAPI.SkipRuleParam
    | RulesAPI.SetCacheSettingsRuleParam
    | RulesAPI.LogCustomFieldRuleParam
    | RulesAPI.DDoSDynamicRuleParam
    | RulesAPI.ForceConnectionCloseRuleParam
  >;
}

export namespace PhaseUpdateParams {
  export interface RulesetsChallengeRule {
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
    logging?: RulesAPI.LoggingParam;

    /**
     * An object configuring the rule's ratelimit behavior.
     */
    ratelimit?: RulesetsChallengeRule.Ratelimit;

    /**
     * The reference of the rule (the rule ID by default).
     */
    ref?: string;
  }

  export namespace RulesetsChallengeRule {
    /**
     * Configure checks for exposed credentials.
     */
    export interface ExposedCredentialCheck {
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
    export interface Ratelimit {
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

  export interface RulesetsJSChallengeRule {
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
    logging?: RulesAPI.LoggingParam;

    /**
     * An object configuring the rule's ratelimit behavior.
     */
    ratelimit?: RulesetsJSChallengeRule.Ratelimit;

    /**
     * The reference of the rule (the rule ID by default).
     */
    ref?: string;
  }

  export namespace RulesetsJSChallengeRule {
    /**
     * Configure checks for exposed credentials.
     */
    export interface ExposedCredentialCheck {
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
    export interface Ratelimit {
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

export interface PhaseGetParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

Phases.Versions = Versions;
Phases.VersionListResponsesSinglePage = VersionListResponsesSinglePage;

export declare namespace Phases {
  export {
    type PhaseUpdateResponse as PhaseUpdateResponse,
    type PhaseGetResponse as PhaseGetResponse,
    type PhaseUpdateParams as PhaseUpdateParams,
    type PhaseGetParams as PhaseGetParams,
  };

  export {
    Versions as Versions,
    type VersionListResponse as VersionListResponse,
    type VersionGetResponse as VersionGetResponse,
    VersionListResponsesSinglePage as VersionListResponsesSinglePage,
    type VersionListParams as VersionListParams,
    type VersionGetParams as VersionGetParams,
  };
}
