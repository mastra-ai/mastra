// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as Shared from '../../shared';
import * as SubnetsAPI from './subnets';
import { SubnetGetParams, SubnetGetResponse, Subnets } from './subnets';

export class ASN extends APIResource {
  subnets: SubnetsAPI.Subnets = new SubnetsAPI.Subnets(this._client);

  /**
   * Gets an overview of the Autonomous System Number (ASN) and a list of subnets for
   * it.
   *
   * @example
   * ```ts
   * const asn = await client.intel.asn.get(0, {
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(
    asn: Shared.ASNParam,
    params: ASNGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Shared.ASN> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/intel/asn/${asn}`, options) as Core.APIPromise<{
        result: Shared.ASN;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ASNGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

ASN.Subnets = Subnets;

export declare namespace ASN {
  export { type ASNGetParams as ASNGetParams };

  export {
    Subnets as Subnets,
    type SubnetGetResponse as SubnetGetResponse,
    type SubnetGetParams as SubnetGetParams,
  };
}
