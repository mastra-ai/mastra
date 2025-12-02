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
exports.CloudforceOne = void 0;
const resource_1 = require("../../resource.js");
const RequestsAPI = __importStar(require("./requests/requests.js"));
const requests_1 = require("./requests/requests.js");
const ScansAPI = __importStar(require("./scans/scans.js"));
const scans_1 = require("./scans/scans.js");
const ThreatEventsAPI = __importStar(require("./threat-events/threat-events.js"));
const threat_events_1 = require("./threat-events/threat-events.js");
class CloudforceOne extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.scans = new ScansAPI.Scans(this._client);
        this.requests = new RequestsAPI.Requests(this._client);
        this.threatEvents = new ThreatEventsAPI.ThreatEvents(this._client);
    }
}
exports.CloudforceOne = CloudforceOne;
CloudforceOne.Scans = scans_1.Scans;
CloudforceOne.Requests = requests_1.Requests;
CloudforceOne.ListItemsSinglePage = requests_1.ListItemsSinglePage;
CloudforceOne.RequestTypesResponsesSinglePage = requests_1.RequestTypesResponsesSinglePage;
CloudforceOne.ThreatEvents = threat_events_1.ThreatEvents;
//# sourceMappingURL=cloudforce-one.js.map