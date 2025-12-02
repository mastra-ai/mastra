"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scrape = void 0;
const resource_1 = require("../../resource.js");
class Scrape extends resource_1.APIResource {
    /**
     * Get meta attributes like height, width, text and others of selected elements.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/scrape`, {
            query: { cacheTTL },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Scrape = Scrape;
//# sourceMappingURL=scrape.js.map