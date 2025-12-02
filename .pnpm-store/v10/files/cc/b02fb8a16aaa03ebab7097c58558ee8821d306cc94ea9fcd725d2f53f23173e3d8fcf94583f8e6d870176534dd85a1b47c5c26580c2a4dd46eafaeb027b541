// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as AccessRulesAPI from './access-rules';
import {
  ASNConfiguration,
  AccessRuleCIDRConfiguration,
  AccessRuleCreateParams,
  AccessRuleCreateResponse,
  AccessRuleDeleteParams,
  AccessRuleDeleteResponse,
  AccessRuleEditParams,
  AccessRuleEditResponse,
  AccessRuleGetParams,
  AccessRuleGetResponse,
  AccessRuleIPConfiguration,
  AccessRuleListParams,
  AccessRuleListResponse,
  AccessRuleListResponsesV4PagePaginationArray,
  AccessRules,
  CountryConfiguration,
  IPV6Configuration,
} from './access-rules';
import * as LockdownsAPI from './lockdowns';
import {
  Configuration,
  Lockdown,
  LockdownCIDRConfiguration,
  LockdownCreateParams,
  LockdownDeleteParams,
  LockdownDeleteResponse,
  LockdownGetParams,
  LockdownIPConfiguration,
  LockdownListParams,
  LockdownURL,
  LockdownUpdateParams,
  Lockdowns,
  LockdownsV4PagePaginationArray,
} from './lockdowns';
import * as RulesAPI from './rules';
import {
  DeletedFilter,
  FirewallRule,
  FirewallRulesSinglePage,
  FirewallRulesV4PagePaginationArray,
  Product,
  RuleBulkDeleteParams,
  RuleBulkEditParams,
  RuleBulkUpdateParams,
  RuleCreateParams,
  RuleDeleteParams,
  RuleEditParams,
  RuleGetParams,
  RuleListParams,
  RuleUpdateParams,
  Rules,
} from './rules';
import * as UARulesAPI from './ua-rules';
import {
  UARuleCreateParams,
  UARuleCreateResponse,
  UARuleDeleteParams,
  UARuleDeleteResponse,
  UARuleGetParams,
  UARuleGetResponse,
  UARuleListParams,
  UARuleListResponse,
  UARuleListResponsesV4PagePaginationArray,
  UARuleUpdateParams,
  UARuleUpdateResponse,
  UARules,
} from './ua-rules';
import * as WAFAPI from './waf/waf';
import { WAF } from './waf/waf';

export class Firewall extends APIResource {
  lockdowns: LockdownsAPI.Lockdowns = new LockdownsAPI.Lockdowns(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);
  accessRules: AccessRulesAPI.AccessRules = new AccessRulesAPI.AccessRules(this._client);
  uaRules: UARulesAPI.UARules = new UARulesAPI.UARules(this._client);
  waf: WAFAPI.WAF = new WAFAPI.WAF(this._client);
}

Firewall.Lockdowns = Lockdowns;
Firewall.LockdownsV4PagePaginationArray = LockdownsV4PagePaginationArray;
Firewall.Rules = Rules;
Firewall.FirewallRulesSinglePage = FirewallRulesSinglePage;
Firewall.FirewallRulesV4PagePaginationArray = FirewallRulesV4PagePaginationArray;
Firewall.AccessRules = AccessRules;
Firewall.AccessRuleListResponsesV4PagePaginationArray = AccessRuleListResponsesV4PagePaginationArray;
Firewall.UARules = UARules;
Firewall.UARuleListResponsesV4PagePaginationArray = UARuleListResponsesV4PagePaginationArray;
Firewall.WAF = WAF;

export declare namespace Firewall {
  export {
    Lockdowns as Lockdowns,
    type Configuration as Configuration,
    type Lockdown as Lockdown,
    type LockdownCIDRConfiguration as LockdownCIDRConfiguration,
    type LockdownIPConfiguration as LockdownIPConfiguration,
    type LockdownURL as LockdownURL,
    type LockdownDeleteResponse as LockdownDeleteResponse,
    LockdownsV4PagePaginationArray as LockdownsV4PagePaginationArray,
    type LockdownCreateParams as LockdownCreateParams,
    type LockdownUpdateParams as LockdownUpdateParams,
    type LockdownListParams as LockdownListParams,
    type LockdownDeleteParams as LockdownDeleteParams,
    type LockdownGetParams as LockdownGetParams,
  };

  export {
    Rules as Rules,
    type DeletedFilter as DeletedFilter,
    type FirewallRule as FirewallRule,
    type Product as Product,
    FirewallRulesSinglePage as FirewallRulesSinglePage,
    FirewallRulesV4PagePaginationArray as FirewallRulesV4PagePaginationArray,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
    type RuleDeleteParams as RuleDeleteParams,
    type RuleBulkDeleteParams as RuleBulkDeleteParams,
    type RuleBulkEditParams as RuleBulkEditParams,
    type RuleBulkUpdateParams as RuleBulkUpdateParams,
    type RuleEditParams as RuleEditParams,
    type RuleGetParams as RuleGetParams,
  };

  export {
    AccessRules as AccessRules,
    type AccessRuleCIDRConfiguration as AccessRuleCIDRConfiguration,
    type AccessRuleIPConfiguration as AccessRuleIPConfiguration,
    type ASNConfiguration as ASNConfiguration,
    type CountryConfiguration as CountryConfiguration,
    type IPV6Configuration as IPV6Configuration,
    type AccessRuleCreateResponse as AccessRuleCreateResponse,
    type AccessRuleListResponse as AccessRuleListResponse,
    type AccessRuleDeleteResponse as AccessRuleDeleteResponse,
    type AccessRuleEditResponse as AccessRuleEditResponse,
    type AccessRuleGetResponse as AccessRuleGetResponse,
    AccessRuleListResponsesV4PagePaginationArray as AccessRuleListResponsesV4PagePaginationArray,
    type AccessRuleCreateParams as AccessRuleCreateParams,
    type AccessRuleListParams as AccessRuleListParams,
    type AccessRuleDeleteParams as AccessRuleDeleteParams,
    type AccessRuleEditParams as AccessRuleEditParams,
    type AccessRuleGetParams as AccessRuleGetParams,
  };

  export {
    UARules as UARules,
    type UARuleCreateResponse as UARuleCreateResponse,
    type UARuleUpdateResponse as UARuleUpdateResponse,
    type UARuleListResponse as UARuleListResponse,
    type UARuleDeleteResponse as UARuleDeleteResponse,
    type UARuleGetResponse as UARuleGetResponse,
    UARuleListResponsesV4PagePaginationArray as UARuleListResponsesV4PagePaginationArray,
    type UARuleCreateParams as UARuleCreateParams,
    type UARuleUpdateParams as UARuleUpdateParams,
    type UARuleListParams as UARuleListParams,
    type UARuleDeleteParams as UARuleDeleteParams,
    type UARuleGetParams as UARuleGetParams,
  };

  export { WAF as WAF };
}
