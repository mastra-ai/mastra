"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColoListResponsesSinglePage = exports.Colos = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Colos extends resource_1.APIResource {
    /**
     * List Cloudflare colos that account's devices were connected to during a time
     * period, sorted by usage starting from the most used colo. Colos without traffic
     * are also returned and sorted alphabetically.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const coloListResponse of client.zeroTrust.dex.colos.list(
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     from: '2023-08-20T20:45:00Z',
     *     to: '2023-08-24T20:45:00Z',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dex/colos`, ColoListResponsesSinglePage, {
            query,
            ...options,
        });
    }
}
exports.Colos = Colos;
class ColoListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ColoListResponsesSinglePage = ColoListResponsesSinglePage;
Colos.ColoListResponsesSinglePage = ColoListResponsesSinglePage;
//# sourceMappingURL=colos.js.map