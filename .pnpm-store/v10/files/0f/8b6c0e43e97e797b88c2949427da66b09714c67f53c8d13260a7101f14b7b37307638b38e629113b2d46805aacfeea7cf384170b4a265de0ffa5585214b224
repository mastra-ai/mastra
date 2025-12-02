// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as RulesAPI from './rules';
import * as RulesetsAPI from './rulesets';
import { CloudflareError } from '../../error';
import { SinglePage } from '../../pagination';

export class Versions extends APIResource {
  /**
   * Fetches the versions of an account or zone ruleset.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const versionListResponse of client.rulesets.versions.list(
   *   '2f2feab2026849078ba485f918791bdc',
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    rulesetId: string,
    params?: VersionListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<VersionListResponsesSinglePage, VersionListResponse>;
  list(
    rulesetId: string,
    options?: Core.RequestOptions,
  ): Core.PagePromise<VersionListResponsesSinglePage, VersionListResponse>;
  list(
    rulesetId: string,
    params: VersionListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<VersionListResponsesSinglePage, VersionListResponse> {
    if (isRequestOptions(params)) {
      return this.list(rulesetId, {}, params);
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
    return this._client.getAPIList(
      `/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/versions`,
      VersionListResponsesSinglePage,
      options,
    );
  }

  /**
   * Deletes an existing version of an account or zone ruleset.
   *
   * @example
   * ```ts
   * await client.rulesets.versions.delete(
   *   '2f2feab2026849078ba485f918791bdc',
   *   '1',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  delete(
    rulesetId: string,
    rulesetVersion: string,
    params?: VersionDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<void>;
  delete(rulesetId: string, rulesetVersion: string, options?: Core.RequestOptions): Core.APIPromise<void>;
  delete(
    rulesetId: string,
    rulesetVersion: string,
    params: VersionDeleteParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<void> {
    if (isRequestOptions(params)) {
      return this.delete(rulesetId, rulesetVersion, {}, params);
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
    return this._client.delete(
      `/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/versions/${rulesetVersion}`,
      { ...options, headers: { Accept: '*/*', ...options?.headers } },
    );
  }

  /**
   * Fetches a specific version of an account or zone ruleset.
   *
   * @example
   * ```ts
   * const version = await client.rulesets.versions.get(
   *   '2f2feab2026849078ba485f918791bdc',
   *   '1',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    rulesetId: string,
    rulesetVersion: string,
    params?: VersionGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VersionGetResponse>;
  get(
    rulesetId: string,
    rulesetVersion: string,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VersionGetResponse>;
  get(
    rulesetId: string,
    rulesetVersion: string,
    params: VersionGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<VersionGetResponse> {
    if (isRequestOptions(params)) {
      return this.get(rulesetId, rulesetVersion, {}, params);
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
        `/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/versions/${rulesetVersion}`,
        options,
      ) as Core.APIPromise<{ result: VersionGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class VersionListResponsesSinglePage extends SinglePage<VersionListResponse> {}

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
  rules: Array<
    | RulesAPI.BlockRule
    | VersionGetResponse.RulesetsChallengeRule
    | RulesAPI.CompressResponseRule
    | RulesAPI.ExecuteRule
    | VersionGetResponse.RulesetsJSChallengeRule
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

export namespace VersionGetResponse {
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

export interface VersionDeleteParams {
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

Versions.VersionListResponsesSinglePage = VersionListResponsesSinglePage;

export declare namespace Versions {
  export {
    type VersionListResponse as VersionListResponse,
    type VersionGetResponse as VersionGetResponse,
    VersionListResponsesSinglePage as VersionListResponsesSinglePage,
    type VersionListParams as VersionListParams,
    type VersionDeleteParams as VersionDeleteParams,
    type VersionGetParams as VersionGetParams,
  };
}
