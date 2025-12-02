import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Routes extends APIResource {
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
    create(params: RouteCreateParams, options?: Core.RequestOptions): Core.APIPromise<RouteCreateResponse>;
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
    update(routeId: string, params: RouteUpdateParams, options?: Core.RequestOptions): Core.APIPromise<RouteUpdateResponse>;
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
    list(params: RouteListParams, options?: Core.RequestOptions): Core.PagePromise<RouteListResponsesSinglePage, RouteListResponse>;
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
    delete(routeId: string, params: RouteDeleteParams, options?: Core.RequestOptions): Core.APIPromise<RouteDeleteResponse>;
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
    get(routeId: string, params: RouteGetParams, options?: Core.RequestOptions): Core.APIPromise<RouteGetResponse>;
}
export declare class RouteListResponsesSinglePage extends SinglePage<RouteListResponse> {
}
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
export declare namespace Routes {
    export { type RouteCreateResponse as RouteCreateResponse, type RouteUpdateResponse as RouteUpdateResponse, type RouteListResponse as RouteListResponse, type RouteDeleteResponse as RouteDeleteResponse, type RouteGetResponse as RouteGetResponse, RouteListResponsesSinglePage as RouteListResponsesSinglePage, type RouteCreateParams as RouteCreateParams, type RouteUpdateParams as RouteUpdateParams, type RouteListParams as RouteListParams, type RouteDeleteParams as RouteDeleteParams, type RouteGetParams as RouteGetParams, };
}
//# sourceMappingURL=routes.d.ts.map