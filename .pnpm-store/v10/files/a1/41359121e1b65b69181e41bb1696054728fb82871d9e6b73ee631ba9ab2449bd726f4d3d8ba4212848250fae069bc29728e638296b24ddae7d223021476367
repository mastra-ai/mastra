"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicListResponsesSinglePage = exports.Public = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Public extends resource_1.APIResource {
    /**
     * List Public Finetunes
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai/finetunes/public`, PublicListResponsesSinglePage, { query, ...options });
    }
}
exports.Public = Public;
class PublicListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PublicListResponsesSinglePage = PublicListResponsesSinglePage;
Public.PublicListResponsesSinglePage = PublicListResponsesSinglePage;
//# sourceMappingURL=public.js.map