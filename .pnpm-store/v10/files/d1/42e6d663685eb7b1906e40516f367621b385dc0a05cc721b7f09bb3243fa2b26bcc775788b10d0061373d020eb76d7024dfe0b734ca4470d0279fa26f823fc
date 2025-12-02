"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class Summary extends resource_1.APIResource {
    userAgent(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.userAgent({}, query);
        }
        return this._client.get('/radar/ai/bots/summary/user_agent', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Summary = Summary;
//# sourceMappingURL=summary.js.map