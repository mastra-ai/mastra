// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as Shared from '../../../shared';
import * as GroupsAPI from './groups';
import {
  Group,
  GroupEditParams,
  GroupEditResponse,
  GroupGetParams,
  GroupGetResponse,
  GroupListParams,
  Groups,
  GroupsV4PagePaginationArray,
} from './groups';
import * as RulesAPI from './rules';
import {
  AllowedModesAnomaly,
  RuleEditParams,
  RuleEditResponse,
  RuleGetParams,
  RuleGetResponse,
  RuleListParams,
  RuleListResponse,
  RuleListResponsesV4PagePaginationArray,
  Rules,
  WAFRuleGroup,
} from './rules';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../../pagination';

export class Packages extends APIResource {
  groups: GroupsAPI.Groups = new GroupsAPI.Groups(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);

  /**
   * Fetches WAF packages for a zone.
   *
   * **Note:** Applies only to the
   * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
   *
   * @deprecated
   */
  list(
    params: PackageListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PackageListResponsesV4PagePaginationArray, PackageListResponse> {
    const { zone_id, ...query } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/firewall/waf/packages`,
      PackageListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Fetches the details of a WAF package.
   *
   * **Note:** Applies only to the
   * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
   *
   * @deprecated
   */
  get(
    packageId: string,
    params: PackageGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PackageGetResponse> {
    const { zone_id } = params;
    return this._client.get(`/zones/${zone_id}/firewall/waf/packages/${packageId}`, options);
  }
}

export class PackageListResponsesV4PagePaginationArray extends V4PagePaginationArray<PackageListResponse> {}

export type PackageListResponse = unknown;

export type PackageGetResponse = PackageGetResponse.FirewallAPIResponseSingle | PackageGetResponse.Result;

export namespace PackageGetResponse {
  export interface FirewallAPIResponseSingle {
    errors: Array<Shared.ResponseInfo>;

    messages: Array<Shared.ResponseInfo>;

    result: unknown | string | null;

    /**
     * Defines whether the API call was successful.
     */
    success: true;
  }

  export interface Result {
    result?: unknown;
  }
}

export interface PackageListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Defines an identifier.
   */
  zone_id: string;

  /**
   * Query param: The direction used to sort returned packages.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: When set to `all`, all the search requirements must match. When set
   * to `any`, only one of the search requirements has to match.
   */
  match?: 'any' | 'all';

  /**
   * Query param: The name of the WAF package.
   */
  name?: string;

  /**
   * Query param: The field used to sort returned packages.
   */
  order?: 'name';
}

export interface PackageGetParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

Packages.PackageListResponsesV4PagePaginationArray = PackageListResponsesV4PagePaginationArray;
Packages.Groups = Groups;
Packages.GroupsV4PagePaginationArray = GroupsV4PagePaginationArray;
Packages.Rules = Rules;
Packages.RuleListResponsesV4PagePaginationArray = RuleListResponsesV4PagePaginationArray;

export declare namespace Packages {
  export {
    type PackageListResponse as PackageListResponse,
    type PackageGetResponse as PackageGetResponse,
    PackageListResponsesV4PagePaginationArray as PackageListResponsesV4PagePaginationArray,
    type PackageListParams as PackageListParams,
    type PackageGetParams as PackageGetParams,
  };

  export {
    Groups as Groups,
    type Group as Group,
    type GroupEditResponse as GroupEditResponse,
    type GroupGetResponse as GroupGetResponse,
    GroupsV4PagePaginationArray as GroupsV4PagePaginationArray,
    type GroupListParams as GroupListParams,
    type GroupEditParams as GroupEditParams,
    type GroupGetParams as GroupGetParams,
  };

  export {
    Rules as Rules,
    type AllowedModesAnomaly as AllowedModesAnomaly,
    type WAFRuleGroup as WAFRuleGroup,
    type RuleListResponse as RuleListResponse,
    type RuleEditResponse as RuleEditResponse,
    type RuleGetResponse as RuleGetResponse,
    RuleListResponsesV4PagePaginationArray as RuleListResponsesV4PagePaginationArray,
    type RuleListParams as RuleListParams,
    type RuleEditParams as RuleEditParams,
    type RuleGetParams as RuleGetParams,
  };
}
