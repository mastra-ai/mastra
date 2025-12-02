// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as SettingsAPI from './settings';
import {
  SettingGetParams,
  SettingGetResponse,
  SettingUpdateParams,
  SettingUpdateResponse,
  Settings,
} from './settings';
import * as HostnamesAPI from './hostnames/hostnames';
import {
  AuthenticatedOriginPull,
  HostnameGetParams,
  HostnameUpdateParams,
  HostnameUpdateResponse,
  HostnameUpdateResponsesSinglePage,
  Hostnames,
} from './hostnames/hostnames';
import { SinglePage } from '../../pagination';

export class OriginTLSClientAuth extends APIResource {
  hostnames: HostnamesAPI.Hostnames = new HostnamesAPI.Hostnames(this._client);
  settings: SettingsAPI.Settings = new SettingsAPI.Settings(this._client);

  /**
   * Upload your own certificate you want Cloudflare to use for edge-to-origin
   * communication to override the shared certificate. Please note that it is
   * important to keep only one certificate active. Also, make sure to enable
   * zone-level authenticated origin pulls by making a PUT call to settings endpoint
   * to see the uploaded certificate in use.
   *
   * @example
   * ```ts
   * const originTLSClientAuth =
   *   await client.originTLSClientAuth.create({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     certificate:
   *       '-----BEGIN CERTIFICATE-----\nMIIDtTCCAp2gAwIBAgIJAMHAwfXZ5/PWMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAkFVMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBX\naWRnaXRzIFB0eSBMdGQwHhcNMTYwODI0MTY0MzAxWhcNMTYxMTIyMTY0MzAxWjBF\nMQswCQYDVQQGEwJBVTETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50\nZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\nCgKCAQEAwQHoetcl9+5ikGzV6cMzWtWPJHqXT3wpbEkRU9Yz7lgvddmGdtcGbg/1\nCGZu0jJGkMoppoUo4c3dts3iwqRYmBikUP77wwY2QGmDZw2FvkJCJlKnabIRuGvB\nKwzESIXgKk2016aTP6/dAjEHyo6SeoK8lkIySUvK0fyOVlsiEsCmOpidtnKX/a+5\n0GjB79CJH4ER2lLVZnhePFR/zUOyPxZQQ4naHf7yu/b5jhO0f8fwt+pyFxIXjbEI\ndZliWRkRMtzrHOJIhrmJ2A1J7iOrirbbwillwjjNVUWPf3IJ3M12S9pEewooaeO2\nizNTERcG9HzAacbVRn2Y2SWIyT/18QIDAQABo4GnMIGkMB0GA1UdDgQWBBT/LbE4\n9rWf288N6sJA5BRb6FJIGDB1BgNVHSMEbjBsgBT/LbE49rWf288N6sJA5BRb6FJI\nGKFJpEcwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNV\nBAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAMHAwfXZ5/PWMAwGA1UdEwQF\nMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAHHFwl0tH0quUYZYO0dZYt4R7SJ0pCm2\n2satiyzHl4OnXcHDpekAo7/a09c6Lz6AU83cKy/+x3/djYHXWba7HpEu0dR3ugQP\nMlr4zrhd9xKZ0KZKiYmtJH+ak4OM4L3FbT0owUZPyjLSlhMtJVcoRp5CJsjAMBUG\nSvD8RX+T01wzox/Qb+lnnNnOlaWpqu8eoOenybxKp1a9ULzIVvN/LAcc+14vioFq\n2swRWtmocBAs8QR9n4uvbpiYvS8eYueDCWMM4fvFfBhaDZ3N9IbtySh3SpFdQDhw\nYbjM2rxXiyLGxB4Bol7QTv4zHif7Zt89FReT/NBy4rzaskDJY5L6xmY=\n-----END CERTIFICATE-----\n',
   *     private_key:
   *       '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAwQHoetcl9+5ikGzV6cMzWtWPJHqXT3wpbEkRU9Yz7lgvddmG\ndtcGbg/1CGZu0jJGkMoppoUo4c3dts3iwqRYmBikUP77wwY2QGmDZw2FvkJCJlKn\nabIRuGvBKwzESIXgKk2016aTP6/dAjEHyo6SeoK8lkIySUvK0fyOVlsiEsCmOpid\ntnKX/a+50GjB79CJH4ER2lLVZnhePFR/zUOyPxZQQ4naHf7yu/b5jhO0f8fwt+py\nFxIXjbEIdZliWRkRMtzrHOJIhrmJ2A1J7iOrirbbwillwjjNVUWPf3IJ3M12S9pE\newooaeO2izNTERcG9HzAacbVRn2Y2SWIyT/18QIDAQABAoIBACbhTYXBZYKmYPCb\nHBR1IBlCQA2nLGf0qRuJNJZg5iEzXows/6tc8YymZkQE7nolapWsQ+upk2y5Xdp/\naxiuprIs9JzkYK8Ox0r+dlwCG1kSW+UAbX0bQ/qUqlsTvU6muVuMP8vZYHxJ3wmb\n+ufRBKztPTQ/rYWaYQcgC0RWI20HTFBMxlTAyNxYNWzX7RKFkGVVyB9RsAtmcc8g\n+j4OdosbfNoJPS0HeIfNpAznDfHKdxDk2Yc1tV6RHBrC1ynyLE9+TaflIAdo2MVv\nKLMLq51GqYKtgJFIlBRPQqKoyXdz3fGvXrTkf/WY9QNq0J1Vk5ERePZ54mN8iZB7\n9lwy/AkCgYEA6FXzosxswaJ2wQLeoYc7ceaweX/SwTvxHgXzRyJIIT0eJWgx13Wo\n/WA3Iziimsjf6qE+SI/8laxPp2A86VMaIt3Z3mJN/CqSVGw8LK2AQst+OwdPyDMu\niacE8lj/IFGC8mwNUAb9CzGU3JpU4PxxGFjS/eMtGeRXCWkK4NE+G08CgYEA1Kp9\nN2JrVlqUz+gAX+LPmE9OEMAS9WQSQsfCHGogIFDGGcNf7+uwBM7GAaSJIP01zcoe\nVAgWdzXCv3FLhsaZoJ6RyLOLay5phbu1iaTr4UNYm5WtYTzMzqh8l1+MFFDl9xDB\nvULuCIIrglM5MeS/qnSg1uMoH2oVPj9TVst/ir8CgYEAxrI7Ws9Zc4Bt70N1As+U\nlySjaEVZCMkqvHJ6TCuVZFfQoE0r0whdLdRLU2PsLFP+q7qaeZQqgBaNSKeVcDYR\n9B+nY/jOmQoPewPVsp/vQTCnE/R81spu0mp0YI6cIheT1Z9zAy322svcc43JaWB7\nmEbeqyLOP4Z4qSOcmghZBSECgYACvR9Xs0DGn+wCsW4vze/2ei77MD4OQvepPIFX\ndFZtlBy5ADcgE9z0cuVB6CiL8DbdK5kwY9pGNr8HUCI03iHkW6Zs+0L0YmihfEVe\nPG19PSzK9CaDdhD9KFZSbLyVFmWfxOt50H7YRTTiPMgjyFpfi5j2q348yVT0tEQS\nfhRqaQKBgAcWPokmJ7EbYQGeMbS7HC8eWO/RyamlnSffdCdSc7ue3zdVJxpAkQ8W\nqu80pEIF6raIQfAf8MXiiZ7auFOSnHQTXUbhCpvDLKi0Mwq3G8Pl07l+2s6dQG6T\nlv6XTQaMyf6n1yjzL+fzDrH3qXMxHMO/b13EePXpDMpY7HQpoLDi\n-----END RSA PRIVATE KEY-----\n',
   *   });
   * ```
   */
  create(
    params: OriginTLSClientAuthCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OriginTLSClientAuthCreateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/origin_tls_client_auth`, { body, ...options }) as Core.APIPromise<{
        result: OriginTLSClientAuthCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Certificates
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const originTLSClientAuthListResponse of client.originTLSClientAuth.list(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: OriginTLSClientAuthListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<OriginTLSClientAuthListResponsesSinglePage, OriginTLSClientAuthListResponse> {
    const { zone_id } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/origin_tls_client_auth`,
      OriginTLSClientAuthListResponsesSinglePage,
      options,
    );
  }

  /**
   * Delete Certificate
   *
   * @example
   * ```ts
   * const originTLSClientAuth =
   *   await client.originTLSClientAuth.delete(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    certificateId: string,
    params: OriginTLSClientAuthDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OriginTLSClientAuthDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(
        `/zones/${zone_id}/origin_tls_client_auth/${certificateId}`,
        options,
      ) as Core.APIPromise<{ result: OriginTLSClientAuthDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Certificate Details
   *
   * @example
   * ```ts
   * const originTLSClientAuth =
   *   await client.originTLSClientAuth.get(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    certificateId: string,
    params: OriginTLSClientAuthGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OriginTLSClientAuthGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(
        `/zones/${zone_id}/origin_tls_client_auth/${certificateId}`,
        options,
      ) as Core.APIPromise<{ result: OriginTLSClientAuthGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class OriginTLSClientAuthListResponsesSinglePage extends SinglePage<OriginTLSClientAuthListResponse> {}

export interface ZoneAuthenticatedOriginPull {
  /**
   * Identifier.
   */
  id?: string;

  /**
   * The zone's leaf certificate.
   */
  certificate?: string;

  /**
   * When the certificate from the authority expires.
   */
  expires_on?: string;

  /**
   * The certificate authority that issued the certificate.
   */
  issuer?: string;

  /**
   * The type of hash used for the certificate.
   */
  signature?: string;

  /**
   * Status of the certificate activation.
   */
  status?:
    | 'initializing'
    | 'pending_deployment'
    | 'pending_deletion'
    | 'active'
    | 'deleted'
    | 'deployment_timed_out'
    | 'deletion_timed_out';

  /**
   * This is the time the certificate was uploaded.
   */
  uploaded_on?: string;
}

