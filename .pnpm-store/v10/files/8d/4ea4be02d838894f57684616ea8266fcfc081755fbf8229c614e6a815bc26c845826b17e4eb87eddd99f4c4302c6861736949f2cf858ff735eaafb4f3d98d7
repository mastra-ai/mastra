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
exports.Alerting = void 0;
const resource_1 = require("../../resource.js");
const AvailableAlertsAPI = __importStar(require("./available-alerts.js"));
const available_alerts_1 = require("./available-alerts.js");
const HistoryAPI = __importStar(require("./history.js"));
const history_1 = require("./history.js");
const PoliciesAPI = __importStar(require("./policies.js"));
const policies_1 = require("./policies.js");
const DestinationsAPI = __importStar(require("./destinations/destinations.js"));
const destinations_1 = require("./destinations/destinations.js");
class Alerting extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.availableAlerts = new AvailableAlertsAPI.AvailableAlerts(this._client);
        this.destinations = new DestinationsAPI.Destinations(this._client);
        this.history = new HistoryAPI.HistoryResource(this._client);
        this.policies = new PoliciesAPI.Policies(this._client);
    }
}
exports.Alerting = Alerting;
Alerting.AvailableAlerts = available_alerts_1.AvailableAlerts;
Alerting.Destinations = destinations_1.Destinations;
Alerting.HistoryResource = history_1.HistoryResource;
Alerting.HistoriesV4PagePaginationArray = history_1.HistoriesV4PagePaginationArray;
Alerting.Policies = policies_1.Policies;
Alerting.PoliciesSinglePage = policies_1.PoliciesSinglePage;
//# sourceMappingURL=alerting.js.map