"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Status = void 0;
const resource_1 = require("../resource.js");
const core_1 = require("../core.js");
class Status extends resource_1.APIResource {
    getStatus(body = {}, options) {
        if ((0, core_1.isRequestOptions)(body)) {
            return this.getStatus({}, body);
        }
        return this._client.post('/status/get-status', { body, ...options });
    }
}
exports.Status = Status;
//# sourceMappingURL=status.js.map