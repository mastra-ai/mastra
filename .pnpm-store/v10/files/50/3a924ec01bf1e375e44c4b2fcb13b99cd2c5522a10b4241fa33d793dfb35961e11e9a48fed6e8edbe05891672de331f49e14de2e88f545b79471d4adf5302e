// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import * as UserPolicyChecksAPI from './user-policy-checks';
import * as ApplicationsAPI from './applications';
import { CloudflareError } from '../../../../error';

export class UserPolicyChecks extends APIResource {
  /**
   * Tests if a specific user has permission to access an application.
   *
   * @example
   * ```ts
   * const userPolicyChecks =
   *   await client.zeroTrust.access.applications.userPolicyChecks.list(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  list(
    appId: ApplicationsAPI.AppIDParam,
    params?: UserPolicyCheckListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<UserPolicyCheckListResponse>;
  list(
    appId: ApplicationsAPI.AppIDParam,
    options?: Core.RequestOptions,
  ): Core.APIPromise<UserPolicyCheckListResponse>;
  list(
    appId: ApplicationsAPI.AppIDParam,
    params: UserPolicyCheckListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<UserPolicyCheckListResponse> {
    if (isRequestOptions(params)) {
      return this.list(appId, {}, params);
    }
    const { account_id, zone_id } = params;
    if (!account_id && !zone_id) {
      throw new CloudflareError('You must provide either account_id or zone_id.');
    }
    if (account_id && zone_id) {
      throw new CloudflareError('You cannot provide both account_id and zone_id.');
    }
    const { accountOrZone, accountOrZoneId } =
      account_id ?
        {
          accountOrZone: 'accounts',
          accountOrZoneId: account_id,
        }
      : {
          accountOrZone: 'zones',
          accountOrZoneId: zone_id,
        };
    return (
      this._client.get(
        `/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/user_policy_checks`,
        options,
      ) as Core.APIPromise<{ result: UserPolicyCheckListResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface UserPolicyCheckGeo {
  country?: string;
}

export interface UserPolicyCheckListResponse {
  app_state?: UserPolicyCheckListResponse.AppState;

  user_identity?: UserPolicyCheckListResponse.UserIdentity;
}

export namespace UserPolicyCheckListResponse {
  export interface AppState {
    /**
     * UUID.
     */
    app_uid?: string;

    aud?: string;

    hostname?: string;

    name?: string;

    policies?: Array<unknown>;

    status?: string;
  }

  export interface UserIdentity {
    id?: string;

    account_id?: string;

    device_sessions?: unknown;

    email?: string;

    geo?: UserPolicyChecksAPI.UserPolicyCheckGeo;

    iat?: number;

    is_gateway?: boolean;

    is_warp?: boolean;

    name?: string;

    /**
     * UUID.
     */
    user_uuid?: string;

    version?: number;
  }
}

export interface UserPolicyCheckListParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export declare namespace UserPolicyChecks {
  export {
    type UserPolicyCheckGeo as UserPolicyCheckGeo,
    type UserPolicyCheckListResponse as UserPolicyCheckListResponse,
    type UserPolicyCheckListParams as UserPolicyCheckListParams,
  };
}
