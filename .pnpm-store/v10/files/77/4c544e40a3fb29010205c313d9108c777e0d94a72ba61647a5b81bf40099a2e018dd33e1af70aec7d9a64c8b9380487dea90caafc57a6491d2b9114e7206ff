"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesSinglePage = exports.Categories = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Categories extends resource_1.APIResource {
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
exports.Categories = Categories;
class CategoriesSinglePage extends pagination_1.SinglePage {
}
exports.CategoriesSinglePage = CategoriesSinglePage;
Categories.CategoriesSinglePage = CategoriesSinglePage;
//# sourceMappingURL=categories.js.map