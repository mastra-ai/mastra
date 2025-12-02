// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePagination } from "../../pagination.mjs";
export class Searches extends APIResource {
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
export class SearchListResponsesV4PagePagination extends V4PagePagination {
}
Searches.SearchListResponsesV4PagePagination = SearchListResponsesV4PagePagination;
//# sourceMappingURL=searches.mjs.map