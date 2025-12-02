// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as ListsAPI from './lists';
import { CursorPagination, type CursorPaginationParams } from '../../../pagination';

export class Items extends APIResource {
  /**
   * Appends new items to the list.
   *
   * This operation is asynchronous. To get current the operation status, invoke the
   * `Get bulk operation status` endpoint with the returned `operation_id`.
   *
   * @example
   * ```ts
   * const item = await client.rules.lists.items.create(
   *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: [{}],
   *   },
   * );
   * ```
   */
  create(
    listId: string,
    params: ItemCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ItemCreateResponse> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/rules/lists/${listId}/items`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: ItemCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Removes all existing items from the list and adds the provided items to the
   * list.
   *
   * This operation is asynchronous. To get current the operation status, invoke the
   * `Get bulk operation status` endpoint with the returned `operation_id`.
   *
   * @example
   * ```ts
   * const item = await client.rules.lists.items.update(
   *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: [{}],
   *   },
   * );
   * ```
   */
  update(
    listId: string,
    params: ItemUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ItemUpdateResponse> {
    const { account_id, body } = params;
    return (
      this._client.put(`/accounts/${account_id}/rules/lists/${listId}/items`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: ItemUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches all the items in the list.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const itemListResponse of client.rules.lists.items.list(
   *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    listId: string,
    params: ItemListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ItemListResponsesCursorPagination, ItemListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/rules/lists/${listId}/items`,
      ItemListResponsesCursorPagination,
      { query, ...options },
    );
  }

  /**
   * Removes one or more items from a list.
   *
   * This operation is asynchronous. To get current the operation status, invoke the
   * `Get bulk operation status` endpoint with the returned `operation_id`.
   *
   * @example
   * ```ts
   * const item = await client.rules.lists.items.delete(
   *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    listId: string,
    params: ItemDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ItemDeleteResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.delete(`/accounts/${account_id}/rules/lists/${listId}/items`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ItemDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a list item in the list.
   *
   * @example
   * ```ts
   * const item = await client.rules.lists.items.get(
   *   '2c0fc9fa937b11eaa1b71c4d701ab86e',
   *   '34b12448945f11eaa1b71c4d701ab86e',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    listId: string,
    itemId: string,
    params: ItemGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ItemGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/rules/lists/${listId}/items/${itemId}`,
        options,
      ) as Core.APIPromise<{ result: ItemGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class ItemListResponsesCursorPagination extends CursorPagination<ItemListResponse> {}

export interface ListCursor {
  after?: string;

  before?: string;
}

export interface ListItem {
  /**
   * The unique operation ID of the asynchronous action.
   */
  operation_id?: string;
}

export interface ItemCreateResponse {
  /**
   * The unique operation ID of the asynchronous action.
   */
  operation_id?: string;
}

export interface ItemUpdateResponse {
  /**
   * The unique operation ID of the asynchronous action.
   */
  operation_id?: string;
}

export interface ItemListResponse {
  /**
   * The unique ID of the list.
   */
  id?: string;

  /**
   * Defines a non-negative 32 bit integer.
   */
  asn?: number;

  /**
   * Defines an informative summary of the list item.
   */
  comment?: string;

  /**
   * The RFC 3339 timestamp of when the item was created.
   */
  created_on?: string;

  /**
   * Valid characters for hostnames are ASCII(7) letters from a to z, the digits from
   * 0 to 9, wildcards (\*), and the hyphen (-).
   */
  hostname?: ListsAPI.Hostname;

  /**
   * An IPv4 address, an IPv4 CIDR, an IPv6 address, or an IPv6 CIDR.
   */
  ip?: string;

  /**
   * The RFC 3339 timestamp of when the item was last modified.
   */
  modified_on?: string;

  /**
   * The definition of the redirect.
   */
  redirect?: ListsAPI.Redirect;
}

export interface ItemDeleteResponse {
  /**
   * The unique operation ID of the asynchronous action.
   */
  operation_id?: string;
}

