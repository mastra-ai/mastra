// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as RegionsAPI from './regions';
import { RegionListParams, RegionListResponse, RegionListResponsesSinglePage, Regions } from './regions';
import { SinglePage } from '../../../pagination';

export class RegionalHostnames extends APIResource {
  regions: RegionsAPI.Regions = new RegionsAPI.Regions(this._client);

  /**
   * Create a new Regional Hostname entry. Cloudflare will only use data centers that
   * are physically located within the chosen region to decrypt and service HTTPS
   * traffic. Learn more about
   * [Regional Services](https://developers.cloudflare.com/data-localization/regional-services/get-started/).
   *
   * @example
   * ```ts
   * const regionalHostname =
   *   await client.addressing.regionalHostnames.create({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     hostname: 'foo.example.com',
   *     region_key: 'ca',
   *   });
   * ```
   */
  create(
    params: RegionalHostnameCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegionalHostnameCreateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/addressing/regional_hostnames`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RegionalHostnameCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List all Regional Hostnames within a zone.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const regionalHostnameListResponse of client.addressing.regionalHostnames.list(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: RegionalHostnameListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RegionalHostnameListResponsesSinglePage, RegionalHostnameListResponse> {
    const { zone_id } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/addressing/regional_hostnames`,
      RegionalHostnameListResponsesSinglePage,
      options,
    );
  }

  /**
   * Delete the region configuration for a specific Regional Hostname.
   *
   * @example
   * ```ts
   * const regionalHostname =
   *   await client.addressing.regionalHostnames.delete(
   *     'foo.example.com',
   *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    hostname: string,
    params: RegionalHostnameDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegionalHostnameDeleteResponse> {
    const { zone_id } = params;
    return this._client.delete(`/zones/${zone_id}/addressing/regional_hostnames/${hostname}`, options);
  }

  /**
   * Update the configuration for a specific Regional Hostname. Only the region_key
   * of a hostname is mutable.
   *
   * @example
   * ```ts
   * const response =
   *   await client.addressing.regionalHostnames.edit(
   *     'foo.example.com',
   *     {
   *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       region_key: 'ca',
   *     },
   *   );
   * ```
   */
  edit(
    hostname: string,
    params: RegionalHostnameEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegionalHostnameEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/addressing/regional_hostnames/${hostname}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RegionalHostnameEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch the configuration for a specific Regional Hostname, within a zone.
   *
   * @example
   * ```ts
   * const regionalHostname =
   *   await client.addressing.regionalHostnames.get(
   *     'foo.example.com',
   *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    hostname: string,
    params: RegionalHostnameGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegionalHostnameGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(
        `/zones/${zone_id}/addressing/regional_hostnames/${hostname}`,
        options,
      ) as Core.APIPromise<{ result: RegionalHostnameGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class RegionalHostnameListResponsesSinglePage extends SinglePage<RegionalHostnameListResponse> {}

export interface RegionalHostnameCreateResponse {
  /**
   * When the regional hostname was created
   */
  created_on: string;

  /**
   * DNS hostname to be regionalized, must be a subdomain of the zone. Wildcards are
   * supported for one level, e.g `*.example.com`
   */
  hostname: string;

  /**
   * Identifying key for the region
   */
  region_key: string;

  /**
   * Configure which routing method to use for the regional hostname
   */
  routing?: string;
}

export interface RegionalHostnameListResponse {
  /**
   * When the regional hostname was created
   */
  created_on: string;

  /**
   * DNS hostname to be regionalized, must be a subdomain of the zone. Wildcards are
   * supported for one level, e.g `*.example.com`
   */
  hostname: string;

  /**
   * Identifying key for the region
   */
  region_key: string;

  /**
   * Configure which routing method to use for the regional hostname
   */
  routing?: string;
}

export interface RegionalHostnameDeleteResponse {
  errors: Array<RegionalHostnameDeleteResponse.Error>;

  messages: Array<RegionalHostnameDeleteResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace RegionalHostnameDeleteResponse {
  export interface Error {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Error.Source;
  }

  export namespace Error {
    export interface Source {
      pointer?: string;
    }
  }

  export interface Message {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Message.Source;
  }

  export namespace Message {
    export interface Source {
      pointer?: string;
    }
  }
}

export interface RegionalHostnameEditResponse {
  /**
   * When the regional hostname was created
   */
  created_on: string;

  /**
   * DNS hostname to be regionalized, must be a subdomain of the zone. Wildcards are
   * supported for one level, e.g `*.example.com`
   */
  hostname: string;

  /**
   * Identifying key for the region
   */
  region_key: string;

  /**
   * Configure which routing method to use for the regional hostname
   */
  routing?: string;
}

export interface RegionalHostnameGetResponse {
  /**
   * When the regional hostname was created
   */
  created_on: string;

  /**
   * DNS hostname to be regionalized, must be a subdomain of the zone. Wildcards are
   * supported for one level, e.g `*.example.com`
   */
  hostname: string;

  /**
   * Identifying key for the region
   */
  region_key: string;

  /**
   * Configure which routing method to use for the regional hostname
   */
  routing?: string;
}

export interface RegionalHostnameCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: DNS hostname to be regionalized, must be a subdomain of the zone.
   * Wildcards are supported for one level, e.g `*.example.com`
   */
  hostname: string;

  /**
   * Body param: Identifying key for the region
   */
  region_key: string;

  /**
   * Body param: Configure which routing method to use for the regional hostname
   */
  routing?: string;
}

export interface RegionalHostnameListParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface RegionalHostnameDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface RegionalHostnameEditParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Identifying key for the region
   */
  region_key: string;
}

export interface RegionalHostnameGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

RegionalHostnames.RegionalHostnameListResponsesSinglePage = RegionalHostnameListResponsesSinglePage;
RegionalHostnames.Regions = Regions;
RegionalHostnames.RegionListResponsesSinglePage = RegionListResponsesSinglePage;

export declare namespace RegionalHostnames {
  export {
    type RegionalHostnameCreateResponse as RegionalHostnameCreateResponse,
    type RegionalHostnameListResponse as RegionalHostnameListResponse,
    type RegionalHostnameDeleteResponse as RegionalHostnameDeleteResponse,
    type RegionalHostnameEditResponse as RegionalHostnameEditResponse,
    type RegionalHostnameGetResponse as RegionalHostnameGetResponse,
    RegionalHostnameListResponsesSinglePage as RegionalHostnameListResponsesSinglePage,
    type RegionalHostnameCreateParams as RegionalHostnameCreateParams,
    type RegionalHostnameListParams as RegionalHostnameListParams,
    type RegionalHostnameDeleteParams as RegionalHostnameDeleteParams,
    type RegionalHostnameEditParams as RegionalHostnameEditParams,
    type RegionalHostnameGetParams as RegionalHostnameGetParams,
  };

  export {
    Regions as Regions,
    type RegionListResponse as RegionListResponse,
    RegionListResponsesSinglePage as RegionListResponsesSinglePage,
    type RegionListParams as RegionListParams,
  };
}
