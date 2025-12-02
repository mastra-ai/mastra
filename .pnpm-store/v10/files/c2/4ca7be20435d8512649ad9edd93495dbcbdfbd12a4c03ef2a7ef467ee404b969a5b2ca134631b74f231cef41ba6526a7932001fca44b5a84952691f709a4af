// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as SpeedAPI from './speed';

export class Availabilities extends APIResource {
  /**
   * Retrieves quota for all plans, as well as the current zone quota.
   *
   * @example
   * ```ts
   * const availability = await client.speed.availabilities.list(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  list(params: AvailabilityListParams, options?: Core.RequestOptions): Core.APIPromise<Availability> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/speed_api/availabilities`, options) as Core.APIPromise<{
        result: Availability;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface Availability {
  quota?: Availability.Quota;

  regions?: Array<SpeedAPI.LabeledRegion>;

  /**
   * Available regions.
   */
  regionsPerPlan?: Availability.RegionsPerPlan;
}

export namespace Availability {
  export interface Quota {
    /**
     * Cloudflare plan.
     */
    plan?: string;

    /**
     * The number of tests available per plan.
     */
    quotasPerPlan?: Quota.QuotasPerPlan;

    /**
     * The number of remaining schedules available.
     */
    remainingSchedules?: number;

    /**
     * The number of remaining tests available.
     */
    remainingTests?: number;

    /**
     * The number of schedules available per plan.
     */
    scheduleQuotasPerPlan?: Quota.ScheduleQuotasPerPlan;
  }

  export namespace Quota {
    /**
     * The number of tests available per plan.
     */
    export interface QuotasPerPlan {
      /**
       * Counts per account plan.
       */
      value?: QuotasPerPlan.Value;
    }

    export namespace QuotasPerPlan {
      /**
       * Counts per account plan.
       */
      export interface Value {
        business?: number;

        enterprise?: number;

        free?: number;

        pro?: number;
      }
    }

    /**
     * The number of schedules available per plan.
     */
    export interface ScheduleQuotasPerPlan {
      /**
       * Counts per account plan.
       */
      value?: ScheduleQuotasPerPlan.Value;
    }

    export namespace ScheduleQuotasPerPlan {
      /**
       * Counts per account plan.
       */
      export interface Value {
        business?: number;

        enterprise?: number;

        free?: number;

        pro?: number;
      }
    }
  }

  /**
   * Available regions.
   */
  export interface RegionsPerPlan {
    business?: Array<SpeedAPI.LabeledRegion>;

    enterprise?: Array<SpeedAPI.LabeledRegion>;

    free?: Array<SpeedAPI.LabeledRegion>;

    pro?: Array<SpeedAPI.LabeledRegion>;
  }
}

export interface AvailabilityListParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace Availabilities {
  export { type Availability as Availability, type AvailabilityListParams as AvailabilityListParams };
}
