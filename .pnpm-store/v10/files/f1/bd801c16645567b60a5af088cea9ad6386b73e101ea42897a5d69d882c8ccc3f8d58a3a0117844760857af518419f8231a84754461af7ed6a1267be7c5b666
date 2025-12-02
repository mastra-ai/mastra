"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Domain = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class Domain extends resource_1.APIResource {
    get(domain, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(domain, {}, query);
        }
        return this._client.get(`/radar/ranking/domain/${domain}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Domain = Domain;
//# sourceMappingURL=domain.js.map