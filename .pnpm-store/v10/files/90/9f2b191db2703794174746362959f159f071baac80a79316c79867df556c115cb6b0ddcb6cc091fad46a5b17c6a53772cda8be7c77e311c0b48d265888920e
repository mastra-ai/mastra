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
exports.EmailSecurity = void 0;
const resource_1 = require("../../resource.js");
const SubmissionsAPI = __importStar(require("./submissions.js"));
const submissions_1 = require("./submissions.js");
const InvestigateAPI = __importStar(require("./investigate/investigate.js"));
const investigate_1 = require("./investigate/investigate.js");
const SettingsAPI = __importStar(require("./settings/settings.js"));
const settings_1 = require("./settings/settings.js");
class EmailSecurity extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.investigate = new InvestigateAPI.Investigate(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.submissions = new SubmissionsAPI.Submissions(this._client);
    }
}
exports.EmailSecurity = EmailSecurity;
EmailSecurity.Investigate = investigate_1.Investigate;
EmailSecurity.InvestigateListResponsesV4PagePaginationArray = investigate_1.InvestigateListResponsesV4PagePaginationArray;
EmailSecurity.Settings = settings_1.Settings;
EmailSecurity.Submissions = submissions_1.Submissions;
EmailSecurity.SubmissionListResponsesV4PagePaginationArray = submissions_1.SubmissionListResponsesV4PagePaginationArray;
//# sourceMappingURL=email-security.js.map