// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import { CloudflareError } from '../../../../error';
import { SinglePage } from '../../../../pagination';

export class CAs extends APIResource {
  /**
   * Generates a new short-lived certificate CA and public key.
   *
   * @example
   * ```ts
   * const ca =
   *   await client.zeroTrust.access.applications.cas.create(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  create(appId: string, params?: CACreateParams, options?: Core.RequestOptions): Core.APIPromise<CA>;
  create(appId: string, options?: Core.RequestOptions): Core.APIPromise<CA>;
  create(
    appId: string,
    params: CACreateParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<CA> {
    if (isRequestOptions(params)) {
      return this.create(appId, {}, params);
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
      this._client.post(
        `/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/ca`,
        options,
      ) as Core.APIPromise<{ result: CA }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists short-lived certificate CAs and their public keys.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const ca of client.zeroTrust.access.applications.cas.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(params?: CAListParams, options?: Core.RequestOptions): Core.PagePromise<CAsSinglePage, CA>;
  list(options?: Core.RequestOptions): Core.PagePromise<CAsSinglePage, CA>;
  list(
    params: CAListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<CAsSinglePage, CA> {
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
      `/${accountOrZone}/${accountOrZoneId}/access/apps/ca`,
      CAsSinglePage,
      options,
    );
  }

  /**
   * Deletes a short-lived certificate CA.
   *
   * @example
   * ```ts
   * const ca =
   *   await client.zeroTrust.access.applications.cas.delete(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    appId: string,
    params?: CADeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CADeleteResponse>;
  delete(appId: string, options?: Core.RequestOptions): Core.APIPromise<CADeleteResponse>;
  delete(
    appId: string,
    params: CADeleteParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<CADeleteResponse> {
    if (isRequestOptions(params)) {
      return this.delete(appId, {}, params);
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
        `/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/ca`,
        options,
      ) as Core.APIPromise<{ result: CADeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a short-lived certificate CA and its public key.
   *
   * @example
   * ```ts
   * const ca =
   *   await client.zeroTrust.access.applications.cas.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  get(appId: string, params?: CAGetParams, options?: Core.RequestOptions): Core.APIPromise<CA>;
  get(appId: string, options?: Core.RequestOptions): Core.APIPromise<CA>;
  get(
    appId: string,
    params: CAGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<CA> {
    if (isRequestOptions(params)) {
      return this.get(appId, {}, params);
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
        `/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/ca`,
        options,
      ) as Core.APIPromise<{ result: CA }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class CAsSinglePage extends SinglePage<CA> {}

export interface CA {
  /**
   * The ID of the CA.
   */
  id?: string;

  /**
   * The Application Audience (AUD) tag. Identifies the application associated with
   * the CA.
   */
  aud?: string;

  /**
   * The public key to add to your SSH server configuration.
   */
  public_key?: string;
}

export interface CADeleteResponse {
  /**
   * The ID of the CA.
   */
  id?: string;
}

export interface CACreateParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export interface CAListParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export interface CADeleteParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export interface CAGetParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

CAs.CAsSinglePage = CAsSinglePage;

export declare namespace CAs {
  export {
    type CA as CA,
    type CADeleteResponse as CADeleteResponse,
    CAsSinglePage as CAsSinglePage,
    type CACreateParams as CACreateParams,
    type CAListParams as CAListParams,
    type CADeleteParams as CADeleteParams,
    type CAGetParams as CAGetParams,
  };
}
