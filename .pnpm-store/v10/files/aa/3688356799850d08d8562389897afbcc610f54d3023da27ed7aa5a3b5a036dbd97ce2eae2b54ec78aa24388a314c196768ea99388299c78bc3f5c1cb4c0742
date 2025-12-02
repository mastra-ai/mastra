// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Categories extends APIResource {
    /**
     * Fetches a list of all categories.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const category of client.zeroTrust.gateway.categories.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/gateway/categories`, CategoriesSinglePage, options);
    }
}
export class CategoriesSinglePage extends SinglePage {
}
Categories.CategoriesSinglePage = CategoriesSinglePage;
//# sourceMappingURL=categories.mjs.map