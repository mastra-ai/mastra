"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SFUListResponsesSinglePage = exports.SFU = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class SFU extends resource_1.APIResource {
    /**
     * Creates a new Cloudflare calls app. An app is an unique enviroment where each
     * Session can access all Tracks within the app.
     *
     * @example
     * ```ts
     * const sfu = await client.calls.sfu.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/calls/apps`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edit details for a single app.
     *
     * @example
     * ```ts
     * const sfu = await client.calls.sfu.update(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(appId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/calls/apps/${appId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all apps in the Cloudflare account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const sfuListResponse of client.calls.sfu.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/calls/apps`, SFUListResponsesSinglePage, options);
    }
    /**
     * Deletes an app from Cloudflare Calls
     *
     * @example
     * ```ts
     * const sfu = await client.calls.sfu.delete(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(appId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/calls/apps/${appId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches details for a single Calls app.
     *
     * @example
     * ```ts
     * const sfu = await client.calls.sfu.get(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(appId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/calls/apps/${appId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.SFU = SFU;
class SFUListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.SFUListResponsesSinglePage = SFUListResponsesSinglePage;
SFU.SFUListResponsesSinglePage = SFUListResponsesSinglePage;
//# sourceMappingURL=sfu.js.map