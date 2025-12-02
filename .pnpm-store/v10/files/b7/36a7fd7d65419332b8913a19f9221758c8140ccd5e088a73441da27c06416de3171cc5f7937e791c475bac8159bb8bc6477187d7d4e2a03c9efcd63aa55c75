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
exports.DNS = void 0;
const resource_1 = require("../../resource.js");
const DNSSECAPI = __importStar(require("./dnssec.js"));
const dnssec_1 = require("./dnssec.js");
const RecordsAPI = __importStar(require("./records.js"));
const records_1 = require("./records.js");
const AnalyticsAPI = __importStar(require("./analytics/analytics.js"));
const analytics_1 = require("./analytics/analytics.js");
const SettingsAPI = __importStar(require("./settings/settings.js"));
const settings_1 = require("./settings/settings.js");
const ZoneTransfersAPI = __importStar(require("./zone-transfers/zone-transfers.js"));
const zone_transfers_1 = require("./zone-transfers/zone-transfers.js");
class DNS extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.dnssec = new DNSSECAPI.DNSSECResource(this._client);
        this.records = new RecordsAPI.Records(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.analytics = new AnalyticsAPI.Analytics(this._client);
        this.zoneTransfers = new ZoneTransfersAPI.ZoneTransfers(this._client);
    }
}
exports.DNS = DNS;
DNS.DNSSECResource = dnssec_1.DNSSECResource;
DNS.Records = records_1.Records;
DNS.RecordResponsesV4PagePaginationArray = records_1.RecordResponsesV4PagePaginationArray;
DNS.Settings = settings_1.Settings;
DNS.Analytics = analytics_1.Analytics;
DNS.ZoneTransfers = zone_transfers_1.ZoneTransfers;
//# sourceMappingURL=dns.js.map