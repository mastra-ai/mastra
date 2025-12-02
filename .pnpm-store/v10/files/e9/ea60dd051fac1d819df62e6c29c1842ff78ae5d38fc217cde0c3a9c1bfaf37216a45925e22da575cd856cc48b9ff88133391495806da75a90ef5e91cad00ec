// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as Shared from '../../shared';
import * as CustomHostnamesAPI from '../custom-hostnames';

export class Certificates extends APIResource {
  /**
   * Replace a single custom certificate within a certificate pack that contains two
   * bundled certificates. The replacement must adhere to the following constraints.
   * You can only replace an RSA certificate with another RSA certificate or an ECDSA
   * certificate with another ECDSA certificate.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.customHostnames.certificatePack.certificates.update(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     {
   *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       custom_certificate:
   *         '-----BEGIN CERTIFICATE-----\nMIIDdjCCAl6gAwIBAgIJAPnMg0Fs+/B0MA0GCSqGSIb3DQEBCwUAMFsx...\n-----END CERTIFICATE-----\n',
   *       custom_key:
   *         '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/SCB5...\n-----END PRIVATE KEY-----\n',
   *     },
   *   );
   * ```
   */
  update(
    customHostnameId: string,
    certificatePackId: string,
    certificateId: string,
    params: CertificateUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateUpdateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(
        `/zones/${zone_id}/custom_hostnames/${customHostnameId}/certificate_pack/${certificatePackId}/certificates/${certificateId}`,
        { body, ...options },
      ) as Core.APIPromise<{ result: CertificateUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Delete a single custom certificate from a certificate pack that contains two
   * bundled certificates. Deletion is subject to the following constraints. You
   * cannot delete a certificate if it is the only remaining certificate in the pack.
   * At least one certificate must remain in the pack.
   *
   * @example
   * ```ts
   * const certificate =
   *   await client.customHostnames.certificatePack.certificates.delete(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    customHostnameId: string,
    certificatePackId: string,
    certificateId: string,
    params: CertificateDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CertificateDeleteResponse> {
    const { zone_id } = params;
    return this._client.delete(
      `/zones/${zone_id}/custom_hostnames/${customHostnameId}/certificate_pack/${certificatePackId}/certificates/${certificateId}`,
      options,
    );
  }
}

export interface CertificateUpdateResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * The custom hostname that will point to your hostname via CNAME.
   */
  hostname: string;

  ssl: CertificateUpdateResponse.SSL;

  /**
   * This is the time the hostname was created.
   */
  created_at?: string;

  /**
   * Unique key/value metadata for this hostname. These are per-hostname (customer)
   * settings.
   */
  custom_metadata?: { [key: string]: string };

  /**
   * a valid hostname that’s been added to your DNS zone as an A, AAAA, or CNAME
   * record.
   */
  custom_origin_server?: string;

  /**
   * A hostname that will be sent to your custom origin server as SNI for TLS
   * handshake. This can be a valid subdomain of the zone or custom origin server
   * name or the string ':request_host_header:' which will cause the host header in
   * the request to be used as SNI. Not configurable with default/fallback origin
   * server.
   */
  custom_origin_sni?: string;

  /**
   * This is a record which can be placed to activate a hostname.
   */
  ownership_verification?: CertificateUpdateResponse.OwnershipVerification;

  /**
   * This presents the token to be served by the given http url to activate a
   * hostname.
   */
  ownership_verification_http?: CertificateUpdateResponse.OwnershipVerificationHTTP;

  /**
   * Status of the hostname's activation.
   */
  status?:
    | 'active'
    | 'pending'
    | 'active_redeploying'
    | 'moved'
    | 'pending_deletion'
    | 'deleted'
    | 'pending_blocked'
    | 'pending_migration'
    | 'pending_provisioned'
    | 'test_pending'
    | 'test_active'
    | 'test_active_apex'
    | 'test_blocked'
    | 'test_failed'
    | 'provisioned'
    | 'blocked';

  /**
   * These are errors that were encountered while trying to activate a hostname.
   */
  verification_errors?: Array<string>;
}

export namespace CertificateUpdateResponse {
  export interface SSL {
    /**
     * Custom hostname SSL identifier tag.
     */
    id?: string;

    /**
     * A ubiquitous bundle has the highest probability of being verified everywhere,
     * even by clients using outdated or unusual trust stores. An optimal bundle uses
     * the shortest chain and newest intermediates. And the force bundle verifies the
     * chain, but does not otherwise modify it.
     */
    bundle_method?: CustomHostnamesAPI.BundleMethod;

    /**
     * The Certificate Authority that will issue the certificate
     */
    certificate_authority?: Shared.CertificateCA;

    /**
     * If a custom uploaded certificate is used.
     */
    custom_certificate?: string;

    /**
     * The identifier for the Custom CSR that was used.
     */
    custom_csr_id?: string;

    /**
     * The key for a custom uploaded certificate.
     */
    custom_key?: string;

    /**
     * The time the custom certificate expires on.
     */
    expires_on?: string;

    /**
     * A list of Hostnames on a custom uploaded certificate.
     */
    hosts?: Array<string>;

    /**
     * The issuer on a custom uploaded certificate.
     */
    issuer?: string;

    /**
     * Domain control validation (DCV) method used for this hostname.
     */
    method?: CustomHostnamesAPI.DCVMethod;

    /**
     * The serial number on a custom uploaded certificate.
     */
    serial_number?: string;

    settings?: SSL.Settings;

    /**
     * The signature on a custom uploaded certificate.
     */
    signature?: string;

    /**
     * Status of the hostname's SSL certificates.
     */
    status?:
      | 'initializing'
      | 'pending_validation'
      | 'deleted'
      | 'pending_issuance'
      | 'pending_deployment'
      | 'pending_deletion'
      | 'pending_expiration'
      | 'expired'
      | 'active'
      | 'initializing_timed_out'
      | 'validation_timed_out'
      | 'issuance_timed_out'
      | 'deployment_timed_out'
      | 'deletion_timed_out'
      | 'pending_cleanup'
      | 'staging_deployment'
      | 'staging_active'
      | 'deactivating'
      | 'inactive'
      | 'backup_issued'
      | 'holding_deployment';

    /**
     * Level of validation to be used for this hostname. Domain validation (dv) must be
     * used.
     */
    type?: CustomHostnamesAPI.DomainValidationType;

    /**
     * The time the custom certificate was uploaded.
     */
    uploaded_on?: string;

    /**
     * Domain validation errors that have been received by the certificate authority
     * (CA).
     */
    validation_errors?: Array<SSL.ValidationError>;

    validation_records?: Array<SSL.ValidationRecord>;

    /**
     * Indicates whether the certificate covers a wildcard.
     */
    wildcard?: boolean;
  }

  export namespace SSL {
    export interface Settings {
      /**
       * An allowlist of ciphers for TLS termination. These ciphers must be in the
       * BoringSSL format.
       */
      ciphers?: Array<string>;

      /**
       * Whether or not Early Hints is enabled.
       */
      early_hints?: 'on' | 'off';

      /**
       * Whether or not HTTP2 is enabled.
       */
      http2?: 'on' | 'off';

      /**
       * The minimum TLS version supported.
       */
      min_tls_version?: '1.0' | '1.1' | '1.2' | '1.3';

      /**
       * Whether or not TLS 1.3 is enabled.
       */
      tls_1_3?: 'on' | 'off';
    }

    export interface ValidationError {
      /**
       * A domain validation error.
       */
      message?: string;
    }

    export interface ValidationRecord {
      /**
       * The set of email addresses that the certificate authority (CA) will use to
       * complete domain validation.
       */
      emails?: Array<string>;

      /**
       * The content that the certificate authority (CA) will expect to find at the
       * http_url during the domain validation.
       */
      http_body?: string;

      /**
       * The url that will be checked during domain validation.
       */
      http_url?: string;

      /**
       * The hostname that the certificate authority (CA) will check for a TXT record
       * during domain validation .
       */
      txt_name?: string;

      /**
       * The TXT record that the certificate authority (CA) will check during domain
       * validation.
       */
      txt_value?: string;
    }
  }

  /**
   * This is a record which can be placed to activate a hostname.
   */
  export interface OwnershipVerification {
    /**
     * DNS Name for record.
     */
    name?: string;

    /**
     * DNS Record type.
     */
    type?: 'txt';

    /**
     * Content for the record.
     */
    value?: string;
  }

  /**
   * This presents the token to be served by the given http url to activate a
   * hostname.
   */
  export interface OwnershipVerificationHTTP {
    /**
     * Token to be served.
     */
    http_body?: string;

    /**
     * The HTTP URL that will be checked during custom hostname verification and where
     * the customer should host the token.
     */
    http_url?: string;
  }
}

export interface CertificateDeleteResponse {
  /**
   * Identifier.
   */
  id?: string;
}

export interface CertificateUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: If a custom uploaded certificate is used.
   */
  custom_certificate: string;

  /**
   * Body param: The key for a custom uploaded certificate.
   */
  custom_key: string;
}

export interface CertificateDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace Certificates {
  export {
    type CertificateUpdateResponse as CertificateUpdateResponse,
    type CertificateDeleteResponse as CertificateDeleteResponse,
    type CertificateUpdateParams as CertificateUpdateParams,
    type CertificateDeleteParams as CertificateDeleteParams,
  };
}
