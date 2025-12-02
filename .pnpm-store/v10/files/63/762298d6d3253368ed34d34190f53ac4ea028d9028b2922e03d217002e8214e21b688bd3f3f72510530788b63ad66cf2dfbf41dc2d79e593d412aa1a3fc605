"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Screenshot = void 0;
const resource_1 = require("../../resource.js");
class Screenshot extends resource_1.APIResource {
    /**
     * Takes a screenshot of a webpage from provided URL or HTML. Control page loading
     * with `gotoOptions` and `waitFor*` options. Customize screenshots with
     * `viewport`, `fullPage`, `clip` and others.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/screenshot`, {
            query: { cacheTTL },
            body,
            ...options,
        });
    }
}
exports.Screenshot = Screenshot;
//# sourceMappingURL=screenshot.js.map