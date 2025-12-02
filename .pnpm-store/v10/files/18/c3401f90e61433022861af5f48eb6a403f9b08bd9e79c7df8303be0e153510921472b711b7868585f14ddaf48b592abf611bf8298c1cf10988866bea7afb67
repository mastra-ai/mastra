// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as OutgoingAPI from './outgoing';

export class Status extends APIResource {
  /**
   * Get primary zone transfer status.
   *
   * @example
   * ```ts
   * const enableTransfer =
   *   await client.dns.zoneTransfers.outgoing.status.get({
   *     zone_id: '269d8f4853475ca241c4e730be286b20',
   *   });
   * ```
   */
  get(params: StatusGetParams, options?: Core.RequestOptions): Core.APIPromise<OutgoingAPI.EnableTransfer> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/secondary_dns/outgoing/status`, options) as Core.APIPromise<{
        result: OutgoingAPI.EnableTransfer;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface StatusGetParams {
  zone_id: string;
}

export declare namespace Status {
  export { type StatusGetParams as StatusGetParams };
}
