// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as Shared from '../../shared';

export class Value extends APIResource {
  /**
   * Roll the Account Owned API token secret.
   *
   * @example
   * ```ts
   * const tokenValue =
   *   await client.accounts.tokens.value.update(
   *     'ed17574386854bf78a67040be0a770b0',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       body: {},
   *     },
   *   );
   * ```
   */
  update(
    tokenId: string,
    params: ValueUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Shared.TokenValue> {
    const { account_id, body } = params;
    return (
      this._client.put(`/accounts/${account_id}/tokens/${tokenId}/value`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: Shared.TokenValue }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ValueUpdateParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export declare namespace Value {
  export { type ValueUpdateParams as ValueUpdateParams };
}
