"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Snapshot = void 0;
const resource_1 = require("../../resource.js");
class Snapshot extends resource_1.APIResource {
    /**
     * Returns the page's HTML content and screenshot. Control page loading with
     * `gotoOptions` and `waitFor*` options. Customize screenshots with `viewport`,
     * `fullPage`, `clip` and others.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/snapshot`, {
            query: { cacheTTL },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Snapshot = Snapshot;
//# sourceMappingURL=snapshot.js.map