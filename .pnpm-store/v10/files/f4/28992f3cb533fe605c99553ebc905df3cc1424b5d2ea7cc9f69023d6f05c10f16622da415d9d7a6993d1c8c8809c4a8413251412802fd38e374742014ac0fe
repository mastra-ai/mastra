// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as PreviewsAPI from "./previews.mjs";
import { Previews, } from "./previews.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Healthchecks extends APIResource {
    constructor() {
        super(...arguments);
        this.previews = new PreviewsAPI.Previews(this._client);
    }
    /**
     * Create a new health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   address: 'www.example.com',
     *   name: 'server-1',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/healthchecks`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a configured health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     address: 'www.example.com',
     *     name: 'server-1',
     *   },
     * );
     * ```
     */
    update(healthcheckId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/healthchecks/${healthcheckId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List configured health checks.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const healthcheck of client.healthchecks.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/healthchecks`, HealthchecksV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Delete a health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(healthcheckId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/healthchecks/${healthcheckId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patch a configured health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     address: 'www.example.com',
     *     name: 'server-1',
     *   },
     * );
     * ```
     */
    edit(healthcheckId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/healthchecks/${healthcheckId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a single configured health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(healthcheckId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/healthchecks/${healthcheckId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class HealthchecksV4PagePaginationArray extends V4PagePaginationArray {
}
Healthchecks.HealthchecksV4PagePaginationArray = HealthchecksV4PagePaginationArray;
Healthchecks.Previews = Previews;
//# sourceMappingURL=healthchecks.mjs.map