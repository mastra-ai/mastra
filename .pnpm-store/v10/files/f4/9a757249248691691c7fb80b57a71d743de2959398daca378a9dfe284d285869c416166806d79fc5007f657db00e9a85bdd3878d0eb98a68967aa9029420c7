"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Links = void 0;
const resource_1 = require("../../resource.js");
class Links extends resource_1.APIResource {
    /**
     * Get links from a web page.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/links`, {
            query: { cacheTTL },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Links = Links;
//# sourceMappingURL=links.js.map