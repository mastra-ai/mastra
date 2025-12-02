// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Unrevoke extends APIResource {
  /**
   * Unrevokes a list of devices. Not supported when
   * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
   * is enabled.
   *
   * **Deprecated**: please use POST
   * /accounts/{account_id}/devices/registrations/unrevoke instead.
   *
   * @deprecated
   */
  create(
    params: UnrevokeCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<UnrevokeCreateResponse | null> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/devices/unrevoke`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: UnrevokeCreateResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type UnrevokeCreateResponse = unknown | string;

export interface UnrevokeCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: A list of Registration IDs to unrevoke.
   */
  body: Array<string>;
}

export declare namespace Unrevoke {
  export {
    type UnrevokeCreateResponse as UnrevokeCreateResponse,
    type UnrevokeCreateParams as UnrevokeCreateParams,
  };
}
