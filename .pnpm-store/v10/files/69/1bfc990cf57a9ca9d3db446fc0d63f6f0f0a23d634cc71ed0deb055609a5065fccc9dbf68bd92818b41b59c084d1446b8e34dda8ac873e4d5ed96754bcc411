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
exports.InsightListResponsesV4PagePagination = exports.Insights = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const ClassAPI = __importStar(require("./class.js"));
const class_1 = require("./class.js");
const SeverityAPI = __importStar(require("./severity.js"));
const severity_1 = require("./severity.js");
const TypeAPI = __importStar(require("./type.js"));
const type_1 = require("./type.js");
const error_1 = require("../../../error.js");
const pagination_1 = require("../../../pagination.js");
class Insights extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.class = new ClassAPI.Class(this._client);
        this.severity = new SeverityAPI.Severity(this._client);
        this.type = new TypeAPI.Type(this._client);
    }
    list(params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id, ...query } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/security-center/insights`, InsightListResponsesV4PagePagination, { query, ...options });
    }
    /**
     * Archive Security Center Insight
     */
    dismiss(issueId, params, options) {
        const { account_id, zone_id, ...body } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/security-center/insights/${issueId}/dismiss`, { body, ...options });
    }
}
exports.Insights = Insights;
class InsightListResponsesV4PagePagination extends pagination_1.V4PagePagination {
}
exports.InsightListResponsesV4PagePagination = InsightListResponsesV4PagePagination;
Insights.InsightListResponsesV4PagePagination = InsightListResponsesV4PagePagination;
Insights.Class = class_1.Class;
Insights.Severity = severity_1.Severity;
Insights.Type = type_1.Type;
//# sourceMappingURL=insights.js.map