// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class RatePlans extends APIResource {
  /**
   * Lists all rate plans the zone can subscribe to.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const ratePlanGetResponse of client.zones.ratePlans.get(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    params: RatePlanGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RatePlanGetResponsesSinglePage, RatePlanGetResponse> {
    const { zone_id } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/available_rate_plans`,
      RatePlanGetResponsesSinglePage,
      options,
    );
  }
}

export class RatePlanGetResponsesSinglePage extends SinglePage<RatePlanGetResponse> {}

export interface RatePlanGetResponse {
  /**
   * Plan identifier tag.
   */
  id?: string;

  /**
   * Array of available components values for the plan.
   */
  components?: Array<RatePlanGetResponse.Component>;

  /**
   * The monetary unit in which pricing information is displayed.
   */
  currency?: string;

  /**
   * The duration of the plan subscription.
   */
  duration?: number;

  /**
   * The frequency at which you will be billed for this plan.
   */
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  /**
   * The plan name.
   */
  name?: string;
}

export namespace RatePlanGetResponse {
  export interface Component {
    /**
     * The default amount allocated.
     */
    default?: number;

    /**
     * The unique component.
     */
    name?: 'zones' | 'page_rules' | 'dedicated_certificates' | 'dedicated_certificates_custom';

    /**
     * The unit price of the addon.
     */
    unit_price?: number;
  }
}

export interface RatePlanGetParams {
  /**
   * Identifier
   */
  zone_id: string;
}

RatePlans.RatePlanGetResponsesSinglePage = RatePlanGetResponsesSinglePage;

export declare namespace RatePlans {
  export {
    type RatePlanGetResponse as RatePlanGetResponse,
    RatePlanGetResponsesSinglePage as RatePlanGetResponsesSinglePage,
    type RatePlanGetParams as RatePlanGetParams,
  };
}
