// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class RayID extends APIResource {
  /**
   * The `/rayids` api route allows lookups by specific rayid. The rayids route will
   * return zero, one, or more records (ray ids are not unique).
   *
   * @example
   * ```ts
   * const RayID = await client.logs.RayID.get(
   *   '41ddf1740f67442d',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    RayID: string,
    params: RayIDGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RayIDGetResponse> {
    const { zone_id, ...query } = params;
    return this._client.get(`/zones/${zone_id}/logs/rayids/${RayID}`, { query, ...options });
  }
}

export type RayIDGetResponse = string | unknown;

export interface RayIDGetParams {
  /**
   * Path param: Identifier
   */
  zone_id: string;

  /**
   * Query param: The `/received` route by default returns a limited set of fields,
   * and allows customers to override the default field set by specifying individual
   * fields. The reasons for this are: 1. Most customers require only a small subset
   * of fields, but that subset varies from customer to customer; 2. Flat schema is
   * much easier to work with downstream (importing into BigTable etc); 3.
   * Performance (time to process, file size). If `?fields=` is not specified,
   * default field set is returned. This default field set may change at any time.
   * When `?fields=` is provided, each record is returned with the specified fields.
   * `fields` must be specified as a comma separated list without any whitespaces,
   * and all fields must exist. The order in which fields are specified does not
   * matter, and the order of fields in the response is not specified.
   */
  fields?: string;

  /**
   * Query param: By default, timestamps in responses are returned as Unix nanosecond
   * integers. The `?timestamps=` argument can be set to change the format in which
   * response timestamps are returned. Possible values are: `unix`, `unixnano`,
   * `rfc3339`. Note that `unix` and `unixnano` return timestamps as integers;
   * `rfc3339` returns timestamps as strings.
   */
  timestamps?: 'unix' | 'unixnano' | 'rfc3339';
}

export declare namespace RayID {
  export { type RayIDGetResponse as RayIDGetResponse, type RayIDGetParams as RayIDGetParams };
}
