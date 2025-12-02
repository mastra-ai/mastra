// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Limits extends APIResource {
  /**
   * Fetch limits associated with DLP for account
   *
   * @example
   * ```ts
   * const limits = await client.zeroTrust.dlp.limits.list({
   *   account_id: 'account_id',
   * });
   * ```
   */
  list(params: LimitListParams, options?: Core.RequestOptions): Core.APIPromise<LimitListResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/dlp/limits`, options) as Core.APIPromise<{
        result: LimitListResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface LimitListResponse {
  max_dataset_cells: number;
}

export interface LimitListParams {
  account_id: string;
}

export declare namespace Limits {
  export { type LimitListResponse as LimitListResponse, type LimitListParams as LimitListParams };
}
