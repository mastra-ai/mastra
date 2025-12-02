// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as RoutesAPI from './routes';

export class IPs extends APIResource {
  /**
   * Fetches routes that contain the given IP address.
   *
   * @example
   * ```ts
   * const teamnet =
   *   await client.zeroTrust.networks.routes.ips.get(
   *     '10.1.0.137',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  get(ip: string, params: IPGetParams, options?: Core.RequestOptions): Core.APIPromise<RoutesAPI.Teamnet> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/teamnet/routes/ip/${ip}`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: RoutesAPI.Teamnet }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface IPGetParams {
  /**
   * Path param: Cloudflare account ID
   */
  account_id: string;

  /**
   * Query param: When the virtual_network_id parameter is not provided the request
   * filter will default search routes that are in the default virtual network for
   * the account. If this parameter is set to false, the search will include routes
   * that do not have a virtual network.
   */
  default_virtual_network_fallback?: boolean;

  /**
   * Query param: UUID of the virtual network.
   */
  virtual_network_id?: string;
}

export declare namespace IPs {
  export { type IPGetParams as IPGetParams };
}