export interface ItemGetResponse {
  /**
   * The unique ID of the list.
   */
  id?: string;

  /**
   * Defines a non-negative 32 bit integer.
   */
  asn?: number;

  /**
   * Defines an informative summary of the list item.
   */
  comment?: string;

  /**
   * The RFC 3339 timestamp of when the item was created.
   */
  created_on?: string;

  /**
   * Valid characters for hostnames are ASCII(7) letters from a to z, the digits from
   * 0 to 9, wildcards (\*), and the hyphen (-).
   */
  hostname?: ListsAPI.Hostname;

  /**
   * An IPv4 address, an IPv4 CIDR, an IPv6 address, or an IPv6 CIDR.
   */
  ip?: string;

  /**
   * The RFC 3339 timestamp of when the item was last modified.
   */
  modified_on?: string;

  /**
   * The definition of the redirect.
   */
  redirect?: ListsAPI.Redirect;
}

export interface ItemCreateParams {
  /**
   * Path param: Defines an identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<ItemCreateParams.Body>;
}

export namespace ItemCreateParams {
  export interface Body {
    /**
     * Defines a non-negative 32 bit integer.
     */
    asn?: number;

    /**
     * Defines an informative summary of the list item.
     */
    comment?: string;

    /**
     * Valid characters for hostnames are ASCII(7) letters from a to z, the digits from
     * 0 to 9, wildcards (\*), and the hyphen (-).
     */
    hostname?: ListsAPI.HostnameParam;

    /**
     * An IPv4 address, an IPv4 CIDR, an IPv6 address, or an IPv6 CIDR.
     */
    ip?: string;

    /**
     * The definition of the redirect.
     */
    redirect?: ListsAPI.RedirectParam;
  }
}

export interface ItemUpdateParams {
  /**
   * Path param: Defines an identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<ItemUpdateParams.Body>;
}

export namespace ItemUpdateParams {
  export interface Body {
    /**
     * Defines a non-negative 32 bit integer.
     */
    asn?: number;

    /**
     * Defines an informative summary of the list item.
     */
    comment?: string;

    /**
     * Valid characters for hostnames are ASCII(7) letters from a to z, the digits from
     * 0 to 9, wildcards (\*), and the hyphen (-).
     */
    hostname?: ListsAPI.HostnameParam;

    /**
     * An IPv4 address, an IPv4 CIDR, an IPv6 address, or an IPv6 CIDR.
     */
    ip?: string;

    /**
     * The definition of the redirect.
     */
    redirect?: ListsAPI.RedirectParam;
  }
}

export interface ItemListParams extends CursorPaginationParams {
  /**
   * Path param: Defines an identifier.
   */
  account_id: string;

  /**
   * Query param: A search query to filter returned items. Its meaning depends on the
   * list type: IP addresses must start with the provided string, hostnames and bulk
   * redirects must contain the string, and ASNs must match the string exactly.
   */
  search?: string;
}

export interface ItemDeleteParams {
  /**
   * Path param: Defines an identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  items?: Array<ItemDeleteParams.Item>;
}

export namespace ItemDeleteParams {
  export interface Item {}
}

export interface ItemGetParams {
  /**
   * Defines an identifier.
   */
  account_id: string;
}

Items.ItemListResponsesCursorPagination = ItemListResponsesCursorPagination;

export declare namespace Items {
  export {
    type ListCursor as ListCursor,
    type ListItem as ListItem,
    type ItemCreateResponse as ItemCreateResponse,
    type ItemUpdateResponse as ItemUpdateResponse,
    type ItemListResponse as ItemListResponse,
    type ItemDeleteResponse as ItemDeleteResponse,
    type ItemGetResponse as ItemGetResponse,
    ItemListResponsesCursorPagination as ItemListResponsesCursorPagination,
    type ItemCreateParams as ItemCreateParams,
    type ItemUpdateParams as ItemUpdateParams,
    type ItemListParams as ItemListParams,
    type ItemDeleteParams as ItemDeleteParams,
    type ItemGetParams as ItemGetParams,
  };
}
