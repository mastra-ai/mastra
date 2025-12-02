// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Routes extends APIResource {
    /**
     * Creates a new Magic static route. Use `?validate_only=true` as an optional query
     * parameter to run validation only without persisting changes.
     *
     * @example
     * ```ts
     * const route = await client.magicTransit.routes.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   nexthop: '203.0.113.1',
     *   prefix: '192.0.2.0/24',
     *   priority: 0,
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/routes`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a specific Magic static route. Use `?validate_only=true` as an optional
     * query parameter to run validation only without persisting changes.
     *
     * @example
     * ```ts
     * const route = await client.magicTransit.routes.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     nexthop: '203.0.113.1',
     *     prefix: '192.0.2.0/24',
     *     priority: 0,
     *   },
     * );
     * ```
     */
    update(routeId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/routes/${routeId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all Magic static routes.
     *
     * @example
     * ```ts
     * const routes = await client.magicTransit.routes.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/routes`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Disable and remove a specific Magic static route.
     *
     * @example
     * ```ts
     * const route = await client.magicTransit.routes.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(routeId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/routes/${routeId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update multiple Magic static routes. Use `?validate_only=true` as an optional
     * query parameter to run validation only without persisting changes. Only fields
     * for a route that need to be changed need be provided.
     *
     * @example
     * ```ts
     * const response =
     *   await client.magicTransit.routes.bulkUpdate({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     routes: [
     *       {
     *         id: '023e105f4ecef8ad9ca31a8372d0c353',
     *         nexthop: '203.0.113.1',
     *         prefix: '192.0.2.0/24',
     *         priority: 0,
     *       },
     *     ],
     *   });
     * ```
     */
    bulkUpdate(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/routes`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete multiple Magic static routes.
     *
     * @example
     * ```ts
     * const response = await client.magicTransit.routes.empty({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    empty(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/routes`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a specific Magic static route.
     *
     * @example
     * ```ts
     * const route = await client.magicTransit.routes.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(routeId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/routes/${routeId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=routes.mjs.map