// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';

export class Locations extends APIResource {
  /**
   * Retrieves a list of locations.
   *
   * @example
   * ```ts
   * const locations =
   *   await client.radar.entities.locations.list();
   * ```
   */
  list(query?: LocationListParams, options?: Core.RequestOptions): Core.APIPromise<LocationListResponse>;
  list(options?: Core.RequestOptions): Core.APIPromise<LocationListResponse>;
  list(
    query: LocationListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<LocationListResponse> {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return (
      this._client.get('/radar/entities/locations', { query, ...options }) as Core.APIPromise<{
        result: LocationListResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the requested location information. (A confidence level below `5`
   * indicates a low level of confidence in the traffic data - normally this happens
   * because Cloudflare has a small amount of traffic from/to this location).
   *
   * @example
   * ```ts
   * const location = await client.radar.entities.locations.get(
   *   'US',
   * );
   * ```
   */
  get(
    location: string,
    query?: LocationGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LocationGetResponse>;
  get(location: string, options?: Core.RequestOptions): Core.APIPromise<LocationGetResponse>;
  get(
    location: string,
    query: LocationGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<LocationGetResponse> {
    if (isRequestOptions(query)) {
      return this.get(location, {}, query);
    }
    return (
      this._client.get(`/radar/entities/locations/${location}`, { query, ...options }) as Core.APIPromise<{
        result: LocationGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface LocationListResponse {
  locations: Array<LocationListResponse.Location>;
}

export namespace LocationListResponse {
  export interface Location {
    alpha2: string;

    /**
     * A numeric string.
     */
    latitude: string;

    /**
     * A numeric string.
     */
    longitude: string;

    name: string;
  }
}

export interface LocationGetResponse {
  location: LocationGetResponse.Location;
}

export namespace LocationGetResponse {
  export interface Location {
    alpha2: string;

    confidenceLevel: number;

    /**
     * A numeric string.
     */
    latitude: string;

    /**
     * A numeric string.
     */
    longitude: string;

    name: string;

    region: string;

    subregion: string;
  }
}

export interface LocationListParams {
  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Filters results by location. Specify a comma-separated list of alpha-2 location
   * codes.
   */
  location?: string;

  /**
   * Skips the specified number of objects before fetching the results.
   */
  offset?: number;
}

export interface LocationGetParams {
  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';
}

export declare namespace Locations {
  export {
    type LocationListResponse as LocationListResponse,
    type LocationGetResponse as LocationGetResponse,
    type LocationListParams as LocationListParams,
    type LocationGetParams as LocationGetParams,
  };
}
