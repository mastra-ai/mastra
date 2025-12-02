// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as RulesAPI from './rules';
import {
  BlockRule,
  CompressResponseRule,
  DDoSDynamicRule,
  ExecuteRule,
  ForceConnectionCloseRule,
  LogCustomFieldRule,
  LogRule,
  Logging,
  ManagedChallengeRule,
  RedirectRule,
  RewriteRule,
  RewriteURIPart,
  RouteRule,
  RuleCreateParams,
  RuleCreateResponse,
  RuleDeleteParams,
  RuleDeleteResponse,
  RuleEditParams,
  RuleEditResponse,
  Rules,
  RulesetRule,
  ScoreRule,
  ServeErrorRule,
  SetCacheSettingsRule,
  SetConfigRule,
  SkipRule,
} from './rules';
import * as VersionsAPI from './versions';
import {
  VersionDeleteParams,
  VersionGetParams,
  VersionGetResponse,
  VersionListParams,
  VersionListResponse,
  VersionListResponsesSinglePage,
  Versions,
} from './versions';
import * as PhasesAPI from './phases/phases';
import {
  PhaseGetParams,
  PhaseGetResponse,
  PhaseUpdateParams,
  PhaseUpdateResponse,
  Phases,
} from './phases/phases';
import { CloudflareError } from '../../error';
import { CursorPagination, type CursorPaginationParams } from '../../pagination';

export class Rulesets extends APIResource {
  phases: PhasesAPI.Phases = new PhasesAPI.Phases(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);

