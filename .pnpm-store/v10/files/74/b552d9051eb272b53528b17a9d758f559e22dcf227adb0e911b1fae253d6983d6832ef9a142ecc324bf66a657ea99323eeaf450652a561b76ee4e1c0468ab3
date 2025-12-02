"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockdownsV4PagePaginationArray = exports.Lockdowns = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Lockdowns extends resource_1.APIResource {
    /**
     * Creates a new Zone Lockdown rule.
     *
     * @example
     * ```ts
     * const lockdown = await client.firewall.lockdowns.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   configurations: [{}],
     *   urls: ['shop.example.com/*'],
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/firewall/lockdowns`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing Zone Lockdown rule.
     *
     * @example
     * ```ts
     * const lockdown = await client.firewall.lockdowns.update(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     configurations: [{}],
     *     urls: ['shop.example.com/*'],
     *   },
     * );
     * ```
     */
    update(lockDownsId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/firewall/lockdowns/${lockDownsId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches Zone Lockdown rules. You can filter the results using several optional
     * parameters.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const lockdown of client.firewall.lockdowns.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/lockdowns`, LockdownsV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Deletes an existing Zone Lockdown rule.
     *
     * @example
     * ```ts
     * const lockdown = await client.firewall.lockdowns.delete(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(lockDownsId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/firewall/lockdowns/${lockDownsId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the details of a Zone Lockdown rule.
     *
     * @example
     * ```ts
     * const lockdown = await client.firewall.lockdowns.get(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(lockDownsId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/firewall/lockdowns/${lockDownsId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Lockdowns = Lockdowns;
class LockdownsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.LockdownsV4PagePaginationArray = LockdownsV4PagePaginationArray;
Lockdowns.LockdownsV4PagePaginationArray = LockdownsV4PagePaginationArray;
//# sourceMappingURL=lockdowns.js.map