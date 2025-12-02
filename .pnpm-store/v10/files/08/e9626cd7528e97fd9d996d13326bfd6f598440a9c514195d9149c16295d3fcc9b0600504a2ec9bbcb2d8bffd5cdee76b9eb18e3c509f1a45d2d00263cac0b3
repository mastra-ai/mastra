"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spoof = void 0;
const resource_1 = require("../../../../../../resource.js");
const core_1 = require("../../../../../../core.js");
class Spoof extends resource_1.APIResource {
    get(spoof, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(spoof, {}, query);
        }
        return this._client.get(`/radar/email/security/top/tlds/spoof/${spoof}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Spoof = Spoof;
//# sourceMappingURL=spoof.js.map