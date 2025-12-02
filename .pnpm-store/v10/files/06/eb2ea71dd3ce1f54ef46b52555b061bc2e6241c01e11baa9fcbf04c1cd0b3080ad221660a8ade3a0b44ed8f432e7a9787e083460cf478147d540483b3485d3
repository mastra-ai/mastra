// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Plans extends APIResource {
  /**
   * Lists available plans the zone can subscribe to.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const availableRatePlan of client.zones.plans.list(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PlanListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<AvailableRatePlansSinglePage, AvailableRatePlan> {
    const { zone_id } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/available_plans`,
      AvailableRatePlansSinglePage,
      options,
    );
  }

  /**
   * Details of the available plan that the zone can subscribe to.
   *
   * @example
   * ```ts
   * const availableRatePlan = await client.zones.plans.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    planIdentifier: string,
    params: PlanGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AvailableRatePlan> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/available_plans/${planIdentifier}`, options) as Core.APIPromise<{
        result: AvailableRatePlan;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class AvailableRatePlansSinglePage extends SinglePage<AvailableRatePlan> {}

export interface AvailableRatePlan {
  /**
   * Identifier
   */
  id?: string;

  /**
   * Indicates whether you can subscribe to this plan.
   */
  can_subscribe?: boolean;

  /**
   * The monetary unit in which pricing information is displayed.
   */
  currency?: string;

  /**
   * Indicates whether this plan is managed externally.
   */
  externally_managed?: boolean;

  /**
   * The frequency at which you will be billed for this plan.
   */
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  /**
   * Indicates whether you are currently subscribed to this plan.
   */
  is_subscribed?: boolean;

  /**
   * Indicates whether this plan has a legacy discount applied.
   */
  legacy_discount?: boolean;

  /**
   * The legacy identifier for this rate plan, if any.
   */
  legacy_id?: string;

  /**
   * The plan name.
   */
  name?: string;

  /**
   * The amount you will be billed for this plan.
   */
  price?: number;
}

export interface PlanListParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export interface PlanGetParams {
  /**
   * Identifier
   */
  zone_id: string;
}

Plans.AvailableRatePlansSinglePage = AvailableRatePlansSinglePage;

export declare namespace Plans {
  export {
    type AvailableRatePlan as AvailableRatePlan,
    AvailableRatePlansSinglePage as AvailableRatePlansSinglePage,
    type PlanListParams as PlanListParams,
    type PlanGetParams as PlanGetParams,
  };
}
