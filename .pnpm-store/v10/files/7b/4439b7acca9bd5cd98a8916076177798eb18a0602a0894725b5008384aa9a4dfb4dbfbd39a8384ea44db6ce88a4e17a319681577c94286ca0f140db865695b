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
exports.RiskScoring = void 0;
const resource_1 = require("../../../resource.js");
const BehavioursAPI = __importStar(require("./behaviours.js"));
const behaviours_1 = require("./behaviours.js");
const SummaryAPI = __importStar(require("./summary.js"));
const summary_1 = require("./summary.js");
const IntegrationsAPI = __importStar(require("./integrations/integrations.js"));
const integrations_1 = require("./integrations/integrations.js");
class RiskScoring extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.behaviours = new BehavioursAPI.Behaviours(this._client);
        this.summary = new SummaryAPI.Summary(this._client);
        this.integrations = new IntegrationsAPI.Integrations(this._client);
    }
    /**
     * Get risk event/score information for a specific user
     *
     * @example
     * ```ts
     * const riskScoring = await client.zeroTrust.riskScoring.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(userId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/zt_risk_scoring/${userId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Clear the risk score for a particular user
     *
     * @example
     * ```ts
     * const response = await client.zeroTrust.riskScoring.reset(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    reset(userId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/zt_risk_scoring/${userId}/reset`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.RiskScoring = RiskScoring;
RiskScoring.Behaviours = behaviours_1.Behaviours;
RiskScoring.Summary = summary_1.Summary;
RiskScoring.Integrations = integrations_1.Integrations;
RiskScoring.IntegrationListResponsesSinglePage = integrations_1.IntegrationListResponsesSinglePage;
//# sourceMappingURL=risk-scoring.js.map