  /**
   * Creates a ruleset.
   *
   * @example
   * ```ts
   * const ruleset = await client.rulesets.create({
   *   kind: 'root',
   *   name: 'My ruleset',
   *   phase: 'http_request_firewall_custom',
   *   account_id: 'account_id',
   * });
   * ```
   */
  create(params: RulesetCreateParams, options?: Core.RequestOptions): Core.APIPromise<RulesetCreateResponse> {
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
      this._client.post(`/${accountOrZone}/${accountOrZoneId}/rulesets`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RulesetCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates an account or zone ruleset, creating a new version.
   *
   * @example
   * ```ts
   * const ruleset = await client.rulesets.update(
   *   '2f2feab2026849078ba485f918791bdc',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  update(
    rulesetId: string,
    params: RulesetUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RulesetUpdateResponse> {
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
      this._client.put(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RulesetUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches all rulesets.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const rulesetListResponse of client.rulesets.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params?: RulesetListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RulesetListResponsesCursorPagination, RulesetListResponse>;
  list(
    options?: Core.RequestOptions,
  ): Core.PagePromise<RulesetListResponsesCursorPagination, RulesetListResponse>;
  list(
    params: RulesetListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<RulesetListResponsesCursorPagination, RulesetListResponse> {
    if (isRequestOptions(params)) {
      return this.list({}, params);
    }
    const { account_id, zone_id, ...query } = params;
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
    return this._client.getAPIList(
      `/${accountOrZone}/${accountOrZoneId}/rulesets`,
      RulesetListResponsesCursorPagination,
      { query, ...options },
    );
  }

  /**
   * Deletes all versions of an existing account or zone ruleset.
   *
   * @example
   * ```ts
   * await client.rulesets.delete(
   *   '2f2feab2026849078ba485f918791bdc',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  delete(
    rulesetId: string,
    params?: RulesetDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<void>;
  delete(rulesetId: string, options?: Core.RequestOptions): Core.APIPromise<void>;
  delete(
    rulesetId: string,
    params: RulesetDeleteParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<void> {
    if (isRequestOptions(params)) {
      return this.delete(rulesetId, {}, params);
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
    return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`, {
      ...options,
      headers: { Accept: '*/*', ...options?.headers },
    });
  }

  /**
   * Fetches the latest version of an account or zone ruleset.
   *
   * @example
   * ```ts
   * const ruleset = await client.rulesets.get(
   *   '2f2feab2026849078ba485f918791bdc',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    rulesetId: string,
    params?: RulesetGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RulesetGetResponse>;
  get(rulesetId: string, options?: Core.RequestOptions): Core.APIPromise<RulesetGetResponse>;
  get(
    rulesetId: string,
    params: RulesetGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<RulesetGetResponse> {
    if (isRequestOptions(params)) {
      return this.get(rulesetId, {}, params);
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
        `/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`,
        options,
      ) as Core.APIPromise<{ result: RulesetGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class RulesetListResponsesCursorPagination extends CursorPagination<RulesetListResponse> {}

/**
 * The kind of the ruleset.
 */
export type Kind = 'managed' | 'custom' | 'root' | 'zone';

/**
 * The kind of the ruleset.
 */
export type KindParam = 'managed' | 'custom' | 'root' | 'zone';

/**
 * The phase of the ruleset.
 */
export type Phase =
  | 'ddos_l4'
  | 'ddos_l7'
  | 'http_config_settings'
  | 'http_custom_errors'
  | 'http_log_custom_fields'
  | 'http_ratelimit'
  | 'http_request_cache_settings'
  | 'http_request_dynamic_redirect'
  | 'http_request_firewall_custom'
  | 'http_request_firewall_managed'
  | 'http_request_late_transform'
  | 'http_request_origin'
  | 'http_request_redirect'
  | 'http_request_sanitize'
  | 'http_request_sbfm'
  | 'http_request_transform'
  | 'http_response_compression'
  | 'http_response_firewall_managed'
  | 'http_response_headers_transform'
  | 'magic_transit'
  | 'magic_transit_ids_managed'
  | 'magic_transit_managed'
  | 'magic_transit_ratelimit';

/**
 * The phase of the ruleset.
 */
export type PhaseParam =
  | 'ddos_l4'
  | 'ddos_l7'
  | 'http_config_settings'
  | 'http_custom_errors'
  | 'http_log_custom_fields'
  | 'http_ratelimit'
  | 'http_request_cache_settings'
  | 'http_request_dynamic_redirect'
  | 'http_request_firewall_custom'
  | 'http_request_firewall_managed'
  | 'http_request_late_transform'
  | 'http_request_origin'
  | 'http_request_redirect'
  | 'http_request_sanitize'
  | 'http_request_sbfm'
  | 'http_request_transform'
  | 'http_response_compression'
  | 'http_response_firewall_managed'
  | 'http_response_headers_transform'
  | 'magic_transit'
  | 'magic_transit_ids_managed'
  | 'magic_transit_managed'
  | 'magic_transit_ratelimit';

/**
 * A ruleset object.
 */
export interface Ruleset {
  /**
   * The unique ID of the ruleset.
   */
  id: string;

  /**
   * The timestamp of when the ruleset was last modified.
   */
  last_updated: string;

  /**
   * The version of the ruleset.
   */
  version: string;

  /**
   * An informative description of the ruleset.
   */
  description?: string;

  /**
   * The human-readable name of the ruleset.
   */
  name?: string;
}

/**
 * A ruleset object.
 */
export interface RulesetCreateResponse {
  /**
   * The unique ID of the ruleset.
   */
  id: string;

  /**
   * The kind of the ruleset.
   */
  kind: Kind;

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
  phase: Phase;

  /**
   * The list of rules in the ruleset.
   */
  rules: Array<
    | RulesAPI.BlockRule
    | RulesetCreateResponse.RulesetsChallengeRule
    | RulesAPI.CompressResponseRule
    | RulesAPI.ExecuteRule
    | RulesetCreateResponse.RulesetsJSChallengeRule
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

export namespace RulesetCreateResponse {
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
export interface RulesetUpdateResponse {
  /**
   * The unique ID of the ruleset.
   */
  id: string;

  /**
   * The kind of the ruleset.
   */
  kind: Kind;

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
  phase: Phase;

  /**
   * The list of rules in the ruleset.
   */
  rules: Array<
    | RulesAPI.BlockRule
    | RulesetUpdateResponse.RulesetsChallengeRule
    | RulesAPI.CompressResponseRule
    | RulesAPI.ExecuteRule
    | RulesetUpdateResponse.RulesetsJSChallengeRule
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

export namespace RulesetUpdateResponse {
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
export interface RulesetListResponse {
  /**
   * The unique ID of the ruleset.
   */
  id: string;

  /**
   * The kind of the ruleset.
   */
  kind: Kind;

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
  phase: Phase;

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
export interface RulesetGetResponse {
  /**
   * The unique ID of the ruleset.
   */
  id: string;

  /**
   * The kind of the ruleset.
   */
  kind: Kind;

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
  phase: Phase;

  /**
   * The list of rules in the ruleset.
   */
  rules: Array<
    | RulesAPI.BlockRule
    | RulesetGetResponse.RulesetsChallengeRule
    | RulesAPI.CompressResponseRule
    | RulesAPI.ExecuteRule
    | RulesetGetResponse.RulesetsJSChallengeRule
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

export namespace RulesetGetResponse {
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

export interface RulesetCreateParams {
  /**
   * Body param: The kind of the ruleset.
   */
  kind: KindParam;

  /**
   * Body param: The human-readable name of the ruleset.
   */
  name: string;

  /**
   * Body param: The phase of the ruleset.
   */
  phase: PhaseParam;

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
   * Body param: The list of rules in the ruleset.
   */
  rules?: Array<
    | RulesAPI.BlockRuleParam
    | RulesetCreateParams.RulesetsChallengeRule
    | RulesAPI.CompressResponseRuleParam
    | RulesAPI.ExecuteRuleParam
    | RulesetCreateParams.RulesetsJSChallengeRule
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

export namespace RulesetCreateParams {
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

export interface RulesetUpdateParams {
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
   * Body param: The kind of the ruleset.
   */
  kind?: KindParam;

  /**
   * Body param: The human-readable name of the ruleset.
   */
  name?: string;

  /**
   * Body param: The phase of the ruleset.
   */
  phase?: PhaseParam;

  /**
   * Body param: The list of rules in the ruleset.
   */
  rules?: Array<
    | RulesAPI.BlockRuleParam
    | RulesetUpdateParams.RulesetsChallengeRule
    | RulesAPI.CompressResponseRuleParam
    | RulesAPI.ExecuteRuleParam
    | RulesetUpdateParams.RulesetsJSChallengeRule
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

export namespace RulesetUpdateParams {
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

export interface RulesetListParams extends CursorPaginationParams {
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
}

export interface RulesetDeleteParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export interface RulesetGetParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

Rulesets.RulesetListResponsesCursorPagination = RulesetListResponsesCursorPagination;
Rulesets.Phases = Phases;
Rulesets.Rules = Rules;
Rulesets.Versions = Versions;
Rulesets.VersionListResponsesSinglePage = VersionListResponsesSinglePage;

export declare namespace Rulesets {
  export {
    type Kind as Kind,
    type Phase as Phase,
    type Ruleset as Ruleset,
    type RulesetCreateResponse as RulesetCreateResponse,
    type RulesetUpdateResponse as RulesetUpdateResponse,
    type RulesetListResponse as RulesetListResponse,
    type RulesetGetResponse as RulesetGetResponse,
    RulesetListResponsesCursorPagination as RulesetListResponsesCursorPagination,
    type RulesetCreateParams as RulesetCreateParams,
    type RulesetUpdateParams as RulesetUpdateParams,
    type RulesetListParams as RulesetListParams,
    type RulesetDeleteParams as RulesetDeleteParams,
    type RulesetGetParams as RulesetGetParams,
  };

  export {
    Phases as Phases,
    type PhaseUpdateResponse as PhaseUpdateResponse,
    type PhaseGetResponse as PhaseGetResponse,
    type PhaseUpdateParams as PhaseUpdateParams,
    type PhaseGetParams as PhaseGetParams,
  };

  export {
    Rules as Rules,
    type BlockRule as BlockRule,
    type CompressResponseRule as CompressResponseRule,
    type DDoSDynamicRule as DDoSDynamicRule,
    type ExecuteRule as ExecuteRule,
    type ForceConnectionCloseRule as ForceConnectionCloseRule,
    type LogCustomFieldRule as LogCustomFieldRule,
    type LogRule as LogRule,
    type Logging as Logging,
    type ManagedChallengeRule as ManagedChallengeRule,
    type RedirectRule as RedirectRule,
    type RewriteRule as RewriteRule,
    type RewriteURIPart as RewriteURIPart,
    type RouteRule as RouteRule,
    type RulesetRule as RulesetRule,
    type ScoreRule as ScoreRule,
    type ServeErrorRule as ServeErrorRule,
    type SetCacheSettingsRule as SetCacheSettingsRule,
    type SetConfigRule as SetConfigRule,
    type SkipRule as SkipRule,
    type RuleCreateResponse as RuleCreateResponse,
    type RuleDeleteResponse as RuleDeleteResponse,
    type RuleEditResponse as RuleEditResponse,
    type RuleCreateParams as RuleCreateParams,
    type RuleDeleteParams as RuleDeleteParams,
    type RuleEditParams as RuleEditParams,
  };

  export {
    Versions as Versions,
    type VersionListResponse as VersionListResponse,
    type VersionGetResponse as VersionGetResponse,
    VersionListResponsesSinglePage as VersionListResponsesSinglePage,
    type VersionListParams as VersionListParams,
    type VersionDeleteParams as VersionDeleteParams,
    type VersionGetParams as VersionGetParams,
  };
}
