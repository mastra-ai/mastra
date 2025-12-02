// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class Quota extends APIResource {
  /**
   * Retrieves the current quota usage and limits for device commands within a
   * specific account, including the time when the quota will reset
   *
   * @example
   * ```ts
   * const quota = await client.zeroTrust.dex.commands.quota.get(
   *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
   * );
   * ```
   */
  get(params: QuotaGetParams, options?: Core.RequestOptions): Core.APIPromise<QuotaGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/dex/commands/quota`, options) as Core.APIPromise<{
        result: QuotaGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface QuotaGetResponse {
  /**
   * The remaining number of commands that can be initiated for an account
   */
  quota: number;

  /**
   * The number of commands that have been initiated for an account
   */
  quota_usage: number;

  /**
   * The time when the quota resets
   */
  reset_time: string;
}

export interface QuotaGetParams {
  /**
   * unique identifier linked to an account in the API request path
   */
  account_id: string;
}

export declare namespace Quota {
  export { type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
