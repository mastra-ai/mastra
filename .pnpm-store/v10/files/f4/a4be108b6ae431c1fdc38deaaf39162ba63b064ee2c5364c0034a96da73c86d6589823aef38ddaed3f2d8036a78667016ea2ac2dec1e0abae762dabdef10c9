// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class CatchAlls extends APIResource {
  /**
   * Enable or disable catch-all routing rule, or change action to forward to
   * specific destination address.
   *
   * @example
   * ```ts
   * const catchAll =
   *   await client.emailRouting.rules.catchAlls.update({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     actions: [{ type: 'forward' }],
   *     matchers: [{ type: 'all' }],
   *   });
   * ```
   */
  update(
    params: CatchAllUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CatchAllUpdateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/email/routing/rules/catch_all`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CatchAllUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get information on the default catch-all routing rule.
   *
   * @example
   * ```ts
   * const catchAll =
   *   await client.emailRouting.rules.catchAlls.get({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  get(params: CatchAllGetParams, options?: Core.RequestOptions): Core.APIPromise<CatchAllGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/email/routing/rules/catch_all`, options) as Core.APIPromise<{
        result: CatchAllGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Action for the catch-all routing rule.
 */
export interface CatchAllAction {
  /**
   * Type of action for catch-all rule.
   */
  type: 'drop' | 'forward' | 'worker';

  value?: Array<string>;
}

/**
 * Action for the catch-all routing rule.
 */
export interface CatchAllActionParam {
  /**
   * Type of action for catch-all rule.
   */
  type: 'drop' | 'forward' | 'worker';

  value?: Array<string>;
}

/**
 * Matcher for catch-all routing rule.
 */
export interface CatchAllMatcher {
  /**
   * Type of matcher. Default is 'all'.
   */
  type: 'all';
}

/**
 * Matcher for catch-all routing rule.
 */
export interface CatchAllMatcherParam {
  /**
   * Type of matcher. Default is 'all'.
   */
  type: 'all';
}

export interface CatchAllUpdateResponse {
  /**
   * Routing rule identifier.
   */
  id?: string;

  /**
   * List actions for the catch-all routing rule.
   */
  actions?: Array<CatchAllAction>;

  /**
   * Routing rule status.
   */
  enabled?: true | false;

  /**
   * List of matchers for the catch-all routing rule.
   */
  matchers?: Array<CatchAllMatcher>;

  /**
   * Routing rule name.
   */
  name?: string;

  /**
   * @deprecated Routing rule tag. (Deprecated, replaced by routing rule identifier)
   */
  tag?: string;
}

export interface CatchAllGetResponse {
  /**
   * Routing rule identifier.
   */
  id?: string;

  /**
   * List actions for the catch-all routing rule.
   */
  actions?: Array<CatchAllAction>;

  /**
   * Routing rule status.
   */
  enabled?: true | false;

  /**
   * List of matchers for the catch-all routing rule.
   */
  matchers?: Array<CatchAllMatcher>;

  /**
   * Routing rule name.
   */
  name?: string;

  /**
   * @deprecated Routing rule tag. (Deprecated, replaced by routing rule identifier)
   */
  tag?: string;
}

export interface CatchAllUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: List actions for the catch-all routing rule.
   */
  actions: Array<CatchAllActionParam>;

  /**
   * Body param: List of matchers for the catch-all routing rule.
   */
  matchers: Array<CatchAllMatcherParam>;

  /**
   * Body param: Routing rule status.
   */
  enabled?: true | false;

  /**
   * Body param: Routing rule name.
   */
  name?: string;
}

export interface CatchAllGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace CatchAlls {
  export {
    type CatchAllAction as CatchAllAction,
    type CatchAllMatcher as CatchAllMatcher,
    type CatchAllUpdateResponse as CatchAllUpdateResponse,
    type CatchAllGetResponse as CatchAllGetResponse,
    type CatchAllUpdateParams as CatchAllUpdateParams,
    type CatchAllGetParams as CatchAllGetParams,
  };
}
