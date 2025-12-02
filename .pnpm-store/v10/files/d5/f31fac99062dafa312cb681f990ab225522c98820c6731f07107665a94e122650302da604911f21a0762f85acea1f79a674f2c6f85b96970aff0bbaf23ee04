// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Routes extends APIResource {
  /**
   * Creates a route that maps a URL pattern to a Worker.
   *
   * @example
   * ```ts
   * const route = await client.workers.routes.create({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   pattern: 'example.com/*',
   * });
   * ```
   */
  create(params: RouteCreateParams, options?: Core.RequestOptions): Core.APIPromise<RouteCreateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/workers/routes`, { body, ...options }) as Core.APIPromise<{
        result: RouteCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates the URL pattern or Worker associated with a route.
   *
   * @example
   * ```ts
   * const route = await client.workers.routes.update(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   {
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     pattern: 'example.com/*',
   *   },
   * );
   * ```
   */
  update(
    routeId: string,
    params: RouteUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RouteUpdateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/workers/routes/${routeId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RouteUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Returns routes for a zone.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const routeListResponse of client.workers.routes.list(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: RouteListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RouteListResponsesSinglePage, RouteListResponse> {
    const { zone_id } = params;
    return this._client.getAPIList(`/zones/${zone_id}/workers/routes`, RouteListResponsesSinglePage, options);
  }

  /**
   * Deletes a route.
   *
   * @example
   * ```ts
   * const route = await client.workers.routes.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    routeId: string,
    params: RouteDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RouteDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(`/zones/${zone_id}/workers/routes/${routeId}`, options) as Core.APIPromise<{
        result: RouteDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Returns information about a route, including URL pattern and Worker.
   *
   * @example
   * ```ts
   * const route = await client.workers.routes.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    routeId: string,
    params: RouteGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RouteGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/workers/routes/${routeId}`, options) as Core.APIPromise<{
        result: RouteGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class RouteListResponsesSinglePage extends SinglePage<RouteListResponse> {}

export interface RouteCreateResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * Pattern to match incoming requests against.
   * [Learn more](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior).
   */
  pattern: string;

  /**
   * Name of the script to run if the route matches.
   */
  script?: string;
}

export interface RouteUpdateResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * Pattern to match incoming requests against.
   * [Learn more](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior).
   */
  pattern: string;

  /**
   * Name of the script to run if the route matches.
   */
  script?: string;
}

export interface RouteListResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * Pattern to match incoming requests against.
   * [Learn more](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior).
   */
  pattern: string;

  /**
   * Name of the script to run if the route matches.
   */
  script?: string;
}

export interface RouteDeleteResponse {
  /**
   * Identifier.
   */
  id?: string;
}

export interface RouteGetResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * Pattern to match incoming requests against.
   * [Learn more](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior).
   */
  pattern: string;

  /**
   * Name of the script to run if the route matches.
   */
  script?: string;
}

export interface RouteCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Pattern to match incoming requests against.
   * [Learn more](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior).
   */
  pattern: string;

  /**
   * Body param: Name of the script to run if the route matches.
   */
  script?: string;
}

export interface RouteUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Pattern to match incoming requests against.
   * [Learn more](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior).
   */
  pattern: string;

  /**
   * Body param: Name of the script to run if the route matches.
   */
  script?: string;
}

export interface RouteListParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface RouteDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface RouteGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

Routes.RouteListResponsesSinglePage = RouteListResponsesSinglePage;

export declare namespace Routes {
  export {
    type RouteCreateResponse as RouteCreateResponse,
    type RouteUpdateResponse as RouteUpdateResponse,
    type RouteListResponse as RouteListResponse,
    type RouteDeleteResponse as RouteDeleteResponse,
    type RouteGetResponse as RouteGetResponse,
    RouteListResponsesSinglePage as RouteListResponsesSinglePage,
    type RouteCreateParams as RouteCreateParams,
    type RouteUpdateParams as RouteUpdateParams,
    type RouteListParams as RouteListParams,
    type RouteDeleteParams as RouteDeleteParams,
    type RouteGetParams as RouteGetParams,
  };
}
