// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as BehavioursAPI from './behaviours';
import {
  BehaviourGetParams,
  BehaviourGetResponse,
  BehaviourUpdateParams,
  BehaviourUpdateResponse,
  Behaviours,
} from './behaviours';
import * as SummaryAPI from './summary';
import { Summary, SummaryGetParams, SummaryGetResponse } from './summary';
import * as IntegrationsAPI from './integrations/integrations';
import {
  IntegrationCreateParams,
  IntegrationCreateResponse,
  IntegrationDeleteParams,
  IntegrationDeleteResponse,
  IntegrationGetParams,
  IntegrationGetResponse,
  IntegrationListParams,
  IntegrationListResponse,
  IntegrationListResponsesSinglePage,
  IntegrationUpdateParams,
  IntegrationUpdateResponse,
  Integrations,
} from './integrations/integrations';

export class RiskScoring extends APIResource {
  behaviours: BehavioursAPI.Behaviours = new BehavioursAPI.Behaviours(this._client);
  summary: SummaryAPI.Summary = new SummaryAPI.Summary(this._client);
  integrations: IntegrationsAPI.Integrations = new IntegrationsAPI.Integrations(this._client);

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
  get(
    userId: string,
    params: RiskScoringGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RiskScoringGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/zt_risk_scoring/${userId}`, options) as Core.APIPromise<{
        result: RiskScoringGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
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
  reset(
    userId: string,
    params: RiskScoringResetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RiskScoringResetResponse | null> {
    const { account_id } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/zt_risk_scoring/${userId}/reset`,
        options,
      ) as Core.APIPromise<{ result: RiskScoringResetResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface RiskScoringGetResponse {
  email: string;

  events: Array<RiskScoringGetResponse.Event>;

  name: string;

  last_reset_time?: string | null;

  risk_level?: 'low' | 'medium' | 'high';
}

export namespace RiskScoringGetResponse {
  export interface Event {
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

RiskScoring.Behaviours = Behaviours;
RiskScoring.Summary = Summary;
RiskScoring.Integrations = Integrations;
RiskScoring.IntegrationListResponsesSinglePage = IntegrationListResponsesSinglePage;

export declare namespace RiskScoring {
  export {
    type RiskScoringGetResponse as RiskScoringGetResponse,
    type RiskScoringResetResponse as RiskScoringResetResponse,
    type RiskScoringGetParams as RiskScoringGetParams,
    type RiskScoringResetParams as RiskScoringResetParams,
  };

  export {
    Behaviours as Behaviours,
    type BehaviourUpdateResponse as BehaviourUpdateResponse,
    type BehaviourGetResponse as BehaviourGetResponse,
    type BehaviourUpdateParams as BehaviourUpdateParams,
    type BehaviourGetParams as BehaviourGetParams,
  };

  export {
    Summary as Summary,
    type SummaryGetResponse as SummaryGetResponse,
    type SummaryGetParams as SummaryGetParams,
  };

  export {
    Integrations as Integrations,
    type IntegrationCreateResponse as IntegrationCreateResponse,
    type IntegrationUpdateResponse as IntegrationUpdateResponse,
    type IntegrationListResponse as IntegrationListResponse,
    type IntegrationDeleteResponse as IntegrationDeleteResponse,
    type IntegrationGetResponse as IntegrationGetResponse,
    IntegrationListResponsesSinglePage as IntegrationListResponsesSinglePage,
    type IntegrationCreateParams as IntegrationCreateParams,
    type IntegrationUpdateParams as IntegrationUpdateParams,
    type IntegrationListParams as IntegrationListParams,
    type IntegrationDeleteParams as IntegrationDeleteParams,
    type IntegrationGetParams as IntegrationGetParams,
  };
}
