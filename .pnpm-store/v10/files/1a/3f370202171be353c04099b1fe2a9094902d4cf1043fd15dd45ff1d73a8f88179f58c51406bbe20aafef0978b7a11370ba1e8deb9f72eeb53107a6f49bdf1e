// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Summary extends APIResource {
  /**
   * Get risk score info for all users in the account
   *
   * @example
   * ```ts
   * const summary =
   *   await client.zeroTrust.riskScoring.summary.get({
   *     account_id: 'account_id',
   *   });
   * ```
   */
  get(params: SummaryGetParams, options?: Core.RequestOptions): Core.APIPromise<SummaryGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/zt_risk_scoring/summary`, options) as Core.APIPromise<{
        result: SummaryGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface SummaryGetResponse {
  users: Array<SummaryGetResponse.User>;
}

export namespace SummaryGetResponse {
  export interface User {
    email: string;

    event_count: number;

    last_event: string;

    max_risk_level: 'low' | 'medium' | 'high';

    name: string;

    user_id: string;
  }
}

export interface SummaryGetParams {
  account_id: string;
}

export declare namespace Summary {
  export { type SummaryGetResponse as SummaryGetResponse, type SummaryGetParams as SummaryGetParams };
}
