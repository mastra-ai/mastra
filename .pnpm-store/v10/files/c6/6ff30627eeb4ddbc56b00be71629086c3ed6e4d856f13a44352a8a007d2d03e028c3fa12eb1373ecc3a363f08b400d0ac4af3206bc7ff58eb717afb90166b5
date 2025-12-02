// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
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
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/workers/routes`, { body, ...options })._thenUnwrap((obj) => obj.result);
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
    update(routeId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/workers/routes/${routeId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
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
    list(params, options) {
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
    delete(routeId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/workers/routes/${routeId}`, options)._thenUnwrap((obj) => obj.result);
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
    get(routeId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/workers/routes/${routeId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class RouteListResponsesSinglePage extends SinglePage {
}
Routes.RouteListResponsesSinglePage = RouteListResponsesSinglePage;
//# sourceMappingURL=routes.mjs.map