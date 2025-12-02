// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import { CloudflareError } from '../../../../error';
import { SinglePage } from '../../../../pagination';

export class Settings extends APIResource {
  /**
   * Updates an mTLS certificate's hostname settings.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateSettings of client.zeroTrust.access.certificates.settings.update(
   *   {
   *     settings: [
   *       {
   *         china_network: false,
   *         client_certificate_forwarding: true,
   *         hostname: 'admin.example.com',
   *       },
   *     ],
   *     account_id: 'account_id',
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  update(
    params: SettingUpdateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CertificateSettingsSinglePage, CertificateSettings> {
    const { account_id, zone_id, ...body } = params;
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
    return this._client.getAPIList(
      `/${accountOrZone}/${accountOrZoneId}/access/certificates/settings`,
      CertificateSettingsSinglePage,
      { body, method: 'put', ...options },
    );
  }

  /**
   * List all mTLS hostname settings for this account or zone.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateSettings of client.zeroTrust.access.certificates.settings.get(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    params?: SettingGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CertificateSettingsSinglePage, CertificateSettings>;
  get(options?: Core.RequestOptions): Core.PagePromise<CertificateSettingsSinglePage, CertificateSettings>;
  get(
    params: SettingGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<CertificateSettingsSinglePage, CertificateSettings> {
    if (isRequestOptions(params)) {
      return this.get({}, params);
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
    return this._client.getAPIList(
      `/${accountOrZone}/${accountOrZoneId}/access/certificates/settings`,
      CertificateSettingsSinglePage,
      options,
    );
  }
}

export class CertificateSettingsSinglePage extends SinglePage<CertificateSettings> {}

export interface CertificateSettings {
  /**
   * Request client certificates for this hostname in China. Can only be set to true
   * if this zone is china network enabled.
   */
  china_network: boolean;

  /**
   * Client Certificate Forwarding is a feature that takes the client cert provided
   * by the eyeball to the edge, and forwards it to the origin as a HTTP header to
   * allow logging on the origin.
   */
  client_certificate_forwarding: boolean;

  /**
   * The hostname that these settings apply to.
   */
  hostname: string;
}

export interface CertificateSettingsParam {
  /**
   * Request client certificates for this hostname in China. Can only be set to true
   * if this zone is china network enabled.
   */
  china_network: boolean;

  /**
   * Client Certificate Forwarding is a feature that takes the client cert provided
   * by the eyeball to the edge, and forwards it to the origin as a HTTP header to
   * allow logging on the origin.
   */
  client_certificate_forwarding: boolean;

  /**
   * The hostname that these settings apply to.
   */
  hostname: string;
}

export interface SettingUpdateParams {
  /**
   * Body param:
   */
  settings: Array<CertificateSettingsParam>;

  /**
   * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
   * Zone ID.
   */
  account_id?: string;

  /**
   * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
   * Account ID.
   */
  zone_id?: string;
}

export interface SettingGetParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

Settings.CertificateSettingsSinglePage = CertificateSettingsSinglePage;

export declare namespace Settings {
  export {
    type CertificateSettings as CertificateSettings,
    CertificateSettingsSinglePage as CertificateSettingsSinglePage,
    type SettingUpdateParams as SettingUpdateParams,
    type SettingGetParams as SettingGetParams,
  };
}
