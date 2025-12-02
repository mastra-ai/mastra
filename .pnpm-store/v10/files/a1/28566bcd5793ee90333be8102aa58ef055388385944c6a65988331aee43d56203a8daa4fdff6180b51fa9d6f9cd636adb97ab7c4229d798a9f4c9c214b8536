"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Previews = void 0;
const resource_1 = require("../../resource.js");
class Previews extends resource_1.APIResource {
    /**
     * Create a new preview health check.
     *
     * @example
     * ```ts
     * const healthcheck =
     *   await client.healthchecks.previews.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     address: 'www.example.com',
     *     name: 'server-1',
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/healthchecks/preview`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete a health check.
     *
     * @example
     * ```ts
     * const preview = await client.healthchecks.previews.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(healthcheckId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/healthchecks/preview/${healthcheckId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a single configured health check preview.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.previews.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(healthcheckId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/healthchecks/preview/${healthcheckId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Previews = Previews;
//# sourceMappingURL=previews.js.map