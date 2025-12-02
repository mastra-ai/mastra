// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import * as SettingsAPI from './settings';
import {
  CertificateSettings,
  CertificateSettingsSinglePage,
  SettingGetParams,
  SettingUpdateParams,
  Settings,
} from './settings';
import { CloudflareError } from '../../../../error';
import { SinglePage } from '../../../../pagination';

export class Certificates extends APIResource {
  settings: SettingsAPI.Settings = new SettingsAPI.Settings(this._client);

  /**
   * Adds a new mTLS root certificate to Access.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.zeroTrust.access.certificates.create({
   *     certificate:
   *       '-----BEGIN CERTIFICATE-----\nMIIGAjCCA+qgAwIBAgIJAI7kymlF7CWT...N4RI7KKB7nikiuUf8vhULKy5IX10\nDrUtmu/B\n-----END CERTIFICATE-----',
   *     name: 'Allow devs',
   *     account_id: 'account_id',
   *   });
   * ```
   */
  create(params: CertificateCreateParams, options?: Core.RequestOptions): Core.APIPromise<Certificate> {
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
    return (
      this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/certificates`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Certificate }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a configured mTLS certificate.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.zeroTrust.access.certificates.update(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       associated_hostnames: ['admin.example.com'],
   *       account_id: 'account_id',
   *     },
   *   );
   * ```
   */
  update(
    certificateId: string,
    params: CertificateUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Certificate> {
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
    return (
      this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Certificate }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists all mTLS root certificates.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificate of client.zeroTrust.access.certificates.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params?: CertificateListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CertificatesSinglePage, Certificate>;
  list(options?: Core.RequestOptions): Core.PagePromise<CertificatesSinglePage, Certificate>;
  list(
    params: CertificateListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<CertificatesSinglePage, Certificate> {
    if (isRequestOptions(params)) {
      return this.list({}, params);
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
      `/${accountOrZone}/${accountOrZoneId}/access/certificates`,
      CertificatesSinglePage,
      options,
    );
  }

  /**
   * Deletes an mTLS certificate.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.zeroTrust.access.certificates.delete(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    certificateId: string,
    params?: CertificateDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateDeleteResponse>;
  delete(certificateId: string, options?: Core.RequestOptions): Core.APIPromise<CertificateDeleteResponse>;
  delete(
    certificateId: string,
    params: CertificateDeleteParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateDeleteResponse> {
    if (isRequestOptions(params)) {
      return this.delete(certificateId, {}, params);
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
      this._client.delete(
        `/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`,
        options,
      ) as Core.APIPromise<{ result: CertificateDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a single mTLS certificate.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.zeroTrust.access.certificates.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  get(
    certificateId: string,
    params?: CertificateGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Certificate>;
  get(certificateId: string, options?: Core.RequestOptions): Core.APIPromise<Certificate>;
  get(
    certificateId: string,
    params: CertificateGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<Certificate> {
    if (isRequestOptions(params)) {
      return this.get(certificateId, {}, params);
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
        `/${accountOrZone}/${accountOrZoneId}/access/certificates/${certificateId}`,
        options,
      ) as Core.APIPromise<{ result: Certificate }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class CertificatesSinglePage extends SinglePage<Certificate> {}

/**
 * A fully-qualified domain name (FQDN).
 */
export type AssociatedHostnames = string;

/**
 * A fully-qualified domain name (FQDN).
 */
export type AssociatedHostnamesParam = string;

export interface Certificate {
  /**
   * The ID of the application that will use this certificate.
   */
  id?: string;

  /**
   * The hostnames of the applications that will use this certificate.
   */
  associated_hostnames?: Array<AssociatedHostnames>;

  created_at?: string;

  expires_on?: string;

  /**
   * The MD5 fingerprint of the certificate.
   */
  fingerprint?: string;

  /**
   * The name of the certificate.
   */
  name?: string;

  updated_at?: string;
}

export interface CertificateDeleteResponse {
  /**
   * UUID.
   */
  id?: string;
}

export interface CertificateCreateParams {
  /**
   * Body param: The certificate content.
   */
  certificate: string;

  /**
   * Body param: The name of the certificate.
   */
  name: string;

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

  /**
   * Body param: The hostnames of the applications that will use this certificate.
   */
  associated_hostnames?: Array<AssociatedHostnamesParam>;
}

export interface CertificateUpdateParams {
  /**
   * Body param: The hostnames of the applications that will use this certificate.
   */
  associated_hostnames: Array<AssociatedHostnamesParam>;

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

  /**
   * Body param: The name of the certificate.
   */
  name?: string;
}

export interface CertificateListParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export interface CertificateDeleteParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export interface CertificateGetParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

Certificates.CertificatesSinglePage = CertificatesSinglePage;
Certificates.Settings = Settings;
Certificates.CertificateSettingsSinglePage = CertificateSettingsSinglePage;

export declare namespace Certificates {
  export {
    type AssociatedHostnames as AssociatedHostnames,
    type Certificate as Certificate,
    type CertificateDeleteResponse as CertificateDeleteResponse,
    CertificatesSinglePage as CertificatesSinglePage,
    type CertificateCreateParams as CertificateCreateParams,
    type CertificateUpdateParams as CertificateUpdateParams,
    type CertificateListParams as CertificateListParams,
    type CertificateDeleteParams as CertificateDeleteParams,
    type CertificateGetParams as CertificateGetParams,
  };

  export {
    Settings as Settings,
    type CertificateSettings as CertificateSettings,
    CertificateSettingsSinglePage as CertificateSettingsSinglePage,
    type SettingUpdateParams as SettingUpdateParams,
    type SettingGetParams as SettingGetParams,
  };
}
