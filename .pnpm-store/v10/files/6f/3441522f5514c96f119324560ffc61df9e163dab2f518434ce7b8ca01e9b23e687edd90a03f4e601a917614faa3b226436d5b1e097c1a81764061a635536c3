// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import { isRequestOptions } from '../core';
import * as Core from '../core';
import { CloudflareError } from '../error';
import { SinglePage } from '../pagination';

export class CustomPages extends APIResource {
  /**
   * Updates the configuration of an existing custom page.
   *
   * @example
   * ```ts
   * const customPage = await client.customPages.update(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   {
   *     state: 'default',
   *     url: 'http://www.example.com',
   *     account_id: 'account_id',
   *   },
   * );
   * ```
   */
  update(
    identifier: string,
    params: CustomPageUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomPageUpdateResponse | null> {
    const { account_id, zone_id, ...body } = params;
    if (!account_id && !zone_id) {
      throw new CloudflareError('You must provide either account_id or zone_id.');
    }
    if (account_id && zone_id) {
      throw new CloudflareError('You cannot provide both account_id and zone_id.');
    }
    const { accountOrZone, accountOrZoneId } =
      account_id ?
        {
          accountOrZone: 'accounts',
          accountOrZoneId: account_id,
        }
      : {
          accountOrZone: 'zones',
          accountOrZoneId: zone_id,
        };
    return (
      this._client.put(`/${accountOrZone}/${accountOrZoneId}/custom_pages/${identifier}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CustomPageUpdateResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches all the custom pages.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const customPageListResponse of client.customPages.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params?: CustomPageListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CustomPageListResponsesSinglePage, CustomPageListResponse>;
  list(
    options?: Core.RequestOptions,
  ): Core.PagePromise<CustomPageListResponsesSinglePage, CustomPageListResponse>;
  list(
    params: CustomPageListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<CustomPageListResponsesSinglePage, CustomPageListResponse> {
    if (isRequestOptions(params)) {
      return this.list({}, params);
    }
    const { account_id, zone_id } = params;
    if (!account_id && !zone_id) {
      throw new CloudflareError('You must provide either account_id or zone_id.');
    }
    if (account_id && zone_id) {
      throw new CloudflareError('You cannot provide both account_id and zone_id.');
    }
    const { accountOrZone, accountOrZoneId } =
      account_id ?
        {
          accountOrZone: 'accounts',
          accountOrZoneId: account_id,
        }
      : {
          accountOrZone: 'zones',
          accountOrZoneId: zone_id,
        };
    return this._client.getAPIList(
      `/${accountOrZone}/${accountOrZoneId}/custom_pages`,
      CustomPageListResponsesSinglePage,
      options,
    );
  }

  /**
   * Fetches the details of a custom page.
   *
   * @example
   * ```ts
   * const customPage = await client.customPages.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    identifier: string,
    params?: CustomPageGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomPageGetResponse | null>;
  get(identifier: string, options?: Core.RequestOptions): Core.APIPromise<CustomPageGetResponse | null>;
  get(
    identifier: string,
    params: CustomPageGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomPageGetResponse | null> {
    if (isRequestOptions(params)) {
      return this.get(identifier, {}, params);
    }
    const { account_id, zone_id } = params;
    if (!account_id && !zone_id) {
      throw new CloudflareError('You must provide either account_id or zone_id.');
    }
    if (account_id && zone_id) {
      throw new CloudflareError('You cannot provide both account_id and zone_id.');
    }
    const { accountOrZone, accountOrZoneId } =
      account_id ?
        {
          accountOrZone: 'accounts',
          accountOrZoneId: account_id,
        }
      : {
          accountOrZone: 'zones',
          accountOrZoneId: zone_id,
        };
    return (
      this._client.get(
        `/${accountOrZone}/${accountOrZoneId}/custom_pages/${identifier}`,
        options,
      ) as Core.APIPromise<{ result: CustomPageGetResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class CustomPageListResponsesSinglePage extends SinglePage<CustomPageListResponse> {}

export type CustomPageUpdateResponse = unknown | string;

export type CustomPageListResponse = unknown;

export type CustomPageGetResponse = unknown | string;

export interface CustomPageUpdateParams {
  /**
   * Body param: The custom page state.
   */
  state: 'default' | 'customized';

  /**
   * Body param: The URL associated with the custom page.
   */
  url: string;

  /**
   * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
   * Zone ID.
   */
  account_id?: string;

  /**
   * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
   * Account ID.
   */
  zone_id?: string;
}

export interface CustomPageListParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export interface CustomPageGetParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

CustomPages.CustomPageListResponsesSinglePage = CustomPageListResponsesSinglePage;

export declare namespace CustomPages {
  export {
    type CustomPageUpdateResponse as CustomPageUpdateResponse,
    type CustomPageListResponse as CustomPageListResponse,
    type CustomPageGetResponse as CustomPageGetResponse,
    CustomPageListResponsesSinglePage as CustomPageListResponsesSinglePage,
    type CustomPageUpdateParams as CustomPageUpdateParams,
    type CustomPageListParams as CustomPageListParams,
    type CustomPageGetParams as CustomPageGetParams,
  };
}
