// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as AccountMappingAPI from './account-mapping';
import {
  AccountMapping,
  AccountMappingCreateParams,
  AccountMappingCreateResponse,
  AccountMappingGetParams,
  AccountMappingGetResponse,
} from './account-mapping';
import * as RulesAPI from './rules';
import {
  RuleBulkEditParams,
  RuleBulkEditResponse,
  RuleCreateParams,
  RuleCreateResponse,
  RuleDeleteParams,
  RuleDeleteResponse,
  RuleGetParams,
  RuleGetResponse,
  RuleListParams,
  RuleListResponse,
  RuleListResponsesSinglePage,
  RuleUpdateParams,
  RuleUpdateResponse,
  Rules,
} from './rules';

export class Email extends APIResource {
  accountMapping: AccountMappingAPI.AccountMapping = new AccountMappingAPI.AccountMapping(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);
}

Email.AccountMapping = AccountMapping;
Email.Rules = Rules;
Email.RuleListResponsesSinglePage = RuleListResponsesSinglePage;

export declare namespace Email {
  export {
    AccountMapping as AccountMapping,
    type AccountMappingCreateResponse as AccountMappingCreateResponse,
    type AccountMappingGetResponse as AccountMappingGetResponse,
    type AccountMappingCreateParams as AccountMappingCreateParams,
    type AccountMappingGetParams as AccountMappingGetParams,
  };

  export {
    Rules as Rules,
    type RuleCreateResponse as RuleCreateResponse,
    type RuleUpdateResponse as RuleUpdateResponse,
    type RuleListResponse as RuleListResponse,
    type RuleDeleteResponse as RuleDeleteResponse,
    type RuleBulkEditResponse as RuleBulkEditResponse,
    type RuleGetResponse as RuleGetResponse,
    RuleListResponsesSinglePage as RuleListResponsesSinglePage,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
    type RuleDeleteParams as RuleDeleteParams,
    type RuleBulkEditParams as RuleBulkEditParams,
    type RuleGetParams as RuleGetParams,
  };
}
