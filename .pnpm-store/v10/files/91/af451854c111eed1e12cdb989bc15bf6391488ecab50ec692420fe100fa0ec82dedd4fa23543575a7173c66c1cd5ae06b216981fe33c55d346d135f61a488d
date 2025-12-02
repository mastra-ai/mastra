// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class GatewayCA extends APIResource {
  /**
   * Adds a new SSH Certificate Authority (CA).
   *
   * @example
   * ```ts
   * const gatewayCA =
   *   await client.zeroTrust.access.gatewayCA.create({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  create(
    params: GatewayCACreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<GatewayCACreateResponse> {
    const { account_id } = params;
    return (
      this._client.post(`/accounts/${account_id}/access/gateway_ca`, options) as Core.APIPromise<{
        result: GatewayCACreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists SSH Certificate Authorities (CA).
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const gatewayCAListResponse of client.zeroTrust.access.gatewayCA.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: GatewayCAListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<GatewayCAListResponsesSinglePage, GatewayCAListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/access/gateway_ca`,
      GatewayCAListResponsesSinglePage,
      options,
    );
  }

  /**
   * Deletes an SSH Certificate Authority.
   *
   * @example
   * ```ts
   * const gatewayCA =
   *   await client.zeroTrust.access.gatewayCA.delete(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    certificateId: string,
    params: GatewayCADeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<GatewayCADeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/access/gateway_ca/${certificateId}`,
        options,
      ) as Core.APIPromise<{ result: GatewayCADeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class GatewayCAListResponsesSinglePage extends SinglePage<GatewayCAListResponse> {}

export interface GatewayCACreateResponse {
  /**
   * The key ID of this certificate.
   */
  id?: string;

  /**
   * The public key of this certificate.
   */
  public_key?: string;
}

export interface GatewayCAListResponse {
  /**
   * The key ID of this certificate.
   */
  id?: string;

  /**
   * The public key of this certificate.
   */
  public_key?: string;
}

export interface GatewayCADeleteResponse {
  /**
   * UUID.
   */
  id?: string;
}

export interface GatewayCACreateParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface GatewayCAListParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface GatewayCADeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

GatewayCA.GatewayCAListResponsesSinglePage = GatewayCAListResponsesSinglePage;

export declare namespace GatewayCA {
  export {
    type GatewayCACreateResponse as GatewayCACreateResponse,
    type GatewayCAListResponse as GatewayCAListResponse,
    type GatewayCADeleteResponse as GatewayCADeleteResponse,
    GatewayCAListResponsesSinglePage as GatewayCAListResponsesSinglePage,
    type GatewayCACreateParams as GatewayCACreateParams,
    type GatewayCAListParams as GatewayCAListParams,
    type GatewayCADeleteParams as GatewayCADeleteParams,
  };
}
