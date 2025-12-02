// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as DEXAPI from './dex';
import * as PercentilesAPI from './http-tests/percentiles';

export class TracerouteTests extends APIResource {
  /**
   * Get test details and aggregate performance metrics for an traceroute test for a
   * given time period between 1 hour and 7 days.
   *
   * @example
   * ```ts
   * const traceroute =
   *   await client.zeroTrust.dex.tracerouteTests.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '01a7362d577a6c3019a474fd6f485823',
   *       from: '1689520412000',
   *       interval: 'minute',
   *       to: '1689606812000',
   *     },
   *   );
   * ```
   */
  get(
    testId: string,
    params: TracerouteTestGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Traceroute> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/dex/traceroute-tests/${testId}`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: Traceroute }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a breakdown of metrics by hop for individual traceroute test runs
   *
   * @example
   * ```ts
   * const networkPathResponse =
   *   await client.zeroTrust.dex.tracerouteTests.networkPath(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '01a7362d577a6c3019a474fd6f485823',
   *       deviceId: 'deviceId',
   *       from: '1689520412000',
   *       interval: 'minute',
   *       to: '1689606812000',
   *     },
   *   );
   * ```
   */
  networkPath(
    testId: string,
    params: TracerouteTestNetworkPathParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DEXAPI.NetworkPathResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/dex/traceroute-tests/${testId}/network-path`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: DEXAPI.NetworkPathResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get percentiles for a traceroute test for a given time period between 1 hour and
   * 7 days.
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.dex.tracerouteTests.percentiles(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '01a7362d577a6c3019a474fd6f485823',
   *       from: '2023-09-20T17:00:00Z',
   *       to: '2023-09-20T17:00:00Z',
   *     },
   *   );
   * ```
   */
  percentiles(
    testId: string,
    params: TracerouteTestPercentilesParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TracerouteTestPercentilesResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/dex/traceroute-tests/${testId}/percentiles`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: TracerouteTestPercentilesResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface Traceroute {
  /**
   * The host of the Traceroute synthetic application test
   */
  host: string;

  /**
   * The interval at which the Traceroute synthetic application test is set to run.
   */
  interval: string;

  kind: 'traceroute';

  /**
   * The name of the Traceroute synthetic application test
   */
  name: string;

  target_policies?: Array<DEXAPI.DigitalExperienceMonitor> | null;

  targeted?: boolean;

  tracerouteStats?: Traceroute.TracerouteStats | null;

  tracerouteStatsByColo?: Array<Traceroute.TracerouteStatsByColo>;
}

export namespace Traceroute {
  export interface TracerouteStats {
    availabilityPct: TracerouteStats.AvailabilityPct;

    hopsCount: PercentilesAPI.TestStatOverTime;

    packetLossPct: TracerouteStats.PacketLossPct;

    roundTripTimeMs: PercentilesAPI.TestStatOverTime;

    /**
     * Count of unique devices that have run this test in the given time period
     */
    uniqueDevicesTotal: number;
  }

  export namespace TracerouteStats {
    export interface AvailabilityPct {
      slots: Array<AvailabilityPct.Slot>;

      /**
       * average observed in the time period
       */
      avg?: number | null;

      /**
       * highest observed in the time period
       */
      max?: number | null;

      /**
       * lowest observed in the time period
       */
      min?: number | null;
    }

    export namespace AvailabilityPct {
      export interface Slot {
        timestamp: string;

        value: number;
      }
    }

    export interface PacketLossPct {
      slots: Array<PacketLossPct.Slot>;

      /**
       * average observed in the time period
       */
      avg?: number | null;

      /**
       * highest observed in the time period
       */
      max?: number | null;

      /**
       * lowest observed in the time period
       */
      min?: number | null;
    }

    export namespace PacketLossPct {
      export interface Slot {
        timestamp: string;

        value: number;
      }
    }
  }