export interface OriginTLSClientAuthCreateResponse extends ZoneAuthenticatedOriginPull {
  /**
   * Identifier.
   */
  id?: string;

  /**
   * The zone's leaf certificate.
   */
  certificate?: string;

  /**
   * Indicates whether zone-level authenticated origin pulls is enabled.
   */
  enabled?: boolean;

  /**
   * The zone's private key.
   */
  private_key?: string;
}

export interface OriginTLSClientAuthListResponse extends ZoneAuthenticatedOriginPull {
  /**
   * Identifier.
   */
  id?: string;

  /**
   * The zone's leaf certificate.
   */
  certificate?: string;

  /**
   * Indicates whether zone-level authenticated origin pulls is enabled.
   */
  enabled?: boolean;

  /**
   * The zone's private key.
   */
  private_key?: string;
}

export interface OriginTLSClientAuthDeleteResponse extends ZoneAuthenticatedOriginPull {
  /**
   * Identifier.
   */
  id?: string;

  /**
   * The zone's leaf certificate.
   */
  certificate?: string;

  /**
   * Indicates whether zone-level authenticated origin pulls is enabled.
   */
  enabled?: boolean;

  /**
   * The zone's private key.
   */
  private_key?: string;
}

export interface OriginTLSClientAuthGetResponse extends ZoneAuthenticatedOriginPull {
  /**
   * Identifier.
   */
  id?: string;

