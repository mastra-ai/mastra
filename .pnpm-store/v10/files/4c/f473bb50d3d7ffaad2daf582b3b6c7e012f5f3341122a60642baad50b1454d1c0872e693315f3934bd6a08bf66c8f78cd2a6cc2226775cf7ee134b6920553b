"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppListResponsesSinglePage = exports.Apps = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Apps extends resource_1.APIResource {
    /**
     * Creates a new App for an account
     *
     * @example
     * ```ts
     * const app = await client.magicTransit.apps.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'Cloudflare Dashboard',
     *   type: 'Development',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/apps`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an Account App
     *
     * @example
     * ```ts
     * const app = await client.magicTransit.apps.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(accountAppId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/apps/${accountAppId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists Apps associated with an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const appListResponse of client.magicTransit.apps.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/apps`, AppListResponsesSinglePage, options);
    }
    /**
     * Deletes specific Account App.
     *
     * @example
     * ```ts
     * const app = await client.magicTransit.apps.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(accountAppId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/apps/${accountAppId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an Account App
     *
     * @example
     * ```ts
     * const response = await client.magicTransit.apps.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(accountAppId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/apps/${accountAppId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Apps = Apps;
class AppListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.AppListResponsesSinglePage = AppListResponsesSinglePage;
Apps.AppListResponsesSinglePage = AppListResponsesSinglePage;
//# sourceMappingURL=apps.js.map