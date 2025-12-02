"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary = void 0;
const resource_1 = require("../../../../../resource.js");
const core_1 = require("../../../../../core.js");
class Summary extends resource_1.APIResource {
    model(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.model({}, query);
        }
        return this._client.get('/radar/ai/inference/timeseries_groups/model', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    task(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.task({}, query);
        }
        return this._client.get('/radar/ai/inference/timeseries_groups/task', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Summary = Summary;
//# sourceMappingURL=summary.js.map