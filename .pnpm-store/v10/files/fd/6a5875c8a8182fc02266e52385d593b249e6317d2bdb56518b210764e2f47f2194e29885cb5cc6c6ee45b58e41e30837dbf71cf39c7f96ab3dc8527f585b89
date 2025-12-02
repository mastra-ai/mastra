// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as BehavioursAPI from "./behaviours.mjs";
import { Behaviours, } from "./behaviours.mjs";
import * as SummaryAPI from "./summary.mjs";
import { Summary } from "./summary.mjs";
import * as IntegrationsAPI from "./integrations/integrations.mjs";
import { IntegrationListResponsesSinglePage, Integrations, } from "./integrations/integrations.mjs";
export class RiskScoring extends APIResource {
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
RiskScoring.Behaviours = Behaviours;
RiskScoring.Summary = Summary;
RiskScoring.Integrations = Integrations;
RiskScoring.IntegrationListResponsesSinglePage = IntegrationListResponsesSinglePage;
//# sourceMappingURL=risk-scoring.mjs.map