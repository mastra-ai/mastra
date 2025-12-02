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
exports.DLP = void 0;
const resource_1 = require("../../../resource.js");
const LimitsAPI = __importStar(require("./limits.js"));
const limits_1 = require("./limits.js");
const PatternsAPI = __importStar(require("./patterns.js"));
const patterns_1 = require("./patterns.js");
const PayloadLogsAPI = __importStar(require("./payload-logs.js"));
const payload_logs_1 = require("./payload-logs.js");
const DatasetsAPI = __importStar(require("./datasets/datasets.js"));
const datasets_1 = require("./datasets/datasets.js");
const EmailAPI = __importStar(require("./email/email.js"));
const email_1 = require("./email/email.js");
const EntriesAPI = __importStar(require("./entries/entries.js"));
const entries_1 = require("./entries/entries.js");
const ProfilesAPI = __importStar(require("./profiles/profiles.js"));
const profiles_1 = require("./profiles/profiles.js");
class DLP extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.datasets = new DatasetsAPI.Datasets(this._client);
        this.patterns = new PatternsAPI.Patterns(this._client);
        this.payloadLogs = new PayloadLogsAPI.PayloadLogs(this._client);
        this.email = new EmailAPI.Email(this._client);
        this.profiles = new ProfilesAPI.Profiles(this._client);
        this.limits = new LimitsAPI.Limits(this._client);
        this.entries = new EntriesAPI.Entries(this._client);
    }
}
exports.DLP = DLP;
DLP.Datasets = datasets_1.Datasets;
DLP.DatasetsSinglePage = datasets_1.DatasetsSinglePage;
DLP.Patterns = patterns_1.Patterns;
DLP.PayloadLogs = payload_logs_1.PayloadLogs;
DLP.Email = email_1.Email;
DLP.Profiles = profiles_1.Profiles;
DLP.ProfilesSinglePage = profiles_1.ProfilesSinglePage;
DLP.Limits = limits_1.Limits;
DLP.Entries = entries_1.Entries;
DLP.EntryListResponsesSinglePage = entries_1.EntryListResponsesSinglePage;
//# sourceMappingURL=dlp.js.map