"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Top = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class Top extends resource_1.APIResource {
    bots(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.bots({}, query);
        }
        return this._client.get('/radar/verified_bots/top/bots', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    categories(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.categories({}, query);
        }
        return this._client.get('/radar/verified_bots/top/categories', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Top = Top;
//# sourceMappingURL=top.js.map