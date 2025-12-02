"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserFamily = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class BrowserFamily extends resource_1.APIResource {
    get(browserFamily, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(browserFamily, {}, query);
        }
        return this._client.get(`/radar/http/top/ases/browser_family/${browserFamily}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.BrowserFamily = BrowserFamily;
//# sourceMappingURL=browser-family.js.map