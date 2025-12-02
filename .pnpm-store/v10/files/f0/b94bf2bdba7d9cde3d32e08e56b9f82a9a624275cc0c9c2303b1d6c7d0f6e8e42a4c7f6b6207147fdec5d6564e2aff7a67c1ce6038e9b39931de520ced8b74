// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Certificates extends APIResource {
  /**
   * Creates a new Zero Trust certificate.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.zeroTrust.gateway.certificates.create({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *   });
   * ```
   */
  create(
    params: CertificateCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/gateway/certificates`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CertificateCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches all Zero Trust certificates for an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const certificateListResponse of client.zeroTrust.gateway.certificates.list(
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: CertificateListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CertificateListResponsesSinglePage, CertificateListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/gateway/certificates`,
      CertificateListResponsesSinglePage,
      options,
    );
  }

  /**
   * Deletes a gateway-managed Zero Trust certificate. A certificate must be
   * deactivated from the edge (inactive) before it is deleted.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.zeroTrust.gateway.certificates.delete(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  delete(
    certificateId: string,
    params: CertificateDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/gateway/certificates/${certificateId}`,
        options,
      ) as Core.APIPromise<{ result: CertificateDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Binds a single Zero Trust certificate to the edge.
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.gateway.certificates.activate(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '699d98642c564d2e855e9661899b7252',
   *       body: {},
   *     },
   *   );
   * ```
   */
  activate(
    certificateId: string,
    params: CertificateActivateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateActivateResponse> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/gateway/certificates/${certificateId}/activate`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: CertificateActivateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Unbinds a single Zero Trust certificate from the edge
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.gateway.certificates.deactivate(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '699d98642c564d2e855e9661899b7252',
   *       body: {},
   *     },
   *   );
   * ```
   */
  deactivate(
    certificateId: string,
    params: CertificateDeactivateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateDeactivateResponse> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/gateway/certificates/${certificateId}/deactivate`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: CertificateDeactivateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a single Zero Trust certificate.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.zeroTrust.gateway.certificates.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  get(
    certificateId: string,
    params: CertificateGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/gateway/certificates/${certificateId}`,
        options,
      ) as Core.APIPromise<{ result: CertificateGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class CertificateListResponsesSinglePage extends SinglePage<CertificateListResponse> {}

export interface CertificateCreateResponse {
  /**
   * Certificate UUID tag.
   */
  id?: string;

  /**
   * The deployment status of the certificate on Cloudflare's edge. Certificates in
   * the 'available' (previously called 'active') state may be used for Gateway TLS
   * interception.
   */
  binding_status?: 'pending_deployment' | 'available' | 'pending_deletion' | 'inactive';

  /**
   * The CA certificate
   */
  certificate?: string;

  created_at?: string;

  expires_on?: string;

  /**
   * The SHA256 fingerprint of the certificate.
   */
  fingerprint?: string;

  /**
   * Use this certificate for Gateway TLS interception
   */
  in_use?: boolean;

  /**
   * The organization that issued the certificate.
   */
  issuer_org?: string;

  /**
   * The entire issuer field of the certificate.
   */
  issuer_raw?: string;

  /**
   * The type of certificate, either BYO-PKI (custom) or Gateway-managed.
   */
  type?: 'custom' | 'gateway_managed';

  updated_at?: string;

  uploaded_on?: string;
}

export interface CertificateListResponse {
  /**
   * Certificate UUID tag.
   */
  id?: string;

  /**
   * The deployment status of the certificate on Cloudflare's edge. Certificates in
   * the 'available' (previously called 'active') state may be used for Gateway TLS
   * interception.
   */
  binding_status?: 'pending_deployment' | 'available' | 'pending_deletion' | 'inactive';

  /**
   * The CA certificate
   */
  certificate?: string;

  created_at?: string;

  expires_on?: string;

  /**
   * The SHA256 fingerprint of the certificate.
   */
  fingerprint?: string;

  /**
   * Use this certificate for Gateway TLS interception
   */
  in_use?: boolean;

  /**
   * The organization that issued the certificate.
   */
  issuer_org?: string;

  /**
   * The entire issuer field of the certificate.
   */
  issuer_raw?: string;

  /**
   * The type of certificate, either BYO-PKI (custom) or Gateway-managed.
   */
  type?: 'custom' | 'gateway_managed';

  updated_at?: string;

  uploaded_on?: string;
}

export interface CertificateDeleteResponse {
  /**
   * Certificate UUID tag.
   */
  id?: string;

  /**
   * The deployment status of the certificate on Cloudflare's edge. Certificates in
   * the 'available' (previously called 'active') state may be used for Gateway TLS
   * interception.
   */
  binding_status?: 'pending_deployment' | 'available' | 'pending_deletion' | 'inactive';

  /**
   * The CA certificate
   */
  certificate?: string;

  created_at?: string;

  expires_on?: string;

  /**
   * The SHA256 fingerprint of the certificate.
   */
  fingerprint?: string;

  /**
   * Use this certificate for Gateway TLS interception
   */
  in_use?: boolean;

  /**
   * The organization that issued the certificate.
   */
  issuer_org?: string;

  /**
   * The entire issuer field of the certificate.
   */
  issuer_raw?: string;

  /**
   * The type of certificate, either BYO-PKI (custom) or Gateway-managed.
   */
  type?: 'custom' | 'gateway_managed';

  updated_at?: string;

  uploaded_on?: string;
}

export interface CertificateActivateResponse {
  /**
   * Certificate UUID tag.
   */
  id?: string;

  /**
   * The deployment status of the certificate on Cloudflare's edge. Certificates in
   * the 'available' (previously called 'active') state may be used for Gateway TLS
   * interception.
   */
  binding_status?: 'pending_deployment' | 'available' | 'pending_deletion' | 'inactive';

  /**
   * The CA certificate
   */
  certificate?: string;

  created_at?: string;

  expires_on?: string;

  /**
   * The SHA256 fingerprint of the certificate.
   */
  fingerprint?: string;

  /**
   * Use this certificate for Gateway TLS interception
   */
  in_use?: boolean;

  /**
   * The organization that issued the certificate.
   */
  issuer_org?: string;

  /**
   * The entire issuer field of the certificate.
   */
  issuer_raw?: string;

  /**
   * The type of certificate, either BYO-PKI (custom) or Gateway-managed.
   */
  type?: 'custom' | 'gateway_managed';

  updated_at?: string;

  uploaded_on?: string;
}

export interface CertificateDeactivateResponse {
  /**
   * Certificate UUID tag.
   */
  id?: string;

  /**
   * The deployment status of the certificate on Cloudflare's edge. Certificates in
   * the 'available' (previously called 'active') state may be used for Gateway TLS
   * interception.
   */
  binding_status?: 'pending_deployment' | 'available' | 'pending_deletion' | 'inactive';

  /**
   * The CA certificate
   */
  certificate?: string;

  created_at?: string;

  expires_on?: string;

  /**
   * The SHA256 fingerprint of the certificate.
   */
  fingerprint?: string;

  /**
   * Use this certificate for Gateway TLS interception
   */
  in_use?: boolean;

  /**
   * The organization that issued the certificate.
   */
  issuer_org?: string;

  /**
   * The entire issuer field of the certificate.
   */
  issuer_raw?: string;

  /**
   * The type of certificate, either BYO-PKI (custom) or Gateway-managed.
   */
  type?: 'custom' | 'gateway_managed';

  updated_at?: string;

  uploaded_on?: string;
}

export interface CertificateGetResponse {
  /**
   * Certificate UUID tag.
   */
  id?: string;

  /**
   * The deployment status of the certificate on Cloudflare's edge. Certificates in
   * the 'available' (previously called 'active') state may be used for Gateway TLS
   * interception.
   */
  binding_status?: 'pending_deployment' | 'available' | 'pending_deletion' | 'inactive';

  /**
   * The CA certificate
   */
  certificate?: string;

  created_at?: string;

  expires_on?: string;

  /**
   * The SHA256 fingerprint of the certificate.
   */
  fingerprint?: string;

  /**
   * Use this certificate for Gateway TLS interception
   */
  in_use?: boolean;

  /**
   * The organization that issued the certificate.
   */
  issuer_org?: string;

  /**
   * The entire issuer field of the certificate.
   */
  issuer_raw?: string;

  /**
   * The type of certificate, either BYO-PKI (custom) or Gateway-managed.
   */
  type?: 'custom' | 'gateway_managed';

  updated_at?: string;

  uploaded_on?: string;
}

export interface CertificateCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Number of days the generated certificate will be valid, minimum 1
   * day and maximum 30 years. Defaults to 5 years. In terraform,
   * validity_period_days can only be used while creating a certificate, and this CAN
   * NOT be used to extend the validity of an already generated certificate.
   */
  validity_period_days?: number;
}

export interface CertificateListParams {
  account_id: string;
}

export interface CertificateDeleteParams {
  account_id: string;
}

export interface CertificateActivateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface CertificateDeactivateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface CertificateGetParams {
  account_id: string;
}

Certificates.CertificateListResponsesSinglePage = CertificateListResponsesSinglePage;

export declare namespace Certificates {
  export {
    type CertificateCreateResponse as CertificateCreateResponse,
    type CertificateListResponse as CertificateListResponse,
    type CertificateDeleteResponse as CertificateDeleteResponse,
    type CertificateActivateResponse as CertificateActivateResponse,
    type CertificateDeactivateResponse as CertificateDeactivateResponse,
    type CertificateGetResponse as CertificateGetResponse,
    CertificateListResponsesSinglePage as CertificateListResponsesSinglePage,
    type CertificateCreateParams as CertificateCreateParams,
    type CertificateListParams as CertificateListParams,
    type CertificateDeleteParams as CertificateDeleteParams,
    type CertificateActivateParams as CertificateActivateParams,
    type CertificateDeactivateParams as CertificateDeactivateParams,
    type CertificateGetParams as CertificateGetParams,
  };
}