  /**
   * The zone's leaf certificate.
   */
  certificate?: string;

  /**
   * Indicates whether zone-level authenticated origin pulls is enabled.
   */
  enabled?: boolean;

  /**
   * The zone's private key.
   */
  private_key?: string;
}

export interface OriginTLSClientAuthCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: The zone's leaf certificate.
   */
  certificate: string;

  /**
   * Body param: The zone's private key.
   */
  private_key: string;
}

export interface OriginTLSClientAuthListParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface OriginTLSClientAuthDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface OriginTLSClientAuthGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

OriginTLSClientAuth.OriginTLSClientAuthListResponsesSinglePage = OriginTLSClientAuthListResponsesSinglePage;
OriginTLSClientAuth.Hostnames = Hostnames;
OriginTLSClientAuth.HostnameUpdateResponsesSinglePage = HostnameUpdateResponsesSinglePage;
OriginTLSClientAuth.Settings = Settings;

export declare namespace OriginTLSClientAuth {
  export {
    type ZoneAuthenticatedOriginPull as ZoneAuthenticatedOriginPull,
    type OriginTLSClientAuthCreateResponse as OriginTLSClientAuthCreateResponse,
    type OriginTLSClientAuthListResponse as OriginTLSClientAuthListResponse,
    type OriginTLSClientAuthDeleteResponse as OriginTLSClientAuthDeleteResponse,
    type OriginTLSClientAuthGetResponse as OriginTLSClientAuthGetResponse,
    OriginTLSClientAuthListResponsesSinglePage as OriginTLSClientAuthListResponsesSinglePage,
    type OriginTLSClientAuthCreateParams as OriginTLSClientAuthCreateParams,
    type OriginTLSClientAuthListParams as OriginTLSClientAuthListParams,
    type OriginTLSClientAuthDeleteParams as OriginTLSClientAuthDeleteParams,
    type OriginTLSClientAuthGetParams as OriginTLSClientAuthGetParams,
  };

  export {
    Hostnames as Hostnames,
    type AuthenticatedOriginPull as AuthenticatedOriginPull,
    type HostnameUpdateResponse as HostnameUpdateResponse,
    HostnameUpdateResponsesSinglePage as HostnameUpdateResponsesSinglePage,
    type HostnameUpdateParams as HostnameUpdateParams,
    type HostnameGetParams as HostnameGetParams,
  };

  export {
    Settings as Settings,
    type SettingUpdateResponse as SettingUpdateResponse,
    type SettingGetResponse as SettingGetResponse,
    type SettingUpdateParams as SettingUpdateParams,
    type SettingGetParams as SettingGetParams,
  };
}
