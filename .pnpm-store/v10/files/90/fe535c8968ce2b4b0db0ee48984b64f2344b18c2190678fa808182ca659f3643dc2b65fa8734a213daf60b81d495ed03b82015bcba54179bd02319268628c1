// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as CustomHostnamesAPI from './custom-hostnames';
import * as Shared from '../shared';
import * as FallbackOriginAPI from './fallback-origin';
import {
  FallbackOrigin,
  FallbackOriginDeleteParams,
  FallbackOriginDeleteResponse,
  FallbackOriginGetParams,
  FallbackOriginGetResponse,
  FallbackOriginUpdateParams,
  FallbackOriginUpdateResponse,
} from './fallback-origin';
import * as CertificatePackAPI from './certificate-pack/certificate-pack';
import { CertificatePack } from './certificate-pack/certificate-pack';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class CustomHostnames extends APIResource {
  fallbackOrigin: FallbackOriginAPI.FallbackOrigin = new FallbackOriginAPI.FallbackOrigin(this._client);
  certificatePack: CertificatePackAPI.CertificatePack = new CertificatePackAPI.CertificatePack(this._client);

  /**
   * Add a new custom hostname and request that an SSL certificate be issued for it.
   * One of three validation methods—http, txt, email—should be used, with 'http'
   * recommended if the CNAME is already in place (or will be soon). Specifying
   * 'email' will send an email to the WHOIS contacts on file for the base domain
   * plus hostmaster, postmaster, webmaster, admin, administrator. If http is used
   * and the domain is not already pointing to the Managed CNAME host, the PATCH
   * method must be used once it is (to complete validation). Enable bundling of
   * certificates using the custom_cert_bundle field. The bundling process requires
   * the following condition One certificate in the bundle must use an RSA, and the
   * other must use an ECDSA.
   *
   * @example
   * ```ts
   * const customHostname = await client.customHostnames.create({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   hostname: 'app.example.com',
   *   ssl: {},
   * });
   * ```
   */
  create(
    params: CustomHostnameCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomHostnameCreateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/custom_hostnames`, { body, ...options }) as Core.APIPromise<{
        result: CustomHostnameCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List, search, sort, and filter all of your custom hostnames.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const customHostnameListResponse of client.customHostnames.list(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: CustomHostnameListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CustomHostnameListResponsesV4PagePaginationArray, CustomHostnameListResponse> {
    const { zone_id, ...query } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/custom_hostnames`,
      CustomHostnameListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Delete Custom Hostname (and any issued SSL certificates)
   *
   * @example
   * ```ts
   * const customHostname = await client.customHostnames.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    customHostnameId: string,
    params: CustomHostnameDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomHostnameDeleteResponse> {
    const { zone_id } = params;
    return this._client.delete(`/zones/${zone_id}/custom_hostnames/${customHostnameId}`, options);
  }

  /**
   * Modify SSL configuration for a custom hostname. When sent with SSL config that
   * matches existing config, used to indicate that hostname should pass domain
   * control validation (DCV). Can also be used to change validation type, e.g., from
   * 'http' to 'email'. Bundle an existing certificate with another certificate by
   * using the "custom_cert_bundle" field. The bundling process supports combining
   * certificates as long as the following condition is met. One certificate must use
   * the RSA algorithm, and the other must use the ECDSA algorithm.
   *
   * @example
   * ```ts
   * const response = await client.customHostnames.edit(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  edit(
    customHostnameId: string,
    params: CustomHostnameEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomHostnameEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/custom_hostnames/${customHostnameId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CustomHostnameEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Custom Hostname Details
   *
   * @example
   * ```ts
   * const customHostname = await client.customHostnames.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    customHostnameId: string,
    params: CustomHostnameGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomHostnameGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/custom_hostnames/${customHostnameId}`, options) as Core.APIPromise<{
        result: CustomHostnameGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class CustomHostnameListResponsesV4PagePaginationArray extends V4PagePaginationArray<CustomHostnameListResponse> {}

/**
 * A ubiquitous bundle has the highest probability of being verified everywhere,
 * even by clients using outdated or unusual trust stores. An optimal bundle uses
 * the shortest chain and newest intermediates. And the force bundle verifies the
 * chain, but does not otherwise modify it.
 */
export type BundleMethod = 'ubiquitous' | 'optimal' | 'force';

/**
 * A ubiquitous bundle has the highest probability of being verified everywhere,
 * even by clients using outdated or unusual trust stores. An optimal bundle uses
 * the shortest chain and newest intermediates. And the force bundle verifies the
 * chain, but does not otherwise modify it.
 */
export type BundleMethodParam = 'ubiquitous' | 'optimal' | 'force';

export interface CustomHostname {
  /**
   * Identifier.
   */
  id: string;

  /**
   * The custom hostname that will point to your hostname via CNAME.
   */
  hostname: string;

  ssl: CustomHostname.SSL;

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
  ownership_verification?: CustomHostname.OwnershipVerification;

  /**
   * This presents the token to be served by the given http url to activate a
   * hostname.
   */
  ownership_verification_http?: CustomHostname.OwnershipVerificationHTTP;

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

export namespace CustomHostname {
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

/**
 * Domain control validation (DCV) method used for this hostname.
 */
export type DCVMethod = 'http' | 'txt' | 'email';

/**
 * Domain control validation (DCV) method used for this hostname.
 */
export type DCVMethodParam = 'http' | 'txt' | 'email';

/**
 * Level of validation to be used for this hostname. Domain validation (dv) must be
 * used.
 */
export type DomainValidationType = 'dv';

/**
 * Level of validation to be used for this hostname. Domain validation (dv) must be
 * used.
 */
export type DomainValidationTypeParam = 'dv';

export interface CustomHostnameCreateResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * The custom hostname that will point to your hostname via CNAME.
   */
  hostname: string;

  ssl: CustomHostnameCreateResponse.SSL;

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
  ownership_verification?: CustomHostnameCreateResponse.OwnershipVerification;

  /**
   * This presents the token to be served by the given http url to activate a
   * hostname.
   */
  ownership_verification_http?: CustomHostnameCreateResponse.OwnershipVerificationHTTP;

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

export namespace CustomHostnameCreateResponse {
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

export interface CustomHostnameListResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * The custom hostname that will point to your hostname via CNAME.
   */
  hostname: string;

  ssl: CustomHostnameListResponse.SSL;

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
  ownership_verification?: CustomHostnameListResponse.OwnershipVerification;

  /**
   * This presents the token to be served by the given http url to activate a
   * hostname.
   */
  ownership_verification_http?: CustomHostnameListResponse.OwnershipVerificationHTTP;

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

export namespace CustomHostnameListResponse {
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

export interface CustomHostnameDeleteResponse {
  /**
   * Identifier.
   */
  id?: string;
}

export interface CustomHostnameEditResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * The custom hostname that will point to your hostname via CNAME.
   */
  hostname: string;

  ssl: CustomHostnameEditResponse.SSL;

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
  ownership_verification?: CustomHostnameEditResponse.OwnershipVerification;

  /**
   * This presents the token to be served by the given http url to activate a
   * hostname.
   */
  ownership_verification_http?: CustomHostnameEditResponse.OwnershipVerificationHTTP;

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

export namespace CustomHostnameEditResponse {
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

export interface CustomHostnameGetResponse {
  /**
   * Identifier.
   */
  id: string;

  /**
   * The custom hostname that will point to your hostname via CNAME.
   */
  hostname: string;

  ssl: CustomHostnameGetResponse.SSL;

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
  ownership_verification?: CustomHostnameGetResponse.OwnershipVerification;

  /**
   * This presents the token to be served by the given http url to activate a
   * hostname.
   */
  ownership_verification_http?: CustomHostnameGetResponse.OwnershipVerificationHTTP;

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

export namespace CustomHostnameGetResponse {
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

export interface CustomHostnameCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: The custom hostname that will point to your hostname via CNAME.
   */
  hostname: string;

  /**
   * Body param: SSL properties used when creating the custom hostname.
   */
  ssl: CustomHostnameCreateParams.SSL;

  /**
   * Body param: Unique key/value metadata for this hostname. These are per-hostname
   * (customer) settings.
   */
  custom_metadata?: { [key: string]: string };
}

export namespace CustomHostnameCreateParams {
  /**
   * SSL properties used when creating the custom hostname.
   */
  export interface SSL {
    /**
     * A ubiquitous bundle has the highest probability of being verified everywhere,
     * even by clients using outdated or unusual trust stores. An optimal bundle uses
     * the shortest chain and newest intermediates. And the force bundle verifies the
     * chain, but does not otherwise modify it.
     */
    bundle_method?: CustomHostnamesAPI.BundleMethodParam;

    /**
     * The Certificate Authority that will issue the certificate
     */
    certificate_authority?: Shared.CertificateCAParam;

    /**
     * Whether or not to add Cloudflare Branding for the order. This will add a
     * subdomain of sni.cloudflaressl.com as the Common Name if set to true
     */
    cloudflare_branding?: boolean;

    /**
     * Array of custom certificate and key pairs (1 or 2 pairs allowed)
     */
    custom_cert_bundle?: Array<SSL.CustomCERTBundle>;

    /**
     * If a custom uploaded certificate is used.
     */
    custom_certificate?: string;

    /**
     * The key for a custom uploaded certificate.
     */
    custom_key?: string;

    /**
     * Domain control validation (DCV) method used for this hostname.
     */
    method?: CustomHostnamesAPI.DCVMethodParam;

    /**
     * SSL specific settings.
     */
    settings?: SSL.Settings;

    /**
     * Level of validation to be used for this hostname. Domain validation (dv) must be
     * used.
     */
    type?: CustomHostnamesAPI.DomainValidationTypeParam;

    /**
     * Indicates whether the certificate covers a wildcard.
     */
    wildcard?: boolean;
  }

  export namespace SSL {
    export interface CustomCERTBundle {
      /**
       * If a custom uploaded certificate is used.
       */
      custom_certificate: string;

      /**
       * The key for a custom uploaded certificate.
       */
      custom_key: string;
    }

    /**
     * SSL specific settings.
     */
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
  }
}

export interface CustomHostnameListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param: Hostname ID to match against. This ID was generated and returned
   * during the initial custom_hostname creation. This parameter cannot be used with
   * the 'hostname' parameter.
   */
  id?: string;

  /**
   * Query param: Direction to order hostnames.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: Fully qualified domain name to match against. This parameter cannot
   * be used with the 'id' parameter.
   */
  hostname?: string;

  /**
   * Query param: Field to order hostnames by.
   */
  order?: 'ssl' | 'ssl_status';

  /**
   * Query param: Whether to filter hostnames based on if they have SSL enabled.
   */
  ssl?: 0 | 1;
}

export interface CustomHostnameDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface CustomHostnameEditParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Unique key/value metadata for this hostname. These are per-hostname
   * (customer) settings.
   */
  custom_metadata?: { [key: string]: string };

  /**
   * Body param: a valid hostname that’s been added to your DNS zone as an A, AAAA,
   * or CNAME record.
   */
  custom_origin_server?: string;

  /**
   * Body param: A hostname that will be sent to your custom origin server as SNI for
   * TLS handshake. This can be a valid subdomain of the zone or custom origin server
   * name or the string ':request_host_header:' which will cause the host header in
   * the request to be used as SNI. Not configurable with default/fallback origin
   * server.
   */
  custom_origin_sni?: string;

  /**
   * Body param: SSL properties used when creating the custom hostname.
   */
  ssl?: CustomHostnameEditParams.SSL;
}

export namespace CustomHostnameEditParams {
  /**
   * SSL properties used when creating the custom hostname.
   */
  export interface SSL {
    /**
     * A ubiquitous bundle has the highest probability of being verified everywhere,
     * even by clients using outdated or unusual trust stores. An optimal bundle uses
     * the shortest chain and newest intermediates. And the force bundle verifies the
     * chain, but does not otherwise modify it.
     */
    bundle_method?: CustomHostnamesAPI.BundleMethodParam;

    /**
     * The Certificate Authority that will issue the certificate
     */
    certificate_authority?: Shared.CertificateCAParam;

    /**
     * Whether or not to add Cloudflare Branding for the order. This will add a
     * subdomain of sni.cloudflaressl.com as the Common Name if set to true
     */
    cloudflare_branding?: boolean;

    /**
     * Array of custom certificate and key pairs (1 or 2 pairs allowed)
     */
    custom_cert_bundle?: Array<SSL.CustomCERTBundle>;

    /**
     * If a custom uploaded certificate is used.
     */
    custom_certificate?: string;

    /**
     * The key for a custom uploaded certificate.
     */
    custom_key?: string;

    /**
     * Domain control validation (DCV) method used for this hostname.
     */
    method?: CustomHostnamesAPI.DCVMethodParam;

    /**
     * SSL specific settings.
     */
    settings?: SSL.Settings;

    /**
     * Level of validation to be used for this hostname. Domain validation (dv) must be
     * used.
     */
    type?: CustomHostnamesAPI.DomainValidationTypeParam;

    /**
     * Indicates whether the certificate covers a wildcard.
     */
    wildcard?: boolean;
  }

  export namespace SSL {
    export interface CustomCERTBundle {
      /**
       * If a custom uploaded certificate is used.
       */
      custom_certificate: string;

      /**
       * The key for a custom uploaded certificate.
       */
      custom_key: string;
    }

    /**
     * SSL specific settings.
     */
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
  }
}

export interface CustomHostnameGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

CustomHostnames.CustomHostnameListResponsesV4PagePaginationArray =
  CustomHostnameListResponsesV4PagePaginationArray;
CustomHostnames.FallbackOrigin = FallbackOrigin;
CustomHostnames.CertificatePack = CertificatePack;

export declare namespace CustomHostnames {
  export {
    type BundleMethod as BundleMethod,
    type CustomHostname as CustomHostname,
    type DCVMethod as DCVMethod,
    type DomainValidationType as DomainValidationType,
    type CustomHostnameCreateResponse as CustomHostnameCreateResponse,
    type CustomHostnameListResponse as CustomHostnameListResponse,
    type CustomHostnameDeleteResponse as CustomHostnameDeleteResponse,
    type CustomHostnameEditResponse as CustomHostnameEditResponse,
    type CustomHostnameGetResponse as CustomHostnameGetResponse,
    CustomHostnameListResponsesV4PagePaginationArray as CustomHostnameListResponsesV4PagePaginationArray,
    type CustomHostnameCreateParams as CustomHostnameCreateParams,
    type CustomHostnameListParams as CustomHostnameListParams,
    type CustomHostnameDeleteParams as CustomHostnameDeleteParams,
    type CustomHostnameEditParams as CustomHostnameEditParams,
    type CustomHostnameGetParams as CustomHostnameGetParams,
  };

  export {
    FallbackOrigin as FallbackOrigin,
    type FallbackOriginUpdateResponse as FallbackOriginUpdateResponse,
    type FallbackOriginDeleteResponse as FallbackOriginDeleteResponse,
    type FallbackOriginGetResponse as FallbackOriginGetResponse,
    type FallbackOriginUpdateParams as FallbackOriginUpdateParams,
    type FallbackOriginDeleteParams as FallbackOriginDeleteParams,
    type FallbackOriginGetParams as FallbackOriginGetParams,
  };

  export { CertificatePack as CertificatePack };
}
