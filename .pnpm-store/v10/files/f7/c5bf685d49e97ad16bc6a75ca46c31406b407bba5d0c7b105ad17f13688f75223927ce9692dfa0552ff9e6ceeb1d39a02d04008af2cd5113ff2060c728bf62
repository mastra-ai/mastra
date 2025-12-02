// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';
import * as LocationsAPI from './locations';
import { LocationGetParams, LocationGetResponse, Locations as LocationsAPILocations } from './locations';

export class TrafficAnomalies extends APIResource {
  locations: LocationsAPI.Locations = new LocationsAPI.Locations(this._client);

  /**
   * Retrieves the latest Internet traffic anomalies, which are signals that might
   * indicate an outage. These alerts are automatically detected by Radar and
   * manually verified by our team.
   *
   * @example
   * ```ts
   * const trafficAnomaly =
   *   await client.radar.trafficAnomalies.get();
   * ```
   */
  get(
    query?: TrafficAnomalyGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TrafficAnomalyGetResponse>;
  get(options?: Core.RequestOptions): Core.APIPromise<TrafficAnomalyGetResponse>;
  get(
    query: TrafficAnomalyGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<TrafficAnomalyGetResponse> {
    if (isRequestOptions(query)) {
      return this.get({}, query);
    }
    return (
      this._client.get('/radar/traffic_anomalies', { query, ...options }) as Core.APIPromise<{
        result: TrafficAnomalyGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface TrafficAnomalyGetResponse {
  trafficAnomalies: Array<TrafficAnomalyGetResponse.TrafficAnomaly>;
}

export namespace TrafficAnomalyGetResponse {
  export interface TrafficAnomaly {
    startDate: string;

    status: string;

    type: string;

    uuid: string;

    asnDetails?: TrafficAnomaly.ASNDetails;

    endDate?: string;

    locationDetails?: TrafficAnomaly.LocationDetails;

    visibleInDataSources?: Array<string>;
  }

  export namespace TrafficAnomaly {
    export interface ASNDetails {
      asn: string;

      name: string;

      locations?: ASNDetails.Locations;
    }

    export namespace ASNDetails {
      export interface Locations {
        code: string;

        name: string;
      }
    }

    export interface LocationDetails {
      code: string;

      name: string;
    }
  }
}

export interface TrafficAnomalyGetParams {
  /**
   * Filters results by Autonomous System. Specify a single Autonomous System Number
   * (ASN) as integer.
   */
  asn?: number;

  /**
   * End of the date range (inclusive).
   */
  dateEnd?: string;

  /**
   * Filters results by date range.
   */
  dateRange?: string;

  /**
   * Start of the date range (inclusive).
   */
  dateStart?: string;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Filters results by location. Specify an alpha-2 location code.
   */
  location?: string;

  /**
   * Skips the specified number of objects before fetching the results.
   */
  offset?: number;

  status?: 'VERIFIED' | 'UNVERIFIED';
}

TrafficAnomalies.Locations = LocationsAPILocations;

export declare namespace TrafficAnomalies {
  export {
    type TrafficAnomalyGetResponse as TrafficAnomalyGetResponse,
    type TrafficAnomalyGetParams as TrafficAnomalyGetParams,
  };

  export {
    LocationsAPILocations as Locations,
    type LocationGetResponse as LocationGetResponse,
    type LocationGetParams as LocationGetParams,
  };
}
