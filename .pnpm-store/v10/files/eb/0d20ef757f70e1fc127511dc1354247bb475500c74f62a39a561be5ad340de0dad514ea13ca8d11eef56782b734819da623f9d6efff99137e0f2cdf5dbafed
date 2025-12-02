"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spam = void 0;
const resource_1 = require("../../../../../../resource.js");
const core_1 = require("../../../../../../core.js");
class Spam extends resource_1.APIResource {
    get(spam, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(spam, {}, query);
        }
        return this._client.get(`/radar/email/security/top/tlds/spam/${spam}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Spam = Spam;
//# sourceMappingURL=spam.js.map