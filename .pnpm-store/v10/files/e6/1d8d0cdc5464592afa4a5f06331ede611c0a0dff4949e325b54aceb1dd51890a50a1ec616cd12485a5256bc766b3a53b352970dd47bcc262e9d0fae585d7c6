"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomPageWithoutHTMLsSinglePage = exports.CustomPages = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class CustomPages extends resource_1.APIResource {
    /**
     * Create a custom page
     *
     * @example
     * ```ts
     * const customPageWithoutHTML =
     *   await client.zeroTrust.access.customPages.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     custom_html:
     *       '<html><body><h1>Access Denied</h1></body></html>',
     *     name: 'name',
     *     type: 'identity_denied',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/access/custom_pages`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a custom page
     *
     * @example
     * ```ts
     * const customPageWithoutHTML =
     *   await client.zeroTrust.access.customPages.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       custom_html:
     *         '<html><body><h1>Access Denied</h1></body></html>',
     *       name: 'name',
     *       type: 'identity_denied',
     *     },
     *   );
     * ```
     */
    update(customPageId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/access/custom_pages/${customPageId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List custom pages
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customPageWithoutHTML of client.zeroTrust.access.customPages.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/custom_pages`, CustomPageWithoutHTMLsSinglePage, options);
    }
    /**
     * Delete a custom page
     *
     * @example
     * ```ts
     * const customPage =
     *   await client.zeroTrust.access.customPages.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(customPageId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/access/custom_pages/${customPageId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a custom page and also returns its HTML.
     *
     * @example
     * ```ts
     * const customPage =
     *   await client.zeroTrust.access.customPages.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(customPageId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/custom_pages/${customPageId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.CustomPages = CustomPages;
class CustomPageWithoutHTMLsSinglePage extends pagination_1.SinglePage {
}
exports.CustomPageWithoutHTMLsSinglePage = CustomPageWithoutHTMLsSinglePage;
CustomPages.CustomPageWithoutHTMLsSinglePage = CustomPageWithoutHTMLsSinglePage;
//# sourceMappingURL=custom-pages.js.map