"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Content = void 0;
const resource_1 = require("../../resource.js");
class Content extends resource_1.APIResource {
    /**
     * Fetches rendered HTML content from provided URL or HTML. Check available options
     * like `gotoOptions` and `waitFor*` to control page load behaviour.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/content`, {
            query: { cacheTTL },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Content = Content;
//# sourceMappingURL=content.js.map