// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Quota extends APIResource {
  /**
   * Lists the number of secrets used in the account.
   *
   * @example
   * ```ts
   * const quota = await client.secretsStore.quota.get({
   *   account_id: '985e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: QuotaGetParams, options?: Core.RequestOptions): Core.APIPromise<QuotaGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/secrets_store/quota`, options) as Core.APIPromise<{
        result: QuotaGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface QuotaGetResponse {
  secrets: QuotaGetResponse.Secrets;
}

export namespace QuotaGetResponse {
  export interface Secrets {
    /**
     * The number of secrets the account is entitlted to use
     */
    quota: number;

    /**
     * The number of secrets the account is currently using
     */
    usage: number;
  }
}

export interface QuotaGetParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

export declare namespace Quota {
  export { type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
