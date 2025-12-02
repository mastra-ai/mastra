// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as ConfigsAPI from './configs';

export class Full extends APIResource {
  /**
   * Lists default sampling, router IPs, warp devices, and rules for account.
   *
   * @example
   * ```ts
   * const configuration =
   *   await client.magicNetworkMonitoring.configs.full.get({
   *     account_id: '6f91088a406011ed95aed352566e8d4c',
   *   });
   * ```
   */
  get(params: FullGetParams, options?: Core.RequestOptions): Core.APIPromise<ConfigsAPI.Configuration> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/mnm/config/full`, options) as Core.APIPromise<{
        result: ConfigsAPI.Configuration;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface FullGetParams {
  account_id: string;
}

export declare namespace Full {
  export { type FullGetParams as FullGetParams };
}
