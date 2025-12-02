"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTP = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const SummaryAPI = __importStar(require("./summary.js"));
const summary_1 = require("./summary.js");
const TimeseriesGroupsAPI = __importStar(require("./timeseries-groups.js"));
const timeseries_groups_1 = require("./timeseries-groups.js");
const TopAPI = __importStar(require("./top.js"));
const top_1 = require("./top.js");
const AsesAPI = __importStar(require("./ases/ases.js"));
const ases_1 = require("./ases/ases.js");
const LocationsAPI = __importStar(require("./locations/locations.js"));
const locations_1 = require("./locations/locations.js");
class HTTP extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.locations = new LocationsAPI.Locations(this._client);
        this.ases = new AsesAPI.Ases(this._client);
        this.summary = new SummaryAPI.Summary(this._client);
        this.timeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(this._client);
        this.top = new TopAPI.Top(this._client);
    }
    timeseries(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/http/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.HTTP = HTTP;
HTTP.Locations = locations_1.Locations;
HTTP.Ases = ases_1.Ases;
HTTP.Summary = summary_1.Summary;
HTTP.TimeseriesGroups = timeseries_groups_1.TimeseriesGroups;
HTTP.Top = top_1.Top;
//# sourceMappingURL=http.js.map