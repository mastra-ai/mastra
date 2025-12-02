"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SitesV4PagePaginationArray = exports.SiteInfo = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class SiteInfo extends resource_1.APIResource {
    /**
     * Creates a new Web Analytics site.
     *
     * @example
     * ```ts
     * const site = await client.rum.siteInfo.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/rum/site_info`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing Web Analytics site.
     *
     * @example
     * ```ts
     * const site = await client.rum.siteInfo.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(siteId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/rum/site_info/${siteId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all Web Analytics sites of an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const site of client.rum.siteInfo.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/rum/site_info/list`, SitesV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Deletes an existing Web Analytics site.
     *
     * @example
     * ```ts
     * const siteInfo = await client.rum.siteInfo.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(siteId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/rum/site_info/${siteId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves a Web Analytics site.
     *
     * @example
     * ```ts
     * const site = await client.rum.siteInfo.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(siteId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/rum/site_info/${siteId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.SiteInfo = SiteInfo;
class SitesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.SitesV4PagePaginationArray = SitesV4PagePaginationArray;
SiteInfo.SitesV4PagePaginationArray = SitesV4PagePaginationArray;
//# sourceMappingURL=site-info.js.map