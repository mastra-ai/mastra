// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Results extends APIResource {
  /**
   * Get the Latest Scan Result
   *
   * @example
   * ```ts
   * const result = await client.cloudforceOne.scans.results.get(
   *   'config_id',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    configId: string,
    params: ResultGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResultGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/cloudforce-one/scans/results/${configId}`,
        options,
      ) as Core.APIPromise<{ result: ResultGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ScanResult {
  number?: number;

  proto?: string;

  status?: string;
}

export interface ResultGetResponse {
  '1.1.1.1': Array<ScanResult>;
}

export interface ResultGetParams {
  /**
   * Defines the Account ID.
   */
  account_id: string;
}

export declare namespace Results {
  export {
    type ScanResult as ScanResult,
    type ResultGetResponse as ResultGetResponse,
    type ResultGetParams as ResultGetParams,
  };
}
