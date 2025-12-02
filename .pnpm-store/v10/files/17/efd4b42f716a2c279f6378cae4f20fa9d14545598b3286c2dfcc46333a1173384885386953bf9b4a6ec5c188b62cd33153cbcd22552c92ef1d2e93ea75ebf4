"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchListResponsesV4PagePagination = exports.Searches = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Searches extends resource_1.APIResource {
    /**
     * Search for Load Balancing resources.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const searchListResponse of client.loadBalancers.searches.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/load_balancers/search`, SearchListResponsesV4PagePagination, { query, ...options });
    }
}
exports.Searches = Searches;
class SearchListResponsesV4PagePagination extends pagination_1.V4PagePagination {
}
exports.SearchListResponsesV4PagePagination = SearchListResponsesV4PagePagination;
Searches.SearchListResponsesV4PagePagination = SearchListResponsesV4PagePagination;
//# sourceMappingURL=searches.js.map