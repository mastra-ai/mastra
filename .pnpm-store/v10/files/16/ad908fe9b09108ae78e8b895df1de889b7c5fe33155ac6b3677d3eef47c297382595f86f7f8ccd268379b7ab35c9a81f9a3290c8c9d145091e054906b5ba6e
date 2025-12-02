// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as ASNsAPI from './asns';
import {
  ASNGetParams,
  ASNGetResponse,
  ASNIPParams,
  ASNIPResponse,
  ASNListParams,
  ASNListResponse,
  ASNRelParams,
  ASNRelResponse,
  ASNs,
} from './asns';
import * as LocationsAPI from './locations';
import {
  LocationGetParams,
  LocationGetResponse,
  LocationListParams,
  LocationListResponse,
  Locations,
} from './locations';

export class Entities extends APIResource {
  asns: ASNsAPI.ASNs = new ASNsAPI.ASNs(this._client);
  locations: LocationsAPI.Locations = new LocationsAPI.Locations(this._client);

  /**
   * Retrieves IP address information.
   *
   * @example
   * ```ts
   * const entity = await client.radar.entities.get({
   *   ip: '8.8.8.8',
   * });
   * ```
   */
  get(query: EntityGetParams, options?: Core.RequestOptions): Core.APIPromise<EntityGetResponse> {
    return (
      this._client.get('/radar/entities/ip', { query, ...options }) as Core.APIPromise<{
        result: EntityGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface EntityGetResponse {
  ip: EntityGetResponse.IP;
}

export namespace EntityGetResponse {
  export interface IP {
    asn: string;

    asnLocation: string;

    asnName: string;

    asnOrgName: string;

    ip: string;

    ipVersion: string;

    location: string;

    locationName: string;
  }
}

export interface EntityGetParams {
  /**
   * IP address.
   */
  ip: string;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';
}

Entities.ASNs = ASNs;
Entities.Locations = Locations;

export declare namespace Entities {
  export { type EntityGetResponse as EntityGetResponse, type EntityGetParams as EntityGetParams };

  export {
    ASNs as ASNs,
    type ASNListResponse as ASNListResponse,
    type ASNGetResponse as ASNGetResponse,
    type ASNIPResponse as ASNIPResponse,
    type ASNRelResponse as ASNRelResponse,
    type ASNListParams as ASNListParams,
    type ASNGetParams as ASNGetParams,
    type ASNIPParams as ASNIPParams,
    type ASNRelParams as ASNRelParams,
  };

  export {
    Locations as Locations,
    type LocationListResponse as LocationListResponse,
    type LocationGetResponse as LocationGetResponse,
    type LocationListParams as LocationListParams,
    type LocationGetParams as LocationGetParams,
  };
}
