// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as Shared from '../../shared';
import { SinglePage } from '../../../pagination';

export class PagerdutyResource extends APIResource {
  /**
   * Creates a new token for integrating with PagerDuty.
   *
   * @example
   * ```ts
   * const pagerduty =
   *   await client.alerting.destinations.pagerduty.create({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  create(
    params: PagerdutyCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PagerdutyCreateResponse> {
    const { account_id } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/alerting/v3/destinations/pagerduty/connect`,
        options,
      ) as Core.APIPromise<{ result: PagerdutyCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes all the PagerDuty Services connected to the account.
   *
   * @example
   * ```ts
   * const pagerduty =
   *   await client.alerting.destinations.pagerduty.delete({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  delete(
    params: PagerdutyDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PagerdutyDeleteResponse> {
    const { account_id } = params;
    return this._client.delete(`/accounts/${account_id}/alerting/v3/destinations/pagerduty`, options);
  }

  /**
   * Get a list of all configured PagerDuty services.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const pagerduty of client.alerting.destinations.pagerduty.get(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    params: PagerdutyGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PagerdutiesSinglePage, Pagerduty> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/alerting/v3/destinations/pagerduty`,
      PagerdutiesSinglePage,
      options,
    );
  }

  /**
   * Links PagerDuty with the account using the integration token.
   *
   * @example
   * ```ts
   * const response =
   *   await client.alerting.destinations.pagerduty.link(
   *     '8c71e667571b4f61b94d9e4b12158038',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  link(
    tokenId: string,
    params: PagerdutyLinkParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PagerdutyLinkResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/alerting/v3/destinations/pagerduty/connect/${tokenId}`,
        options,
      ) as Core.APIPromise<{ result: PagerdutyLinkResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PagerdutiesSinglePage extends SinglePage<Pagerduty> {}

export interface Pagerduty {
  /**
   * UUID
   */
  id?: string;

  /**
   * The name of the pagerduty service.
   */
  name?: string;
}

export interface PagerdutyCreateResponse {
  /**
   * token in form of UUID
   */
  id?: string;
}

export interface PagerdutyDeleteResponse {
  errors: Array<Shared.ResponseInfo>;

  messages: Array<Shared.ResponseInfo>;

  /**
   * Whether the API call was successful
   */
  success: true;

  result_info?: PagerdutyDeleteResponse.ResultInfo;
}

export namespace PagerdutyDeleteResponse {
  export interface ResultInfo {
    /**
     * Total number of results for the requested service
     */
    count?: number;

    /**
     * Current page within paginated list of results
     */
    page?: number;

    /**
     * Number of results per page of results
     */
    per_page?: number;

    /**
     * Total results available without any search parameters
     */
    total_count?: number;
  }
}

export interface PagerdutyLinkResponse {
  /**
   * UUID
   */
  id?: string;
}

export interface PagerdutyCreateParams {
  /**
   * The account id
   */
  account_id: string;
}

export interface PagerdutyDeleteParams {
  /**
   * The account id
   */
  account_id: string;
}

export interface PagerdutyGetParams {
  /**
   * The account id
   */
  account_id: string;
}

export interface PagerdutyLinkParams {
  /**
   * The account id
   */
  account_id: string;
}

PagerdutyResource.PagerdutiesSinglePage = PagerdutiesSinglePage;

export declare namespace PagerdutyResource {
  export {
    type Pagerduty as Pagerduty,
    type PagerdutyCreateResponse as PagerdutyCreateResponse,
    type PagerdutyDeleteResponse as PagerdutyDeleteResponse,
    type PagerdutyLinkResponse as PagerdutyLinkResponse,
    PagerdutiesSinglePage as PagerdutiesSinglePage,
    type PagerdutyCreateParams as PagerdutyCreateParams,
    type PagerdutyDeleteParams as PagerdutyDeleteParams,
    type PagerdutyGetParams as PagerdutyGetParams,
    type PagerdutyLinkParams as PagerdutyLinkParams,
  };
}
