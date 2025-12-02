"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeseriesGroups = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class TimeseriesGroups extends resource_1.APIResource {
    botClass(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.botClass({}, query);
        }
        return this._client.get('/radar/leaked_credential_checks/timeseries_groups/bot_class', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    compromised(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.compromised({}, query);
        }
        return this._client.get('/radar/leaked_credential_checks/timeseries_groups/compromised', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.TimeseriesGroups = TimeseriesGroups;
//# sourceMappingURL=timeseries-groups.js.map