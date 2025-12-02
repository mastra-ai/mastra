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
exports.AttackSurfaceReport = void 0;
const resource_1 = require("../../../resource.js");
const IssueTypesAPI = __importStar(require("./issue-types.js"));
const issue_types_1 = require("./issue-types.js");
const IssuesAPI = __importStar(require("./issues.js"));
const issues_1 = require("./issues.js");
class AttackSurfaceReport extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.issueTypes = new IssueTypesAPI.IssueTypes(this._client);
        this.issues = new IssuesAPI.Issues(this._client);
    }
}
exports.AttackSurfaceReport = AttackSurfaceReport;
AttackSurfaceReport.IssueTypes = issue_types_1.IssueTypes;
AttackSurfaceReport.IssueTypeGetResponsesSinglePage = issue_types_1.IssueTypeGetResponsesSinglePage;
AttackSurfaceReport.Issues = issues_1.Issues;
AttackSurfaceReport.IssueListResponsesV4PagePagination = issues_1.IssueListResponsesV4PagePagination;
//# sourceMappingURL=attack-surface-report.js.map