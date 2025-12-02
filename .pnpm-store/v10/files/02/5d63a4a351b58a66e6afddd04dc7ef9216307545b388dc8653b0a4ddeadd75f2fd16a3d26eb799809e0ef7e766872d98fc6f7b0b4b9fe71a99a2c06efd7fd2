"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAgents = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class UserAgents extends resource_1.APIResource {
    directive(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.directive({}, query);
        }
        return this._client.get('/radar/robots_txt/top/user_agents/directive', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.UserAgents = UserAgents;
//# sourceMappingURL=user-agents.js.map