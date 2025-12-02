// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';

export class Outages extends APIResource {
  /**
   * Retrieves the latest Internet outages and anomalies.
   *
   * @example
   * ```ts
   * const outage = await client.radar.annotations.outages.get();
   * ```
   */
  get(query?: OutageGetParams, options?: Core.RequestOptions): Core.APIPromise<OutageGetResponse>;
  get(options?: Core.RequestOptions): Core.APIPromise<OutageGetResponse>;
  get(
    query: OutageGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<OutageGetResponse> {
    if (isRequestOptions(query)) {
      return this.get({}, query);
    }
    return (
      this._client.get('/radar/annotations/outages', { query, ...options }) as Core.APIPromise<{
        result: OutageGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the number of outages by location.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.annotations.outages.locations();
   * ```
   */
  locations(
    query?: OutageLocationsParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OutageLocationsResponse>;
  locations(options?: Core.RequestOptions): Core.APIPromise<OutageLocationsResponse>;
  locations(
    query: OutageLocationsParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<OutageLocationsResponse> {
    if (isRequestOptions(query)) {
      return this.locations({}, query);
    }
    return (
      this._client.get('/radar/annotations/outages/locations', { query, ...options }) as Core.APIPromise<{
        result: OutageLocationsResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface OutageGetResponse {
  annotations: Array<OutageGetResponse.Annotation>;
}

export namespace OutageGetResponse {
  export interface Annotation {
    id: string;

    asns: Array<number>;

    asnsDetails: Array<Annotation.ASNsDetail>;

    dataSource: string;

    eventType: string;

    locations: Array<string>;

    locationsDetails: Array<Annotation.LocationsDetail>;

    outage: Annotation.Outage;

    startDate: string;

    description?: string;

    endDate?: string;

    linkedUrl?: string;

    scope?: string;
  }

  export namespace Annotation {
    export interface ASNsDetail {
      asn: string;

      name: string;

      locations?: ASNsDetail.Locations;
    }

    export namespace ASNsDetail {
      export interface Locations {
        code: string;

        name: string;
      }
    }

    export interface LocationsDetail {
      code: string;

      name: string;
    }

    export interface Outage {
      outageCause: string;

      outageType: string;
    }
  }
}

export interface OutageLocationsResponse {
  annotations: Array<OutageLocationsResponse.Annotation>;
}

export namespace OutageLocationsResponse {
  export interface Annotation {
    clientCountryAlpha2: string;

    clientCountryName: string;

    /**
     * A numeric string.
     */
    value: string;
  }
}

export interface OutageGetParams {
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
}

export interface OutageLocationsParams {
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
}

export declare namespace Outages {
  export {
    type OutageGetResponse as OutageGetResponse,
    type OutageLocationsResponse as OutageLocationsResponse,
    type OutageGetParams as OutageGetParams,
    type OutageLocationsParams as OutageLocationsParams,
  };
}