  export interface TracerouteStatsByColo {
    availabilityPct: TracerouteStatsByColo.AvailabilityPct;

    colo: string;

    hopsCount: PercentilesAPI.TestStatOverTime;

    packetLossPct: TracerouteStatsByColo.PacketLossPct;

    roundTripTimeMs: PercentilesAPI.TestStatOverTime;

    /**
     * Count of unique devices that have run this test in the given time period
     */
    uniqueDevicesTotal: number;
  }

  export namespace TracerouteStatsByColo {
    export interface AvailabilityPct {
      slots: Array<AvailabilityPct.Slot>;

      /**
       * average observed in the time period
       */
      avg?: number | null;

      /**
       * highest observed in the time period
       */
      max?: number | null;

      /**
       * lowest observed in the time period
       */
      min?: number | null;
    }

    export namespace AvailabilityPct {
      export interface Slot {
        timestamp: string;

        value: number;
      }
    }

    export interface PacketLossPct {
      slots: Array<PacketLossPct.Slot>;

      /**
       * average observed in the time period
       */
      avg?: number | null;

      /**
       * highest observed in the time period
       */
      max?: number | null;

      /**
       * lowest observed in the time period
       */
      min?: number | null;
    }

    export namespace PacketLossPct {
      export interface Slot {
        timestamp: string;

        value: number;
      }
    }
  }
}

export interface TracerouteTestPercentilesResponse {
  hopsCount?: DEXAPI.Percentiles;

  packetLossPct?: DEXAPI.Percentiles;

  roundTripTimeMs?: DEXAPI.Percentiles;
}

export interface TracerouteTestGetParams {
  /**
   * Path param: Unique identifier linked to an account
   */
  account_id: string;

  /**
   * Query param: Start time for aggregate metrics in ISO ms
   */
  from: string;

  /**
   * Query param: Time interval for aggregate time slots.
   */
  interval: 'minute' | 'hour';

  /**
   * Query param: End time for aggregate metrics in ISO ms
   */
  to: string;

  /**
   * Query param: Optionally filter result stats to a Cloudflare colo. Cannot be used
   * in combination with deviceId param.
   */
  colo?: string;

  /**
   * Query param: Optionally filter result stats to a specific device(s). Cannot be
   * used in combination with colo param.
   */
  deviceId?: Array<string>;
}

export interface TracerouteTestNetworkPathParams {
  /**
   * Path param: unique identifier linked to an account
   */
  account_id: string;

  /**
   * Query param: Device to filter tracroute result runs to
   */
  deviceId: string;

  /**
   * Query param: Start time for aggregate metrics in ISO ms
   */
  from: string;

  /**
   * Query param: Time interval for aggregate time slots.
   */
  interval: 'minute' | 'hour';

  /**
   * Query param: End time for aggregate metrics in ISO ms
   */
  to: string;
}

export interface TracerouteTestPercentilesParams {
  /**
   * Path param: unique identifier linked to an account in the API request path.
   */
  account_id: string;

  /**
   * Query param: Start time for the query in ISO (RFC3339 - ISO 8601) format
   */
  from: string;

  /**
   * Query param: End time for the query in ISO (RFC3339 - ISO 8601) format
   */
  to: string;

  /**
   * Query param: Optionally filter result stats to a Cloudflare colo. Cannot be used
   * in combination with deviceId param.
   */
  colo?: string;

  /**
   * Query param: Optionally filter result stats to a specific device(s). Cannot be
   * used in combination with colo param.
   */
  deviceId?: Array<string>;
}

export declare namespace TracerouteTests {
  export {
    type Traceroute as Traceroute,
    type TracerouteTestPercentilesResponse as TracerouteTestPercentilesResponse,
    type TracerouteTestGetParams as TracerouteTestGetParams,
    type TracerouteTestNetworkPathParams as TracerouteTestNetworkPathParams,
    type TracerouteTestPercentilesParams as TracerouteTestPercentilesParams,
  };
}
