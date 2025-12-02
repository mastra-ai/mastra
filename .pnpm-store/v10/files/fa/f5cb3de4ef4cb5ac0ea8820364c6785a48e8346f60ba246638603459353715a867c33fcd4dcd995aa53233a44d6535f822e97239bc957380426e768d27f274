// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class TrustedDomains extends APIResource {
  /**
   * Create a trusted email domain
   *
   * @example
   * ```ts
   * const trustedDomain =
   *   await client.emailSecurity.settings.trustedDomains.create(
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       is_recent: true,
   *       is_regex: false,
   *       is_similarity: false,
   *       pattern: 'example.com',
   *     },
   *   );
   * ```
   */
  create(
    params: TrustedDomainCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TrustedDomainCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/email-security/settings/trusted_domains`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: TrustedDomainCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists, searches, and sorts an account’s trusted email domains.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const trustedDomainListResponse of client.emailSecurity.settings.trustedDomains.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: TrustedDomainListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TrustedDomainListResponsesV4PagePaginationArray, TrustedDomainListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/email-security/settings/trusted_domains`,
      TrustedDomainListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Delete a trusted email domain
   *
   * @example
   * ```ts
   * const trustedDomain =
   *   await client.emailSecurity.settings.trustedDomains.delete(
   *     2401,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    trustedDomainId: number,
    params: TrustedDomainDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TrustedDomainDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/email-security/settings/trusted_domains/${trustedDomainId}`,
        options,
      ) as Core.APIPromise<{ result: TrustedDomainDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a trusted email domain
   *
   * @example
   * ```ts
   * const response =
   *   await client.emailSecurity.settings.trustedDomains.edit(
   *     2401,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  edit(
    trustedDomainId: number,
    params: TrustedDomainEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TrustedDomainEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(
        `/accounts/${account_id}/email-security/settings/trusted_domains/${trustedDomainId}`,
        { body, ...options },
      ) as Core.APIPromise<{ result: TrustedDomainEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a trusted email domain
   *
   * @example
   * ```ts
   * const trustedDomain =
   *   await client.emailSecurity.settings.trustedDomains.get(
   *     2401,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    trustedDomainId: number,
    params: TrustedDomainGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TrustedDomainGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/email-security/settings/trusted_domains/${trustedDomainId}`,
        options,
      ) as Core.APIPromise<{ result: TrustedDomainGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class TrustedDomainListResponsesV4PagePaginationArray extends V4PagePaginationArray<TrustedDomainListResponse> {}

export type TrustedDomainCreateResponse =
  | TrustedDomainCreateResponse.EmailSecurityTrustedDomain
  | Array<TrustedDomainCreateResponse.UnionMember1>;

export namespace TrustedDomainCreateResponse {
  export interface EmailSecurityTrustedDomain {
    /**
     * The unique identifier for the trusted domain.
     */
    id: number;

    created_at: string;

    /**
     * Select to prevent recently registered domains from triggering a Suspicious or
     * Malicious disposition.
     */
    is_recent: boolean;

    is_regex: boolean;

    /**
     * Select for partner or other approved domains that have similar spelling to your
     * connected domains. Prevents listed domains from triggering a Spoof disposition.
     */
    is_similarity: boolean;

    last_modified: string;

    pattern: string;

    comments?: string | null;
  }

  export interface UnionMember1 {
    /**
     * The unique identifier for the trusted domain.
     */
    id: number;

    created_at: string;

    /**
     * Select to prevent recently registered domains from triggering a Suspicious or
     * Malicious disposition.
     */
    is_recent: boolean;

    is_regex: boolean;

    /**
     * Select for partner or other approved domains that have similar spelling to your
     * connected domains. Prevents listed domains from triggering a Spoof disposition.
     */
    is_similarity: boolean;

    last_modified: string;

    pattern: string;

    comments?: string | null;
  }
}

export interface TrustedDomainListResponse {
  /**
   * The unique identifier for the trusted domain.
   */
  id: number;

  created_at: string;

  /**
   * Select to prevent recently registered domains from triggering a Suspicious or
   * Malicious disposition.
   */
  is_recent: boolean;

  is_regex: boolean;

  /**
   * Select for partner or other approved domains that have similar spelling to your
   * connected domains. Prevents listed domains from triggering a Spoof disposition.
   */
  is_similarity: boolean;

  last_modified: string;

  pattern: string;

  comments?: string | null;
}

export interface TrustedDomainDeleteResponse {
  /**
   * The unique identifier for the trusted domain.
   */
  id: number;
}

export interface TrustedDomainEditResponse {
  /**
   * The unique identifier for the trusted domain.
   */
  id: number;

  created_at: string;

  /**
   * Select to prevent recently registered domains from triggering a Suspicious or
   * Malicious disposition.
   */
  is_recent: boolean;

  is_regex: boolean;

  /**
   * Select for partner or other approved domains that have similar spelling to your
   * connected domains. Prevents listed domains from triggering a Spoof disposition.
   */
  is_similarity: boolean;

  last_modified: string;

  pattern: string;

  comments?: string | null;
}

export interface TrustedDomainGetResponse {
  /**
   * The unique identifier for the trusted domain.
   */
  id: number;

  created_at: string;

  /**
   * Select to prevent recently registered domains from triggering a Suspicious or
   * Malicious disposition.
   */
  is_recent: boolean;

  is_regex: boolean;

  /**
   * Select for partner or other approved domains that have similar spelling to your
   * connected domains. Prevents listed domains from triggering a Spoof disposition.
   */
  is_similarity: boolean;

  last_modified: string;

  pattern: string;

  comments?: string | null;
}

export type TrustedDomainCreateParams =
  | TrustedDomainCreateParams.EmailSecurityCreateTrustedDomain
  | TrustedDomainCreateParams.Variant1;

export declare namespace TrustedDomainCreateParams {
  export interface EmailSecurityCreateTrustedDomain {
    /**
     * Path param: Account Identifier
     */
    account_id: string;

    /**
     * Body param: Select to prevent recently registered domains from triggering a
     * Suspicious or Malicious disposition.
     */
    is_recent: boolean;

    /**
     * Body param:
     */
    is_regex: boolean;

    /**
     * Body param: Select for partner or other approved domains that have similar
     * spelling to your connected domains. Prevents listed domains from triggering a
     * Spoof disposition.
     */
    is_similarity: boolean;

    /**
     * Body param:
     */
    pattern: string;

    /**
     * Body param:
     */
    comments?: string | null;
  }

  export interface Variant1 {
    /**
     * Path param: Account Identifier
     */
    account_id: string;

    /**
     * Body param:
     */
    body: Array<Variant1.Body>;
  }

  export namespace Variant1 {
    export interface Body {
      /**
       * Select to prevent recently registered domains from triggering a Suspicious or
       * Malicious disposition.
       */
      is_recent: boolean;

      is_regex: boolean;

      /**
       * Select for partner or other approved domains that have similar spelling to your
       * connected domains. Prevents listed domains from triggering a Spoof disposition.
       */
      is_similarity: boolean;

      pattern: string;

      comments?: string | null;
    }
  }
}

export interface TrustedDomainListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Query param: The sorting direction.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param:
   */
  is_recent?: boolean;

  /**
   * Query param:
   */
  is_similarity?: boolean;

  /**
   * Query param: The field to sort by.
   */
  order?: 'pattern' | 'created_at';

  /**
   * Query param: Allows searching in multiple properties of a record simultaneously.
   * This parameter is intended for human users, not automation. Its exact behavior
   * is intentionally left unspecified and is subject to change in the future.
   */
  search?: string;
}

export interface TrustedDomainDeleteParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

export interface TrustedDomainEditParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  comments?: string;

  /**
   * Body param: Select to prevent recently registered domains from triggering a
   * Suspicious or Malicious disposition.
   */
  is_recent?: boolean;

  /**
   * Body param:
   */
  is_regex?: boolean;

  /**
   * Body param: Select for partner or other approved domains that have similar
   * spelling to your connected domains. Prevents listed domains from triggering a
   * Spoof disposition.
   */
  is_similarity?: boolean;

  /**
   * Body param:
   */
  pattern?: string;
}

export interface TrustedDomainGetParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

TrustedDomains.TrustedDomainListResponsesV4PagePaginationArray =
  TrustedDomainListResponsesV4PagePaginationArray;

export declare namespace TrustedDomains {
  export {
    type TrustedDomainCreateResponse as TrustedDomainCreateResponse,
    type TrustedDomainListResponse as TrustedDomainListResponse,
    type TrustedDomainDeleteResponse as TrustedDomainDeleteResponse,
    type TrustedDomainEditResponse as TrustedDomainEditResponse,
    type TrustedDomainGetResponse as TrustedDomainGetResponse,
    TrustedDomainListResponsesV4PagePaginationArray as TrustedDomainListResponsesV4PagePaginationArray,
    type TrustedDomainCreateParams as TrustedDomainCreateParams,
    type TrustedDomainListParams as TrustedDomainListParams,
    type TrustedDomainDeleteParams as TrustedDomainDeleteParams,
    type TrustedDomainEditParams as TrustedDomainEditParams,
    type TrustedDomainGetParams as TrustedDomainGetParams,
  };
}
