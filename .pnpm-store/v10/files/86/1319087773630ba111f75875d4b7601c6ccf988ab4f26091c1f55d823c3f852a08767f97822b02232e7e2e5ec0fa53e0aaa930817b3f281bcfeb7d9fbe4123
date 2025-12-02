// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import * as PoliciesAPI from '../policies';
import { SplitTunnelIncludesSinglePage } from '../policies';

export class Includes extends APIResource {
  /**
   * Sets the list of routes included in the WARP client's tunnel.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const splitTunnelInclude of client.zeroTrust.devices.policies.default.includes.update(
   *   {
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *     body: [{ address: '192.0.2.0/24' }],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  update(
    params: IncludeUpdateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SplitTunnelIncludesSinglePage, PoliciesAPI.SplitTunnelInclude> {
    const { account_id, body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/policy/include`,
      SplitTunnelIncludesSinglePage,
      { body: body, method: 'put', ...options },
    );
  }

  /**
   * Fetches the list of routes included in the WARP client's tunnel.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const splitTunnelInclude of client.zeroTrust.devices.policies.default.includes.get(
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    params: IncludeGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SplitTunnelIncludesSinglePage, PoliciesAPI.SplitTunnelInclude> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/policy/include`,
      SplitTunnelIncludesSinglePage,
      options,
    );
  }
}

export interface IncludeUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<PoliciesAPI.SplitTunnelIncludeParam>;
}

export interface IncludeGetParams {
  account_id: string;
}

export declare namespace Includes {
  export { type IncludeUpdateParams as IncludeUpdateParams, type IncludeGetParams as IncludeGetParams };
}

export { SplitTunnelIncludesSinglePage };
