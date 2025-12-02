"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissions = void 0;
const resource_1 = require("../../../resource.js");
class Permissions extends resource_1.APIResource {
    /**
     * Grant permission to indicator feed
     *
     * @example
     * ```ts
     * const permission =
     *   await client.intel.indicatorFeeds.permissions.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/intel/indicator-feeds/permissions/add`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List indicator feed permissions
     *
     * @example
     * ```ts
     * const permissions =
     *   await client.intel.indicatorFeeds.permissions.list({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/intel/indicator-feeds/permissions/view`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Revoke permission to indicator feed
     *
     * @example
     * ```ts
     * const permission =
     *   await client.intel.indicatorFeeds.permissions.delete({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    delete(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/intel/indicator-feeds/permissions/remove`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Permissions = Permissions;
//# sourceMappingURL=permissions.js.map