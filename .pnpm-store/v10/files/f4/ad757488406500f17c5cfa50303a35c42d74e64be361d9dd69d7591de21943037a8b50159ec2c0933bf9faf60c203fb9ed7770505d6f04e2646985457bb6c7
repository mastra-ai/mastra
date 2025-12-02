"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Malicious = void 0;
const resource_1 = require("../../../../../../resource.js");
const core_1 = require("../../../../../../core.js");
class Malicious extends resource_1.APIResource {
    get(malicious, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(malicious, {}, query);
        }
        return this._client.get(`/radar/email/security/top/tlds/malicious/${malicious}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Malicious = Malicious;
//# sourceMappingURL=malicious.js.map