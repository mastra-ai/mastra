// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class CloudflareSource extends APIResource {
  /**
   * Updates the Cloudflare Source subnet of the given address family
   *
   * @example
   * ```ts
   * const cloudflareSource =
   *   await client.zeroTrust.networks.subnets.cloudflareSource.update(
   *     'v4',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  update(
    addressFamily: 'v4' | 'v6',
    params: CloudflareSourceUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudflareSourceUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/zerotrust/subnets/cloudflare_source/${addressFamily}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CloudflareSourceUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface CloudflareSourceUpdateResponse {
  /**
   * The UUID of the subnet.
   */
  id?: string;

  /**
   * An optional description of the subnet.
   */
  comment?: string;

  /**
   * Timestamp of when the resource was created.
   */
  created_at?: string;

  /**
   * Timestamp of when the resource was deleted. If `null`, the resource has not been
   * deleted.
   */
  deleted_at?: string;

  /**
   * If `true`, this is the default subnet for the account. There can only be one
   * default subnet per account.
   */
  is_default_network?: boolean;

  /**
   * A user-friendly name for the subnet.
   */
  name?: string;

  /**
   * The private IPv4 or IPv6 range defining the subnet, in CIDR notation.
   */
  network?: string;

  /**
   * The type of subnet.
   */
  subnet_type?: 'cloudflare_source';
}

export interface CloudflareSourceUpdateParams {
  /**
   * Path param: Cloudflare account ID
   */
  account_id: string;

  /**
   * Body param: An optional description of the subnet.
   */
  comment?: string;

  /**
   * Body param: A user-friendly name for the subnet.
   */
  name?: string;

  /**
   * Body param: The private IPv4 or IPv6 range defining the subnet, in CIDR
   * notation.
   */
  network?: string;
}

export declare namespace CloudflareSource {
  export {
    type CloudflareSourceUpdateResponse as CloudflareSourceUpdateResponse,
    type CloudflareSourceUpdateParams as CloudflareSourceUpdateParams,
  };
}
