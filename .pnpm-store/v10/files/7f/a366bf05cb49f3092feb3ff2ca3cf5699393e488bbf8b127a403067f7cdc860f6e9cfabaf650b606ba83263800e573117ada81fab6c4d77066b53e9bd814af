// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Overrides extends APIResource {
  /**
   * Creates a URI-based WAF override for a zone.
   *
   * **Note:** Applies only to the
   * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
   *
   * @deprecated
   */
  create(params: OverrideCreateParams, options?: Core.RequestOptions): Core.APIPromise<Override> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/firewall/waf/overrides`, { body, ...options }) as Core.APIPromise<{
        result: Override;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates an existing URI-based WAF override.
   *
   * **Note:** Applies only to the
   * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
   *
   * @deprecated
   */
  update(
    overridesId: string,
    params: OverrideUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Override> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/firewall/waf/overrides/${overridesId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Override }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches the URI-based WAF overrides in a zone.
   *
   * **Note:** Applies only to the
   * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
   *
   * @deprecated
   */
  list(
    params: OverrideListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<OverridesV4PagePaginationArray, Override> {
    const { zone_id, ...query } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/firewall/waf/overrides`,
      OverridesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletes an existing URI-based WAF override.
   *
   * **Note:** Applies only to the
   * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
   *
   * @deprecated
   */
  delete(
    overridesId: string,
    params: OverrideDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OverrideDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(
        `/zones/${zone_id}/firewall/waf/overrides/${overridesId}`,
        options,
      ) as Core.APIPromise<{ result: OverrideDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches the details of a URI-based WAF override.
   *
   * **Note:** Applies only to the
   * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
   *
   * @deprecated
   */
  get(
    overridesId: string,
    params: OverrideGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Override> {
    const { zone_id } = params;
    return (
      this._client.get(
        `/zones/${zone_id}/firewall/waf/overrides/${overridesId}`,
        options,
      ) as Core.APIPromise<{ result: Override }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class OverridesV4PagePaginationArray extends V4PagePaginationArray<Override> {}

export interface Override {
  /**
   * The unique identifier of the WAF override.
   */
  id?: string;

  /**
   * An informative summary of the current URI-based WAF override.
   */
  description?: string | null;

  /**
   * An object that allows you to enable or disable WAF rule groups for the current
   * WAF override. Each key of this object must be the ID of a WAF rule group, and
   * each value must be a valid WAF action (usually `default` or `disable`). When
   * creating a new URI-based WAF override, you must provide a `groups` object or a
   * `rules` object.
   */
  groups?: { [key: string]: unknown };

  /**
   * When true, indicates that the rule is currently paused.
   */
  paused?: boolean;

  /**
   * The relative priority of the current URI-based WAF override when multiple
   * overrides match a single URL. A lower number indicates higher priority. Higher
   * priority overrides may overwrite values set by lower priority overrides.
   */
  priority?: number;

  /**
   * Specifies that, when a WAF rule matches, its configured action will be replaced
   * by the action configured in this object.
   */
  rewrite_action?: RewriteAction;

  /**
   * An object that allows you to override the action of specific WAF rules. Each key
   * of this object must be the ID of a WAF rule, and each value must be a valid WAF
   * action. Unless you are disabling a rule, ensure that you also enable the rule
   * group that this WAF rule belongs to. When creating a new URI-based WAF override,
   * you must provide a `groups` object or a `rules` object.
   */
  rules?: WAFRule;

  /**
   * The URLs to include in the current WAF override. You can use wildcards. Each
   * entered URL will be escaped before use, which means you can only use simple
   * wildcard patterns.
   */
  urls?: Array<OverrideURL>;
}

export type OverrideURL = string;

export type OverrideURLParam = string;

/**
 * Specifies that, when a WAF rule matches, its configured action will be replaced
 * by the action configured in this object.
 */
export interface RewriteAction {
  /**
   * The WAF rule action to apply.
   */
  block?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';

  /**
   * The WAF rule action to apply.
   */
  challenge?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';

  /**
   * The WAF rule action to apply.
   */
  default?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';

  /**
   * The WAF rule action to apply.
   */
  disable?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';

  /**
   * The WAF rule action to apply.
   */
  simulate?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';
}

/**
 * Specifies that, when a WAF rule matches, its configured action will be replaced
 * by the action configured in this object.
 */
export interface RewriteActionParam {
  /**
   * The WAF rule action to apply.
   */
  block?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';

  /**
   * The WAF rule action to apply.
   */
  challenge?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';

  /**
   * The WAF rule action to apply.
   */
  default?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';

  /**
   * The WAF rule action to apply.
   */
  disable?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';

  /**
   * The WAF rule action to apply.
   */
  simulate?: 'challenge' | 'block' | 'simulate' | 'disable' | 'default';
}

/**
 * An object that allows you to override the action of specific WAF rules. Each key
 * of this object must be the ID of a WAF rule, and each value must be a valid WAF
 * action. Unless you are disabling a rule, ensure that you also enable the rule
 * group that this WAF rule belongs to. When creating a new URI-based WAF override,
 * you must provide a `groups` object or a `rules` object.
 */
export type WAFRule = { [key: string]: 'challenge' | 'block' | 'simulate' | 'disable' | 'default' };

/**
 * An object that allows you to override the action of specific WAF rules. Each key
 * of this object must be the ID of a WAF rule, and each value must be a valid WAF
 * action. Unless you are disabling a rule, ensure that you also enable the rule
 * group that this WAF rule belongs to. When creating a new URI-based WAF override,
 * you must provide a `groups` object or a `rules` object.
 */
export type WAFRuleParam = { [key: string]: 'challenge' | 'block' | 'simulate' | 'disable' | 'default' };

export interface OverrideDeleteResponse {
  /**
   * The unique identifier of the WAF override.
   */
  id?: string;
}

export interface OverrideCreateParams {
  /**
   * Path param: Defines an identifier.
   */
  zone_id: string;

  /**
   * Body param: The URLs to include in the current WAF override. You can use
   * wildcards. Each entered URL will be escaped before use, which means you can only
   * use simple wildcard patterns.
   */
  urls: Array<OverrideURLParam>;
}

export interface OverrideUpdateParams {
  /**
   * Path param: Defines an identifier.
   */
  zone_id: string;

  /**
   * Body param: Defines an identifier.
   */
  id: string;

  /**
   * Body param: Specifies that, when a WAF rule matches, its configured action will
   * be replaced by the action configured in this object.
   */
  rewrite_action: RewriteActionParam;

  /**
   * Body param: An object that allows you to override the action of specific WAF
   * rules. Each key of this object must be the ID of a WAF rule, and each value must
   * be a valid WAF action. Unless you are disabling a rule, ensure that you also
   * enable the rule group that this WAF rule belongs to. When creating a new
   * URI-based WAF override, you must provide a `groups` object or a `rules` object.
   */
  rules: WAFRuleParam;

  /**
   * Body param: The URLs to include in the current WAF override. You can use
   * wildcards. Each entered URL will be escaped before use, which means you can only
   * use simple wildcard patterns.
   */
  urls: Array<OverrideURLParam>;
}

export interface OverrideListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Defines an identifier.
   */
  zone_id: string;
}

export interface OverrideDeleteParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

export interface OverrideGetParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

Overrides.OverridesV4PagePaginationArray = OverridesV4PagePaginationArray;

export declare namespace Overrides {
  export {
    type Override as Override,
    type OverrideURL as OverrideURL,
    type RewriteAction as RewriteAction,
    type WAFRule as WAFRule,
    type OverrideDeleteResponse as OverrideDeleteResponse,
    OverridesV4PagePaginationArray as OverridesV4PagePaginationArray,
    type OverrideCreateParams as OverrideCreateParams,
    type OverrideUpdateParams as OverrideUpdateParams,
    type OverrideListParams as OverrideListParams,
    type OverrideDeleteParams as OverrideDeleteParams,
    type OverrideGetParams as OverrideGetParams,
  };
}
