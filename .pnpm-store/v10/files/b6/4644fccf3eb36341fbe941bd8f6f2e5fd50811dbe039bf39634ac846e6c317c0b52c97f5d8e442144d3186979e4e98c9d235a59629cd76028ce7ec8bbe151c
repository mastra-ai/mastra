// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { V4PagePagination, type V4PagePaginationParams } from '../../pagination';

export class Searches extends APIResource {
  /**
   * Search for Load Balancing resources.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const searchListResponse of client.loadBalancers.searches.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: SearchListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SearchListResponsesV4PagePagination, SearchListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/load_balancers/search`,
      SearchListResponsesV4PagePagination,
      { query, ...options },
    );
  }
}

export class SearchListResponsesV4PagePagination extends V4PagePagination<SearchListResponse> {}

export interface SearchListResponse {
  /**
   * A list of resources matching the search query.
   */
  resources?: Array<SearchListResponse.Resource>;
}

export namespace SearchListResponse {
  /**
   * A reference to a load balancer resource.
   */
  export interface Resource {
    /**
     * When listed as a reference, the type (direction) of the reference.
     */
    reference_type?: 'referral' | 'referrer';

    /**
     * A list of references to (referrer) or from (referral) this resource.
     */
    references?: Array<unknown>;

    resource_id?: string;

    /**
     * The human-identifiable name of the resource.
     */
    resource_name?: string;

    /**
     * The type of the resource.
     */
    resource_type?: 'load_balancer' | 'monitor' | 'pool';
  }
}

export interface SearchListParams extends V4PagePaginationParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Query param: Search query term.
   */
  query?: string;

  /**
   * Query param: The type of references to include. "\*" to include both referral
   * and referrer references. "" to not include any reference information.
   */
  references?: '' | '*' | 'referral' | 'referrer';
}

Searches.SearchListResponsesV4PagePagination = SearchListResponsesV4PagePagination;

export declare namespace Searches {
  export {
    type SearchListResponse as SearchListResponse,
    SearchListResponsesV4PagePagination as SearchListResponsesV4PagePagination,
    type SearchListParams as SearchListParams,
  };
}
