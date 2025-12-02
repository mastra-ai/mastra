"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Markdown = void 0;
const resource_1 = require("../../resource.js");
class Markdown extends resource_1.APIResource {
    /**
     * Gets markdown of a webpage from provided URL or HTML. Control page loading with
     * `gotoOptions` and `waitFor*` options.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/markdown`, {
            query: { cacheTTL },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Markdown = Markdown;
//# sourceMappingURL=markdown.js.map