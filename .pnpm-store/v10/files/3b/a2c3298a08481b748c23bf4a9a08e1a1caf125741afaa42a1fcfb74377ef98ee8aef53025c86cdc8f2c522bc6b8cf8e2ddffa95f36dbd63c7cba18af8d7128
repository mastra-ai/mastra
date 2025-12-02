// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as RulesAPI from './rules';
import {
  RUMRule,
  RuleBulkCreateParams,
  RuleBulkCreateResponse,
  RuleCreateParams,
  RuleDeleteParams,
  RuleDeleteResponse,
  RuleListParams,
  RuleListResponse,
  RuleUpdateParams,
  Rules,
} from './rules';
import * as SiteInfoAPI from './site-info';
import {
  Site,
  SiteInfo,
  SiteInfoCreateParams,
  SiteInfoDeleteParams,
  SiteInfoDeleteResponse,
  SiteInfoGetParams,
  SiteInfoListParams,
  SiteInfoUpdateParams,
  SitesV4PagePaginationArray,
} from './site-info';

export class RUM extends APIResource {
  siteInfo: SiteInfoAPI.SiteInfo = new SiteInfoAPI.SiteInfo(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);
}

RUM.SiteInfo = SiteInfo;
RUM.SitesV4PagePaginationArray = SitesV4PagePaginationArray;
RUM.Rules = Rules;

export declare namespace RUM {
  export {
    SiteInfo as SiteInfo,
    type Site as Site,
    type SiteInfoDeleteResponse as SiteInfoDeleteResponse,
    SitesV4PagePaginationArray as SitesV4PagePaginationArray,
    type SiteInfoCreateParams as SiteInfoCreateParams,
    type SiteInfoUpdateParams as SiteInfoUpdateParams,
    type SiteInfoListParams as SiteInfoListParams,
    type SiteInfoDeleteParams as SiteInfoDeleteParams,
    type SiteInfoGetParams as SiteInfoGetParams,
  };

  export {
    Rules as Rules,
    type RUMRule as RUMRule,
    type RuleListResponse as RuleListResponse,
    type RuleDeleteResponse as RuleDeleteResponse,
    type RuleBulkCreateResponse as RuleBulkCreateResponse,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
    type RuleDeleteParams as RuleDeleteParams,
    type RuleBulkCreateParams as RuleBulkCreateParams,
  };
}
