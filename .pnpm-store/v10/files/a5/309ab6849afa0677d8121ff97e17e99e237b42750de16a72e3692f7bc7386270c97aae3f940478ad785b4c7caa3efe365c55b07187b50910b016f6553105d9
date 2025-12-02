"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANsSinglePage = exports.LANs = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class LANs extends resource_1.APIResource {
    /**
     * Creates a new Site LAN. If the site is in high availability mode,
     * static_addressing is required along with secondary and virtual address.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const lan of client.magicTransit.sites.lans.create(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     physport: 1,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(siteId, params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/sites/${siteId}/lans`, LANsSinglePage, {
            body,
            method: 'post',
            ...options,
        });
    }
    /**
     * Update a specific Site LAN.
     *
     * @example
     * ```ts
     * const lan = await client.magicTransit.sites.lans.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(siteId, lanId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/sites/${siteId}/lans/${lanId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists Site LANs associated with an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const lan of client.magicTransit.sites.lans.list(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(siteId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/sites/${siteId}/lans`, LANsSinglePage, options);
    }
    /**
     * Remove a specific Site LAN.
     *
     * @example
     * ```ts
     * const lan = await client.magicTransit.sites.lans.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(siteId, lanId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/sites/${siteId}/lans/${lanId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patch a specific Site LAN.
     *
     * @example
     * ```ts
     * const lan = await client.magicTransit.sites.lans.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(siteId, lanId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/sites/${siteId}/lans/${lanId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a specific Site LAN.
     *
     * @example
     * ```ts
     * const lan = await client.magicTransit.sites.lans.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(siteId, lanId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/sites/${siteId}/lans/${lanId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.LANs = LANs;
class LANsSinglePage extends pagination_1.SinglePage {
}
exports.LANsSinglePage = LANsSinglePage;
LANs.LANsSinglePage = LANsSinglePage;
//# sourceMappingURL=lans.js.map