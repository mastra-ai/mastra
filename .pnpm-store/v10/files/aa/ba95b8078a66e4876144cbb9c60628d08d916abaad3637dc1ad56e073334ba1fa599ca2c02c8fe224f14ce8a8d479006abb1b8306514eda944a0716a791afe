// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class AccountMapping extends APIResource {
  /**
   * Create mapping
   *
   * @example
   * ```ts
   * const accountMapping =
   *   await client.zeroTrust.dlp.email.accountMapping.create({
   *     account_id: 'account_id',
   *     auth_requirements: {
   *       allowed_microsoft_organizations: ['string'],
   *       type: 'Org',
   *     },
   *   });
   * ```
   */
  create(
    params: AccountMappingCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AccountMappingCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/dlp/email/account_mapping`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: AccountMappingCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get mapping
   *
   * @example
   * ```ts
   * const accountMapping =
   *   await client.zeroTrust.dlp.email.accountMapping.get({
   *     account_id: 'account_id',
   *   });
   * ```
   */
  get(
    params: AccountMappingGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AccountMappingGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/dlp/email/account_mapping`, options) as Core.APIPromise<{
        result: AccountMappingGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface AccountMappingCreateResponse {
  addin_identifier_token: string;

  auth_requirements: AccountMappingCreateResponse.UnionMember0 | AccountMappingCreateResponse.Type;
}

export namespace AccountMappingCreateResponse {
  export interface UnionMember0 {
    allowed_microsoft_organizations: Array<string>;

    type: 'Org';
  }

  export interface Type {
    type: 'NoAuth';
  }
}

export interface AccountMappingGetResponse {
  addin_identifier_token: string;

  auth_requirements: AccountMappingGetResponse.UnionMember0 | AccountMappingGetResponse.Type;
}

export namespace AccountMappingGetResponse {
  export interface UnionMember0 {
    allowed_microsoft_organizations: Array<string>;

    type: 'Org';
  }

  export interface Type {
    type: 'NoAuth';
  }
}

export interface AccountMappingCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  auth_requirements: AccountMappingCreateParams.UnionMember0 | AccountMappingCreateParams.Type;
}

export namespace AccountMappingCreateParams {
  export interface UnionMember0 {
    allowed_microsoft_organizations: Array<string>;

    type: 'Org';
  }

  export interface Type {
    type: 'NoAuth';
  }
}

export interface AccountMappingGetParams {
  account_id: string;
}

export declare namespace AccountMapping {
  export {
    type AccountMappingCreateResponse as AccountMappingCreateResponse,
    type AccountMappingGetResponse as AccountMappingGetResponse,
    type AccountMappingCreateParams as AccountMappingCreateParams,
    type AccountMappingGetParams as AccountMappingGetParams,
  };
}
