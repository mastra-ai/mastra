// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class OverrideCodes extends APIResource {
  /**
   * Fetches a one-time use admin override code for a device. This relies on the
   * **Admin Override** setting being enabled in your device configuration. Not
   * supported when
   * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
   * is enabled for the account. **Deprecated:** please use GET
   * /accounts/{account_id}/devices/registrations/{registration_id}/override_codes
   * instead.
   *
   * @deprecated
   */
  list(
    deviceId: string,
    params: OverrideCodeListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<OverrideCodeListResponsesSinglePage, OverrideCodeListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/${deviceId}/override_codes`,
      OverrideCodeListResponsesSinglePage,
      options,
    );
  }

  /**
   * Fetches one-time use admin override codes for a registration. This relies on the
   * **Admin Override** setting being enabled in your device configuration.
   *
   * @example
   * ```ts
   * const overrideCode =
   *   await client.zeroTrust.devices.overrideCodes.get(
   *     'registration_id',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  get(
    registrationId: string,
    params: OverrideCodeGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OverrideCodeGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/devices/registrations/${registrationId}/override_codes`,
        options,
      ) as Core.APIPromise<{ result: OverrideCodeGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class OverrideCodeListResponsesSinglePage extends SinglePage<OverrideCodeListResponse> {}

export type OverrideCodeListResponse = unknown;

export interface OverrideCodeGetResponse {
  disable_for_time?: { [key: string]: string };
}

export interface OverrideCodeListParams {
  account_id: string;
}

export interface OverrideCodeGetParams {
  account_id: string;
}

OverrideCodes.OverrideCodeListResponsesSinglePage = OverrideCodeListResponsesSinglePage;

export declare namespace OverrideCodes {
  export {
    type OverrideCodeListResponse as OverrideCodeListResponse,
    type OverrideCodeGetResponse as OverrideCodeGetResponse,
    OverrideCodeListResponsesSinglePage as OverrideCodeListResponsesSinglePage,
    type OverrideCodeListParams as OverrideCodeListParams,
    type OverrideCodeGetParams as OverrideCodeGetParams,
  };
}
