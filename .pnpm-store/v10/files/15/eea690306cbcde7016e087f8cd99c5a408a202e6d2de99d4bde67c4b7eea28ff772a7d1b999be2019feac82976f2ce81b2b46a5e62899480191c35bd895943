"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebCrawlers = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class WebCrawlers extends resource_1.APIResource {
    summary(dimension, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.summary(dimension, {}, query);
        }
        return this._client.get(`/radar/bots/crawlers/summary/${dimension}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    timeseriesGroups(dimension, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseriesGroups(dimension, {}, query);
        }
        return this._client.get(`/radar/bots/crawlers/timeseries_groups/${dimension}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.WebCrawlers = WebCrawlers;
//# sourceMappingURL=web-crawlers.js.map