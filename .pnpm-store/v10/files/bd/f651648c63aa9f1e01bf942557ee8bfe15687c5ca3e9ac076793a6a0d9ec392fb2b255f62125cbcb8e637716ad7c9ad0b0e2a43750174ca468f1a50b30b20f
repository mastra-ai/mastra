"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TCPResetsTimeouts = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
class TCPResetsTimeouts extends resource_1.APIResource {
    summary(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.summary({}, query);
        }
        return this._client.get('/radar/tcp_resets_timeouts/summary', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    timeseriesGroups(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseriesGroups({}, query);
        }
        return this._client.get('/radar/tcp_resets_timeouts/timeseries_groups', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.TCPResetsTimeouts = TCPResetsTimeouts;
//# sourceMappingURL=tcp-resets-timeouts.js.map