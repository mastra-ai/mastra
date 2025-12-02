// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class Recipients extends APIResource {
  /**
   * Create a new share recipient
   *
   * @example
   * ```ts
   * const recipient =
   *   await client.resourceSharing.recipients.create(
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     { path_account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  create(
    shareId: string,
    params: RecipientCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RecipientCreateResponse> {
    const { path_account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${path_account_id}/shares/${shareId}/recipients`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RecipientCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List share recipients by share ID.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const recipientListResponse of client.resourceSharing.recipients.list(
   *   '3fd85f74b32742f1bff64a85009dda07',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    shareId: string,
    params: RecipientListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RecipientListResponsesV4PagePaginationArray, RecipientListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/shares/${shareId}/recipients`,
      RecipientListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletion is not immediate, an updated share recipient object with a new status
   * will be returned.
   *
   * @example
   * ```ts
   * const recipient =
   *   await client.resourceSharing.recipients.delete(
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    shareId: string,
    recipientId: string,
    params: RecipientDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RecipientDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/shares/${shareId}/recipients/${recipientId}`,
        options,
      ) as Core.APIPromise<{ result: RecipientDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get share recipient by ID.
   *
   * @example
   * ```ts
   * const recipient =
   *   await client.resourceSharing.recipients.get(
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    shareId: string,
    recipientId: string,
    params: RecipientGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RecipientGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/shares/${shareId}/recipients/${recipientId}`,
        options,
      ) as Core.APIPromise<{ result: RecipientGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class RecipientListResponsesV4PagePaginationArray extends V4PagePaginationArray<RecipientListResponse> {}

export interface RecipientCreateResponse {
  /**
   * Share Recipient identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * Share Recipient association status.
   */
  association_status: 'associating' | 'associated' | 'disassociating' | 'disassociated';

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Share Recipient status message.
   */
  status_message: string;
}

export interface RecipientListResponse {
  /**
   * Share Recipient identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * Share Recipient association status.
   */
  association_status: 'associating' | 'associated' | 'disassociating' | 'disassociated';

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Share Recipient status message.
   */
  status_message: string;
}

export interface RecipientDeleteResponse {
  /**
   * Share Recipient identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * Share Recipient association status.
   */
  association_status: 'associating' | 'associated' | 'disassociating' | 'disassociated';

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Share Recipient status message.
   */
  status_message: string;
}

export interface RecipientGetResponse {
  /**
   * Share Recipient identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * Share Recipient association status.
   */
  association_status: 'associating' | 'associated' | 'disassociating' | 'disassociated';

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Share Recipient status message.
   */
  status_message: string;
}

export interface RecipientCreateParams {
  /**
   * Path param: Account identifier.
   */
  path_account_id: string;

  /**
   * Body param: Account identifier.
   */
  body_account_id?: string;

  /**
   * Body param: Organization identifier.
   */
  organization_id?: string;
}

export interface RecipientListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account identifier.
   */
  account_id: string;
}

export interface RecipientDeleteParams {
  /**
   * Account identifier.
   */
  account_id: string;
}

export interface RecipientGetParams {
  /**
   * Account identifier.
   */
  account_id: string;
}

Recipients.RecipientListResponsesV4PagePaginationArray = RecipientListResponsesV4PagePaginationArray;

export declare namespace Recipients {
  export {
    type RecipientCreateResponse as RecipientCreateResponse,
    type RecipientListResponse as RecipientListResponse,
    type RecipientDeleteResponse as RecipientDeleteResponse,
    type RecipientGetResponse as RecipientGetResponse,
    RecipientListResponsesV4PagePaginationArray as RecipientListResponsesV4PagePaginationArray,
    type RecipientCreateParams as RecipientCreateParams,
    type RecipientListParams as RecipientListParams,
    type RecipientDeleteParams as RecipientDeleteParams,
    type RecipientGetParams as RecipientGetParams,
  };
}
