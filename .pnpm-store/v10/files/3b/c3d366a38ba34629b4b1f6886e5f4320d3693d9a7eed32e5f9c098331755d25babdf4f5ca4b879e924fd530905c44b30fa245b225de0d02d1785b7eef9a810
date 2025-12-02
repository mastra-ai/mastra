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
exports.Ranking = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const DomainAPI = __importStar(require("./domain.js"));
const domain_1 = require("./domain.js");
const InternetServicesAPI = __importStar(require("./internet-services.js"));
const internet_services_1 = require("./internet-services.js");
class Ranking extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.domain = new DomainAPI.Domain(this._client);
        this.internetServices = new InternetServicesAPI.InternetServices(this._client);
    }
    timeseriesGroups(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseriesGroups({}, query);
        }
        return this._client.get('/radar/ranking/timeseries_groups', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    top(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.top({}, query);
        }
        return this._client.get('/radar/ranking/top', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Ranking = Ranking;
Ranking.Domain = domain_1.Domain;
Ranking.InternetServices = internet_services_1.InternetServices;
//# sourceMappingURL=ranking.js.map