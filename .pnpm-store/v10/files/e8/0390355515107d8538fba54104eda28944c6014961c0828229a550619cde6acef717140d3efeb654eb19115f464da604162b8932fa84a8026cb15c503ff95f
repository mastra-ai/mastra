// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import { SinglePage } from '../../../../pagination';

export class Rules extends APIResource {
  /**
   * Create email scanner rule
   *
   * @example
   * ```ts
   * const rule = await client.zeroTrust.dlp.email.rules.create({
   *   account_id: 'account_id',
   *   action: { action: 'Block' },
   *   conditions: [
   *     {
   *       operator: 'InList',
   *       selector: 'Recipients',
   *       value: ['string'],
   *     },
   *   ],
   *   enabled: true,
   *   name: 'name',
   * });
   * ```
   */
  create(params: RuleCreateParams, options?: Core.RequestOptions): Core.APIPromise<RuleCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/dlp/email/rules`, { body, ...options }) as Core.APIPromise<{
        result: RuleCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update email scanner rule
   *
   * @example
   * ```ts
   * const rule = await client.zeroTrust.dlp.email.rules.update(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   {
   *     account_id: 'account_id',
   *     action: { action: 'Block' },
   *     conditions: [
   *       {
   *         operator: 'InList',
   *         selector: 'Recipients',
   *         value: ['string'],
   *       },
   *     ],
   *     enabled: true,
   *     name: 'name',
   *   },
   * );
   * ```
   */
  update(
    ruleId: string,
    params: RuleUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RuleUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/dlp/email/rules/${ruleId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RuleUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists all email scanner rules for an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const ruleListResponse of client.zeroTrust.dlp.email.rules.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: RuleListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RuleListResponsesSinglePage, RuleListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/dlp/email/rules`,
      RuleListResponsesSinglePage,
      options,
    );
  }

  /**
   * Delete email scanner rule
   *
   * @example
   * ```ts
   * const rule = await client.zeroTrust.dlp.email.rules.delete(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  delete(
    ruleId: string,
    params: RuleDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RuleDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/dlp/email/rules/${ruleId}`, options) as Core.APIPromise<{
        result: RuleDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update email scanner rule priorities
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.dlp.email.rules.bulkEdit({
   *     account_id: 'account_id',
   *     new_priorities: { foo: 0 },
   *   });
   * ```
   */
  bulkEdit(params: RuleBulkEditParams, options?: Core.RequestOptions): Core.APIPromise<RuleBulkEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/dlp/email/rules`, { body, ...options }) as Core.APIPromise<{
        result: RuleBulkEditResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get an email scanner rule
   *
   * @example
   * ```ts
   * const rule = await client.zeroTrust.dlp.email.rules.get(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    ruleId: string,
    params: RuleGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RuleGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/dlp/email/rules/${ruleId}`, options) as Core.APIPromise<{
        result: RuleGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class RuleListResponsesSinglePage extends SinglePage<RuleListResponse> {}

export interface RuleCreateResponse {
  action: RuleCreateResponse.Action;

  /**
   * Rule is triggered if all conditions match.
   */
  conditions: Array<RuleCreateResponse.Condition>;

  created_at: string;

  enabled: boolean;

  name: string;

  priority: number;

  rule_id: string;

  updated_at: string;

  description?: string | null;
}

export namespace RuleCreateResponse {
  export interface Action {
    action: 'Block';

    message?: string | null;
  }

  export interface Condition {
    operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';

    selector: 'Recipients' | 'Sender' | 'DLPProfiles';

    value: Array<string> | string;
  }
}

export interface RuleUpdateResponse {
  action: RuleUpdateResponse.Action;

  /**
   * Rule is triggered if all conditions match.
   */
  conditions: Array<RuleUpdateResponse.Condition>;

  created_at: string;

  enabled: boolean;

  name: string;

  priority: number;

  rule_id: string;

  updated_at: string;

  description?: string | null;
}

export namespace RuleUpdateResponse {
  export interface Action {
    action: 'Block';

    message?: string | null;
  }

  export interface Condition {
    operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';

    selector: 'Recipients' | 'Sender' | 'DLPProfiles';

    value: Array<string> | string;
  }
}

export interface RuleListResponse {
  action: RuleListResponse.Action;

  /**
   * Rule is triggered if all conditions match.
   */
  conditions: Array<RuleListResponse.Condition>;

  created_at: string;

  enabled: boolean;

  name: string;

  priority: number;

  rule_id: string;

  updated_at: string;

  description?: string | null;
}

export namespace RuleListResponse {
  export interface Action {
    action: 'Block';

    message?: string | null;
  }

  export interface Condition {
    operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';

    selector: 'Recipients' | 'Sender' | 'DLPProfiles';

    value: Array<string> | string;
  }
}

export interface RuleDeleteResponse {
  action: RuleDeleteResponse.Action;

  /**
   * Rule is triggered if all conditions match.
   */
  conditions: Array<RuleDeleteResponse.Condition>;

  created_at: string;

  enabled: boolean;

  name: string;

  priority: number;

  rule_id: string;

  updated_at: string;

  description?: string | null;
}

export namespace RuleDeleteResponse {
  export interface Action {
    action: 'Block';

    message?: string | null;
  }

  export interface Condition {
    operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';

    selector: 'Recipients' | 'Sender' | 'DLPProfiles';

    value: Array<string> | string;
  }
}

export interface RuleBulkEditResponse {
  action: RuleBulkEditResponse.Action;

  /**
   * Rule is triggered if all conditions match.
   */
  conditions: Array<RuleBulkEditResponse.Condition>;

  created_at: string;

  enabled: boolean;

  name: string;

  priority: number;

  rule_id: string;

  updated_at: string;

  description?: string | null;
}

export namespace RuleBulkEditResponse {
  export interface Action {
    action: 'Block';

    message?: string | null;
  }

  export interface Condition {
    operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';

    selector: 'Recipients' | 'Sender' | 'DLPProfiles';

    value: Array<string> | string;
  }
}

export interface RuleGetResponse {
  action: RuleGetResponse.Action;

  /**
   * Rule is triggered if all conditions match.
   */
  conditions: Array<RuleGetResponse.Condition>;

  created_at: string;

  enabled: boolean;

  name: string;

  priority: number;

  rule_id: string;

  updated_at: string;

  description?: string | null;
}

export namespace RuleGetResponse {
  export interface Action {
    action: 'Block';

    message?: string | null;
  }

  export interface Condition {
    operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';

    selector: 'Recipients' | 'Sender' | 'DLPProfiles';

    value: Array<string> | string;
  }
}

export interface RuleCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  action: RuleCreateParams.Action;

  /**
   * Body param: Rule is triggered if all conditions match.
   */
  conditions: Array<RuleCreateParams.Condition>;

  /**
   * Body param:
   */
  enabled: boolean;

  /**
   * Body param:
   */
  name: string;

  /**
   * Body param:
   */
  description?: string | null;
}

export namespace RuleCreateParams {
  export interface Action {
    action: 'Block';

    message?: string | null;
  }

  export interface Condition {
    operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';

    selector: 'Recipients' | 'Sender' | 'DLPProfiles';

    value: Array<string> | string;
  }
}

export interface RuleUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  action: RuleUpdateParams.Action;

  /**
   * Body param: Rule is triggered if all conditions match.
   */
  conditions: Array<RuleUpdateParams.Condition>;

  /**
   * Body param:
   */
  enabled: boolean;

  /**
   * Body param:
   */
  name: string;

  /**
   * Body param:
   */
  description?: string | null;
}

export namespace RuleUpdateParams {
  export interface Action {
    action: 'Block';

    message?: string | null;
  }

  export interface Condition {
    operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';

    selector: 'Recipients' | 'Sender' | 'DLPProfiles';

    value: Array<string> | string;
  }
}

export interface RuleListParams {
  account_id: string;
}

export interface RuleDeleteParams {
  account_id: string;
}

export interface RuleBulkEditParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  new_priorities: { [key: string]: number };
}

export interface RuleGetParams {
  account_id: string;
}

Rules.RuleListResponsesSinglePage = RuleListResponsesSinglePage;

export declare namespace Rules {
  export {
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
