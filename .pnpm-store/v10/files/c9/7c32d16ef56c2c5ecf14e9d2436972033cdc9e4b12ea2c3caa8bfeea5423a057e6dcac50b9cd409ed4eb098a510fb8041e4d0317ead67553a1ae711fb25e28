// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from '../pagination';

/**
 * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
 */
export class Filters extends APIResource {
  /**
   * Creates one or more filters.
   *
   * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
   */
  create(
    params: FilterCreateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<FirewallFiltersSinglePage, FirewallFilter> {
    const { zone_id, ...body } = params;
    return this._client.getAPIList(`/zones/${zone_id}/filters`, FirewallFiltersSinglePage, {
      body,
      method: 'post',
      ...options,
    });
  }

  /**
   * Updates an existing filter.
   *
   * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
   */
  update(
    filterId: string,
    params: FilterUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FirewallFilter> {
    const { zone_id, body } = params;
    return (
      this._client.put(`/zones/${zone_id}/filters/${filterId}`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: FirewallFilter }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches filters in a zone. You can filter the results using several optional
   * parameters.
   *
   * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
   */
  list(
    params: FilterListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<FirewallFiltersV4PagePaginationArray, FirewallFilter> {
    const { zone_id, ...query } = params;
    return this._client.getAPIList(`/zones/${zone_id}/filters`, FirewallFiltersV4PagePaginationArray, {
      query,
      ...options,
    });
  }

  /**
   * Deletes an existing filter.
   *
   * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
   */
  delete(
    filterId: string,
    params: FilterDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FirewallFilter> {
    const { zone_id } = params;
    return (
      this._client.delete(`/zones/${zone_id}/filters/${filterId}`, options) as Core.APIPromise<{
        result: FirewallFilter;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes one or more existing filters.
   *
   * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
   */
  bulkDelete(
    params: FilterBulkDeleteParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<FirewallFiltersSinglePage, FirewallFilter> {
    const { zone_id } = params;
    return this._client.getAPIList(`/zones/${zone_id}/filters`, FirewallFiltersSinglePage, {
      method: 'delete',
      ...options,
    });
  }

  /**
   * Updates one or more existing filters.
   *
   * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
   */
  bulkUpdate(
    params: FilterBulkUpdateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<FirewallFiltersSinglePage, FirewallFilter> {
    const { zone_id, ...body } = params;
    return this._client.getAPIList(`/zones/${zone_id}/filters`, FirewallFiltersSinglePage, {
      body,
      method: 'put',
      ...options,
    });
  }

  /**
   * Fetches the details of a filter.
   *
   * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
   */
  get(
    filterId: string,
    params: FilterGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FirewallFilter> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/filters/${filterId}`, options) as Core.APIPromise<{
        result: FirewallFilter;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class FirewallFiltersSinglePage extends SinglePage<FirewallFilter> {}

export class FirewallFiltersV4PagePaginationArray extends V4PagePaginationArray<FirewallFilter> {}

export interface FirewallFilter {
  /**
   * The unique identifier of the filter.
   */
  id?: string;

  /**
   * An informative summary of the filter.
   */
  description?: string;

  /**
   * The filter expression. For more information, refer to
   * [Expressions](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/).
   */
  expression?: string;

  /**
   * When true, indicates that the filter is currently paused.
   */
  paused?: boolean;

  /**
   * A short reference tag. Allows you to select related filters.
   */
  ref?: string;
}

export interface FirewallFilterParam {
  /**
   * An informative summary of the filter.
   */
  description?: string;

  /**
   * The filter expression. For more information, refer to
   * [Expressions](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/).
   */
  expression?: string;

  /**
   * When true, indicates that the filter is currently paused.
   */
  paused?: boolean;

  /**
   * A short reference tag. Allows you to select related filters.
   */
  ref?: string;
}

export interface FilterCreateParams {
  /**
   * Path param: Defines an identifier.
   */
  zone_id: string;

  /**
   * Body param: The filter expression. For more information, refer to
   * [Expressions](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/).
   */
  expression: string;
}

export interface FilterUpdateParams {
  /**
   * Path param: Defines an identifier.
   */
  zone_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface FilterListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Defines an identifier.
   */
  zone_id: string;

  /**
   * Query param: The unique identifier of the filter.
   */
  id?: string;

  /**
   * Query param: A case-insensitive string to find in the description.
   */
  description?: string;

  /**
   * Query param: A case-insensitive string to find in the expression.
   */
  expression?: string;

  /**
   * Query param: When true, indicates that the filter is currently paused.
   */
  paused?: boolean;

  /**
   * Query param: The filter ref (a short reference tag) to search for. Must be an
   * exact match.
   */
  ref?: string;
}

export interface FilterDeleteParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

export interface FilterBulkDeleteParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

export interface FilterBulkUpdateParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

export interface FilterGetParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

Filters.FirewallFiltersSinglePage = FirewallFiltersSinglePage;
Filters.FirewallFiltersV4PagePaginationArray = FirewallFiltersV4PagePaginationArray;

export declare namespace Filters {
  export {
    type FirewallFilter as FirewallFilter,
    FirewallFiltersSinglePage as FirewallFiltersSinglePage,
    FirewallFiltersV4PagePaginationArray as FirewallFiltersV4PagePaginationArray,
    type FilterCreateParams as FilterCreateParams,
    type FilterUpdateParams as FilterUpdateParams,
    type FilterListParams as FilterListParams,
    type FilterDeleteParams as FilterDeleteParams,
    type FilterBulkDeleteParams as FilterBulkDeleteParams,
    type FilterBulkUpdateParams as FilterBulkUpdateParams,
    type FilterGetParams as FilterGetParams,
  };
}
