// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class TURN extends APIResource {
  /**
   * Creates a new Cloudflare Calls TURN key.
   *
   * @example
   * ```ts
   * const turn = await client.calls.turn.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  create(params: TURNCreateParams, options?: Core.RequestOptions): Core.APIPromise<TURNCreateResponse> {
    const { account_id, ...body } = params;
    return this._client.post(`/accounts/${account_id}/calls/turn_keys`, { body, ...options });
  }

  /**
   * Edit details for a single TURN key.
   *
   * @example
   * ```ts
   * const turn = await client.calls.turn.update(
   *   '2a95132c15732412d22c1476fa83f27a',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    keyId: string,
    params: TURNUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TURNUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/calls/turn_keys/${keyId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: TURNUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists all TURN keys in the Cloudflare account
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const turnListResponse of client.calls.turn.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: TURNListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TURNListResponsesSinglePage, TURNListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/calls/turn_keys`,
      TURNListResponsesSinglePage,
      options,
    );
  }

  /**
   * Deletes a TURN key from Cloudflare Calls
   *
   * @example
   * ```ts
   * const turn = await client.calls.turn.delete(
   *   '2a95132c15732412d22c1476fa83f27a',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    keyId: string,
    params: TURNDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TURNDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/calls/turn_keys/${keyId}`, options) as Core.APIPromise<{
        result: TURNDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches details for a single TURN key.
   *
   * @example
   * ```ts
   * const turn = await client.calls.turn.get(
   *   '2a95132c15732412d22c1476fa83f27a',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(keyId: string, params: TURNGetParams, options?: Core.RequestOptions): Core.APIPromise<TURNGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/calls/turn_keys/${keyId}`, options) as Core.APIPromise<{
        result: TURNGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class TURNListResponsesSinglePage extends SinglePage<TURNListResponse> {}

export interface TURNCreateResponse {
  /**
   * The date and time the item was created.
   */
  created?: string;

  /**
   * Bearer token
   */
  key?: string;

  /**
   * The date and time the item was last modified.
   */
  modified?: string;

  /**
   * A short description of a TURN key, not shown to end users.
   */
  name?: string;

  /**
   * A Cloudflare-generated unique identifier for a item.
   */
  uid?: string;
}

export interface TURNUpdateResponse {
  /**
   * The date and time the item was created.
   */
  created?: string;

  /**
   * The date and time the item was last modified.
   */
  modified?: string;

  /**
   * A short description of Calls app, not shown to end users.
   */
  name?: string;

  /**
   * A Cloudflare-generated unique identifier for a item.
   */
  uid?: string;
}

export interface TURNListResponse {
  /**
   * The date and time the item was created.
   */
  created?: string;

  /**
   * The date and time the item was last modified.
   */
  modified?: string;

  /**
   * A short description of Calls app, not shown to end users.
   */
  name?: string;

  /**
   * A Cloudflare-generated unique identifier for a item.
   */
  uid?: string;
}

export interface TURNDeleteResponse {
  /**
   * The date and time the item was created.
   */
  created?: string;

  /**
   * The date and time the item was last modified.
   */
  modified?: string;

  /**
   * A short description of Calls app, not shown to end users.
   */
  name?: string;

  /**
   * A Cloudflare-generated unique identifier for a item.
   */
  uid?: string;
}

export interface TURNGetResponse {
  /**
   * The date and time the item was created.
   */
  created?: string;

  /**
   * The date and time the item was last modified.
   */
  modified?: string;

  /**
   * A short description of Calls app, not shown to end users.
   */
  name?: string;

  /**
   * A Cloudflare-generated unique identifier for a item.
   */
  uid?: string;
}

export interface TURNCreateParams {
  /**
   * Path param: The account identifier tag.
   */
  account_id: string;

  /**
   * Body param: A short description of a TURN key, not shown to end users.
   */
  name?: string;
}

export interface TURNUpdateParams {
  /**
   * Path param: The account identifier tag.
   */
  account_id: string;

  /**
   * Body param: A short description of a TURN key, not shown to end users.
   */
  name?: string;
}

export interface TURNListParams {
  /**
   * The account identifier tag.
   */
  account_id: string;
}

export interface TURNDeleteParams {
  /**
   * The account identifier tag.
   */
  account_id: string;
}

export interface TURNGetParams {
  /**
   * The account identifier tag.
   */
  account_id: string;
}

TURN.TURNListResponsesSinglePage = TURNListResponsesSinglePage;

export declare namespace TURN {
  export {
    type TURNCreateResponse as TURNCreateResponse,
    type TURNUpdateResponse as TURNUpdateResponse,
    type TURNListResponse as TURNListResponse,
    type TURNDeleteResponse as TURNDeleteResponse,
    type TURNGetResponse as TURNGetResponse,
    TURNListResponsesSinglePage as TURNListResponsesSinglePage,
    type TURNCreateParams as TURNCreateParams,
    type TURNUpdateParams as TURNUpdateParams,
    type TURNListParams as TURNListParams,
    type TURNDeleteParams as TURNDeleteParams,
    type TURNGetParams as TURNGetParams,
  };
}
