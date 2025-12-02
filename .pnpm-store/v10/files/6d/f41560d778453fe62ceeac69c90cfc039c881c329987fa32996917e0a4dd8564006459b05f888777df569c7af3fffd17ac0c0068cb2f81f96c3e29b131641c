// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Revoke extends APIResource {
  /**
   * Revokes a list of devices. Not supported when
   * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
   * is enabled.
   *
   * **Deprecated**: please use POST
   * /accounts/{account_id}/devices/registrations/revoke instead.
   *
   * @deprecated
   */
  create(
    params: RevokeCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RevokeCreateResponse | null> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/devices/revoke`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: RevokeCreateResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type RevokeCreateResponse = unknown | string;

export interface RevokeCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: A list of Registration IDs to revoke.
   */
  body: Array<string>;
}

export declare namespace Revoke {
  export { type RevokeCreateResponse as RevokeCreateResponse, type RevokeCreateParams as RevokeCreateParams };
}
