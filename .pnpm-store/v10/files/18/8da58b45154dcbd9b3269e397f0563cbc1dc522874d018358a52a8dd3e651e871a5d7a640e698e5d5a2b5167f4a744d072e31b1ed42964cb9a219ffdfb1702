"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthchecksV4PagePaginationArray = exports.Healthchecks = void 0;
const resource_1 = require("../../resource.js");
const PreviewsAPI = __importStar(require("./previews.js"));
const previews_1 = require("./previews.js");
const pagination_1 = require("../../pagination.js");
class Healthchecks extends resource_1.APIResource {
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
exports.Healthchecks = Healthchecks;
class HealthchecksV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.HealthchecksV4PagePaginationArray = HealthchecksV4PagePaginationArray;
Healthchecks.HealthchecksV4PagePaginationArray = HealthchecksV4PagePaginationArray;
Healthchecks.Previews = previews_1.Previews;
//# sourceMappingURL=healthchecks.js.map