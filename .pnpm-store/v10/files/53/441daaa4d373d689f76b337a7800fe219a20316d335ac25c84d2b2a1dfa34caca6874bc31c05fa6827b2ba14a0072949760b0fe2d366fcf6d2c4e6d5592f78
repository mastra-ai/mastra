// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Tokens extends APIResource {
  /**
   * Generate authentication token for VPC flow logs export.
   *
   * @example
   * ```ts
   * const token =
   *   await client.magicNetworkMonitoring.vpcFlows.tokens.create(
   *     { account_id: '6f91088a406011ed95aed352566e8d4c' },
   *   );
   * ```
   */
  create(params: TokenCreateParams, options?: Core.RequestOptions): Core.APIPromise<TokenCreateResponse> {
    const { account_id } = params;
    return (
      this._client.post(`/accounts/${account_id}/mnm/vpc-flows/token`, options) as Core.APIPromise<{
        result: TokenCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Authentication token to be used for VPC Flows export authentication.
 */
export type TokenCreateResponse = string;

export interface TokenCreateParams {
  account_id: string;
}

export declare namespace Tokens {
  export { type TokenCreateResponse as TokenCreateResponse, type TokenCreateParams as TokenCreateParams };
}
