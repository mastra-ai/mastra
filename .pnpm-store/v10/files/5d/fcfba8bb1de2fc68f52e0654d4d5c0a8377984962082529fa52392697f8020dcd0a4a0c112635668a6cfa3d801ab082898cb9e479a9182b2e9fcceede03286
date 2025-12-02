// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class BlockSenders extends APIResource {
  /**
   * Create a blocked email sender
   *
   * @example
   * ```ts
   * const blockSender =
   *   await client.emailSecurity.settings.blockSenders.create({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     is_regex: false,
   *     pattern: 'test@example.com',
   *     pattern_type: 'EMAIL',
   *   });
   * ```
   */
  create(
    params: BlockSenderCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BlockSenderCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/email-security/settings/block_senders`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: BlockSenderCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List blocked email senders
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const blockSenderListResponse of client.emailSecurity.settings.blockSenders.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: BlockSenderListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<BlockSenderListResponsesV4PagePaginationArray, BlockSenderListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/email-security/settings/block_senders`,
      BlockSenderListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Delete a blocked email sender
   *
   * @example
   * ```ts
   * const blockSender =
   *   await client.emailSecurity.settings.blockSenders.delete(
   *     2402,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    patternId: number,
    params: BlockSenderDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BlockSenderDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/email-security/settings/block_senders/${patternId}`,
        options,
      ) as Core.APIPromise<{ result: BlockSenderDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a blocked email sender
   *
   * @example
   * ```ts
   * const response =
   *   await client.emailSecurity.settings.blockSenders.edit(
   *     2402,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  edit(
    patternId: number,
    params: BlockSenderEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BlockSenderEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/email-security/settings/block_senders/${patternId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: BlockSenderEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a blocked email sender
   *
   * @example
   * ```ts
   * const blockSender =
   *   await client.emailSecurity.settings.blockSenders.get(
   *     2402,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    patternId: number,
    params: BlockSenderGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BlockSenderGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/email-security/settings/block_senders/${patternId}`,
        options,
      ) as Core.APIPromise<{ result: BlockSenderGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class BlockSenderListResponsesV4PagePaginationArray extends V4PagePaginationArray<BlockSenderListResponse> {}

export interface BlockSenderCreateResponse {
  /**
   * The unique identifier for the allow policy.
   */
  id: number;

  created_at: string;

  is_regex: boolean;

  last_modified: string;

  pattern: string;

  pattern_type: 'EMAIL' | 'DOMAIN' | 'IP' | 'UNKNOWN';

  comments?: string | null;
}

export interface BlockSenderListResponse {
  /**
   * The unique identifier for the allow policy.
   */
  id: number;

  created_at: string;

  is_regex: boolean;

  last_modified: string;

  pattern: string;

  pattern_type: 'EMAIL' | 'DOMAIN' | 'IP' | 'UNKNOWN';

  comments?: string | null;
}

export interface BlockSenderDeleteResponse {
  /**
   * The unique identifier for the allow policy.
   */
  id: number;
}

export interface BlockSenderEditResponse {
  /**
   * The unique identifier for the allow policy.
   */
  id: number;

  created_at: string;

  is_regex: boolean;

  last_modified: string;

  pattern: string;

  pattern_type: 'EMAIL' | 'DOMAIN' | 'IP' | 'UNKNOWN';

  comments?: string | null;
}

export interface BlockSenderGetResponse {
  /**
   * The unique identifier for the allow policy.
   */
  id: number;

  created_at: string;

  is_regex: boolean;

  last_modified: string;

  pattern: string;

  pattern_type: 'EMAIL' | 'DOMAIN' | 'IP' | 'UNKNOWN';

  comments?: string | null;
}

export interface BlockSenderCreateParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  is_regex: boolean;

  /**
   * Body param:
   */
  pattern: string;

  /**
   * Body param:
   */
  pattern_type: 'EMAIL' | 'DOMAIN' | 'IP' | 'UNKNOWN';

  /**
   * Body param:
   */
  comments?: string | null;
}

export interface BlockSenderListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Query param: The sorting direction.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: The field to sort by.
   */
  order?: 'pattern' | 'created_at';

  /**
   * Query param:
   */
  pattern_type?: 'EMAIL' | 'DOMAIN' | 'IP' | 'UNKNOWN';

  /**
   * Query param: Allows searching in multiple properties of a record simultaneously.
   * This parameter is intended for human users, not automation. Its exact behavior
   * is intentionally left unspecified and is subject to change in the future.
   */
  search?: string;
}

export interface BlockSenderDeleteParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

export interface BlockSenderEditParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  comments?: string | null;

  /**
   * Body param:
   */
  is_regex?: boolean | null;

  /**
   * Body param:
   */
  pattern?: string | null;

  /**
   * Body param:
   */
  pattern_type?: 'EMAIL' | 'DOMAIN' | 'IP' | 'UNKNOWN' | null;
}

export interface BlockSenderGetParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

BlockSenders.BlockSenderListResponsesV4PagePaginationArray = BlockSenderListResponsesV4PagePaginationArray;

export declare namespace BlockSenders {
  export {
    type BlockSenderCreateResponse as BlockSenderCreateResponse,
    type BlockSenderListResponse as BlockSenderListResponse,
    type BlockSenderDeleteResponse as BlockSenderDeleteResponse,
    type BlockSenderEditResponse as BlockSenderEditResponse,
    type BlockSenderGetResponse as BlockSenderGetResponse,
    BlockSenderListResponsesV4PagePaginationArray as BlockSenderListResponsesV4PagePaginationArray,
    type BlockSenderCreateParams as BlockSenderCreateParams,
    type BlockSenderListParams as BlockSenderListParams,
    type BlockSenderDeleteParams as BlockSenderDeleteParams,
    type BlockSenderEditParams as BlockSenderEditParams,
    type BlockSenderGetParams as BlockSenderGetParams,
  };
}
