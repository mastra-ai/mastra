"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorListResponsesSinglePage = exports.Authors = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Authors extends resource_1.APIResource {
    /**
     * Author Search
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai/authors/search`, AuthorListResponsesSinglePage, options);
    }
}
exports.Authors = Authors;
class AuthorListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.AuthorListResponsesSinglePage = AuthorListResponsesSinglePage;
Authors.AuthorListResponsesSinglePage = AuthorListResponsesSinglePage;
//# sourceMappingURL=authors.js.map