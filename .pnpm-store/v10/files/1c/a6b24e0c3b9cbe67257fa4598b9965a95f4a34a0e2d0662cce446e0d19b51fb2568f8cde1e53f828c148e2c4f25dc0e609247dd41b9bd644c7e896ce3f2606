// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as UserPolicyChecksAPI from '../applications/user-policy-checks';

export class LastSeenIdentity extends APIResource {
  /**
   * Get last seen identity for a single user.
   *
   * @example
   * ```ts
   * const identity =
   *   await client.zeroTrust.access.users.lastSeenIdentity.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    userId: string,
    params: LastSeenIdentityGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Identity> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/access/users/${userId}/last_seen_identity`,
        options,
      ) as Core.APIPromise<{ result: Identity }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface Identity {
  account_id?: string;

  auth_status?: string;

  common_name?: string;

  device_id?: string;

  device_sessions?: { [key: string]: Identity.DeviceSessions };

  devicePosture?: { [key: string]: Identity.DevicePosture };

  email?: string;

  geo?: UserPolicyChecksAPI.UserPolicyCheckGeo;

  iat?: number;

  idp?: Identity.IdP;

  ip?: string;

  is_gateway?: boolean;

  is_warp?: boolean;

  mtls_auth?: Identity.MTLSAuth;

  service_token_id?: string;

  service_token_status?: boolean;

  user_uuid?: string;

  version?: number;
}

export namespace Identity {
  export interface DeviceSessions {
    last_authenticated?: number;
  }

  export interface DevicePosture {
    id?: string;

    check?: DevicePosture.Check;

    data?: unknown;

    description?: string;

    error?: string;

    rule_name?: string;

    success?: boolean;

    timestamp?: string;

    type?: string;
  }

  export namespace DevicePosture {
    export interface Check {
      exists?: boolean;

      path?: string;
    }
  }

  export interface IdP {
    id?: string;

    type?: string;
  }

  export interface MTLSAuth {
    auth_status?: string;

    cert_issuer_dn?: string;

    cert_issuer_ski?: string;

    cert_presented?: boolean;

    cert_serial?: string;
  }
}

export interface LastSeenIdentityGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace LastSeenIdentity {
  export { type Identity as Identity, type LastSeenIdentityGetParams as LastSeenIdentityGetParams };
}
