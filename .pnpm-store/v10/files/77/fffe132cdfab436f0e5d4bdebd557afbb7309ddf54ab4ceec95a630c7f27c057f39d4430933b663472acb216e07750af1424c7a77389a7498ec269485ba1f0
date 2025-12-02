import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as BehavioursAPI from "./behaviours.js";
import { BehaviourGetParams, BehaviourGetResponse, BehaviourUpdateParams, BehaviourUpdateResponse, Behaviours } from "./behaviours.js";
import * as SummaryAPI from "./summary.js";
import { Summary, SummaryGetParams, SummaryGetResponse } from "./summary.js";
import * as IntegrationsAPI from "./integrations/integrations.js";
import { IntegrationCreateParams, IntegrationCreateResponse, IntegrationDeleteParams, IntegrationDeleteResponse, IntegrationGetParams, IntegrationGetResponse, IntegrationListParams, IntegrationListResponse, IntegrationListResponsesSinglePage, IntegrationUpdateParams, IntegrationUpdateResponse, Integrations } from "./integrations/integrations.js";
export declare class RiskScoring extends APIResource {
    behaviours: BehavioursAPI.Behaviours;
    summary: SummaryAPI.Summary;
    integrations: IntegrationsAPI.Integrations;
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
    get(userId: string, params: RiskScoringGetParams, options?: Core.RequestOptions): Core.APIPromise<RiskScoringGetResponse>;
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
    reset(userId: string, params: RiskScoringResetParams, options?: Core.RequestOptions): Core.APIPromise<RiskScoringResetResponse | null>;
}
export interface RiskScoringGetResponse {
    email: string;
    events: Array<RiskScoringGetResponse.Event>;
    name: string;
    last_reset_time?: string | null;
    risk_level?: 'low' | 'medium' | 'high';
}
export declare namespace RiskScoringGetResponse {
    interface Event {
        id: string;
        name: string;
        risk_level: 'low' | 'medium' | 'high';
        timestamp: string;
        event_details?: unknown;
    }
}
export type RiskScoringResetResponse = unknown;
export interface RiskScoringGetParams {
    account_id: string;
}
export interface RiskScoringResetParams {
    account_id: string;
}
export declare namespace RiskScoring {
    export { type RiskScoringGetResponse as RiskScoringGetResponse, type RiskScoringResetResponse as RiskScoringResetResponse, type RiskScoringGetParams as RiskScoringGetParams, type RiskScoringResetParams as RiskScoringResetParams, };
    export { Behaviours as Behaviours, type BehaviourUpdateResponse as BehaviourUpdateResponse, type BehaviourGetResponse as BehaviourGetResponse, type BehaviourUpdateParams as BehaviourUpdateParams, type BehaviourGetParams as BehaviourGetParams, };
    export { Summary as Summary, type SummaryGetResponse as SummaryGetResponse, type SummaryGetParams as SummaryGetParams, };
    export { Integrations as Integrations, type IntegrationCreateResponse as IntegrationCreateResponse, type IntegrationUpdateResponse as IntegrationUpdateResponse, type IntegrationListResponse as IntegrationListResponse, type IntegrationDeleteResponse as IntegrationDeleteResponse, type IntegrationGetResponse as IntegrationGetResponse, IntegrationListResponsesSinglePage as IntegrationListResponsesSinglePage, type IntegrationCreateParams as IntegrationCreateParams, type IntegrationUpdateParams as IntegrationUpdateParams, type IntegrationListParams as IntegrationListParams, type IntegrationDeleteParams as IntegrationDeleteParams, type IntegrationGetParams as IntegrationGetParams, };
}
//# sourceMappingURL=risk-scoring.d.ts.map