"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Json = void 0;
const resource_1 = require("../../resource.js");
class Json extends resource_1.APIResource {
    /**
     * Gets json from a webpage from a provided URL or HTML. Pass `prompt` or `schema`
     * in the body. Control page loading with `gotoOptions` and `waitFor*` options.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/json`, {
            query: { cacheTTL },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Json = Json;
//# sourceMappingURL=json.js.map