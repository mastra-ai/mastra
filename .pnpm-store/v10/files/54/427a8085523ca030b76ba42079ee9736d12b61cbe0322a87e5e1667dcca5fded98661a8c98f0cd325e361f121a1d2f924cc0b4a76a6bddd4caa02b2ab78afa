// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class AuditSSHSettings extends APIResource {
  /**
   * Updates Zero Trust Audit SSH and SSH with Access for Infrastructure settings for
   * an account.
   *
   * @example
   * ```ts
   * const gatewaySettings =
   *   await client.zeroTrust.gateway.auditSSHSettings.update({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *     public_key:
   *       '1pyl6I1tL7xfJuFYVzXlUW8uXXlpxegHXBzGCBKaSFA=',
   *   });
   * ```
   */
  update(
    params: AuditSSHSettingUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<GatewaySettings> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/gateway/audit_ssh_settings`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: GatewaySettings }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Gets all Zero Trust Audit SSH and SSH with Access for Infrastructure settings
   * for an account.
   *
   * @example
   * ```ts
   * const gatewaySettings =
   *   await client.zeroTrust.gateway.auditSSHSettings.get({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *   });
   * ```
   */
  get(params: AuditSSHSettingGetParams, options?: Core.RequestOptions): Core.APIPromise<GatewaySettings> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/gateway/audit_ssh_settings`, options) as Core.APIPromise<{
        result: GatewaySettings;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Rotates the SSH account seed that is used for generating the host key identity
   * when connecting through the Cloudflare SSH Proxy.
   *
   * @example
   * ```ts
   * const gatewaySettings =
   *   await client.zeroTrust.gateway.auditSSHSettings.rotateSeed(
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  rotateSeed(
    params: AuditSSHSettingRotateSeedParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<GatewaySettings> {
    const { account_id } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/gateway/audit_ssh_settings/rotate_seed`,
        options,
      ) as Core.APIPromise<{ result: GatewaySettings }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface GatewaySettings {
  created_at?: string;

  /**
   * Base64 encoded HPKE public key used to encrypt all your ssh session logs.
   * https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/use-cases/ssh/ssh-infrastructure-access/#enable-ssh-command-logging
   */
  public_key?: string;

  /**
   * Seed ID
   */
  seed_id?: string;

  updated_at?: string;
}

export interface AuditSSHSettingUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Base64 encoded HPKE public key used to encrypt all your ssh session
   * logs.
   * https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/use-cases/ssh/ssh-infrastructure-access/#enable-ssh-command-logging
   */
  public_key: string;
}

export interface AuditSSHSettingGetParams {
  account_id: string;
}

export interface AuditSSHSettingRotateSeedParams {
  account_id: string;
}

export declare namespace AuditSSHSettings {
  export {
    type GatewaySettings as GatewaySettings,
    type AuditSSHSettingUpdateParams as AuditSSHSettingUpdateParams,
    type AuditSSHSettingGetParams as AuditSSHSettingGetParams,
    type AuditSSHSettingRotateSeedParams as AuditSSHSettingRotateSeedParams,
  };
}
