"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CookieListResponsesSinglePage = exports.Cookies = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Cookies extends resource_1.APIResource {
    /**
     * Lists all cookies collected by Page Shield.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const cookieListResponse of client.pageShield.cookies.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/page_shield/cookies`, CookieListResponsesSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Fetches a cookie collected by Page Shield by cookie ID.
     *
     * @example
     * ```ts
     * const cookie = await client.pageShield.cookies.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(cookieId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/page_shield/cookies/${cookieId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Cookies = Cookies;
class CookieListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.CookieListResponsesSinglePage = CookieListResponsesSinglePage;
Cookies.CookieListResponsesSinglePage = CookieListResponsesSinglePage;
//# sourceMappingURL=cookies.js.map