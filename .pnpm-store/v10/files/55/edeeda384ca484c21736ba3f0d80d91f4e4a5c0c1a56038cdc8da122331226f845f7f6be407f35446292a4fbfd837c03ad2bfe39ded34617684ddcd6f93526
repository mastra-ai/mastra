// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class Configurations extends APIResource {
  /**
   * Adds or updates the configuration for a remotely-managed tunnel.
   *
   * @example
   * ```ts
   * const configuration =
   *   await client.zeroTrust.tunnels.cloudflared.configurations.update(
   *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  update(
    tunnelId: string,
    params: ConfigurationUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ConfigurationUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/cfd_tunnel/${tunnelId}/configurations`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ConfigurationUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Gets the configuration for a remotely-managed tunnel
   *
   * @example
   * ```ts
   * const configuration =
   *   await client.zeroTrust.tunnels.cloudflared.configurations.get(
   *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    tunnelId: string,
    params: ConfigurationGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ConfigurationGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/cfd_tunnel/${tunnelId}/configurations`,
        options,
      ) as Core.APIPromise<{ result: ConfigurationGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Cloudflare Tunnel configuration
 */
export interface ConfigurationUpdateResponse {
  /**
   * Identifier.
   */
  account_id?: string;

  /**
   * The tunnel configuration and ingress rules.
   */
  config?: ConfigurationUpdateResponse.Config;

  created_at?: string;

  /**
   * Indicates if this is a locally or remotely configured tunnel. If `local`, manage
   * the tunnel using a YAML file on the origin machine. If `cloudflare`, manage the
   * tunnel's configuration on the Zero Trust dashboard.
   */
  source?: 'local' | 'cloudflare';

  /**
   * UUID of the tunnel.
   */
  tunnel_id?: string;

  /**
   * The version of the Tunnel Configuration.
   */
  version?: number;
}

export namespace ConfigurationUpdateResponse {
  /**
   * The tunnel configuration and ingress rules.
   */
  export interface Config {
    /**
     * List of public hostname definitions. At least one ingress rule needs to be
     * defined for the tunnel.
     */
    ingress?: Array<Config.Ingress>;

    /**
     * Configuration parameters for the public hostname specific connection settings
     * between cloudflared and origin server.
     */
    originRequest?: Config.OriginRequest;

    /**
     * Enable private network access from WARP users to private network routes. This is
     * enabled if the tunnel has an assigned route.
     */
    'warp-routing'?: Config.WARPRouting;
  }

  export namespace Config {
    /**
     * Public hostname
     */
    export interface Ingress {
      /**
       * Public hostname for this service.
       */
      hostname: string;

      /**
       * Protocol and address of destination server. Supported protocols: http://,
       * https://, unix://, tcp://, ssh://, rdp://, unix+tls://, smb://. Alternatively
       * can return a HTTP status code http_status:[code] e.g. 'http_status:404'.
       */
      service: string;

      /**
       * Configuration parameters for the public hostname specific connection settings
       * between cloudflared and origin server.
       */
      originRequest?: Ingress.OriginRequest;

      /**
       * Requests with this path route to this public hostname.
       */
      path?: string;
    }

    export namespace Ingress {
      /**
       * Configuration parameters for the public hostname specific connection settings
       * between cloudflared and origin server.
       */
      export interface OriginRequest {
        /**
         * For all L7 requests to this hostname, cloudflared will validate each request's
         * Cf-Access-Jwt-Assertion request header.
         */
        access?: OriginRequest.Access;

        /**
         * Path to the certificate authority (CA) for the certificate of your origin. This
         * option should be used only if your certificate is not signed by Cloudflare.
         */
        caPool?: string;

        /**
         * Timeout for establishing a new TCP connection to your origin server. This
         * excludes the time taken to establish TLS, which is controlled by tlsTimeout.
         */
        connectTimeout?: number;

        /**
         * Disables chunked transfer encoding. Useful if you are running a WSGI server.
         */
        disableChunkedEncoding?: boolean;

        /**
         * Attempt to connect to origin using HTTP2. Origin must be configured as https.
         */
        http2Origin?: boolean;

        /**
         * Sets the HTTP Host header on requests sent to the local service.
         */
        httpHostHeader?: string;

        /**
         * Maximum number of idle keepalive connections between Tunnel and your origin.
         * This does not restrict the total number of concurrent connections.
         */
        keepAliveConnections?: number;

        /**
         * Timeout after which an idle keepalive connection can be discarded.
         */
        keepAliveTimeout?: number;

        /**
         * Disable the “happy eyeballs” algorithm for IPv4/IPv6 fallback if your local
         * network has misconfigured one of the protocols.
         */
        noHappyEyeballs?: boolean;

        /**
         * Disables TLS verification of the certificate presented by your origin. Will
         * allow any certificate from the origin to be accepted.
         */
        noTLSVerify?: boolean;

        /**
         * Hostname that cloudflared should expect from your origin server certificate.
         */
        originServerName?: string;

        /**
         * cloudflared starts a proxy server to translate HTTP traffic into TCP when
         * proxying, for example, SSH or RDP. This configures what type of proxy will be
         * started. Valid options are: "" for the regular proxy and "socks" for a SOCKS5
         * proxy.
         */
        proxyType?: string;

        /**
         * The timeout after which a TCP keepalive packet is sent on a connection between
         * Tunnel and the origin server.
         */
        tcpKeepAlive?: number;

        /**
         * Timeout for completing a TLS handshake to your origin server, if you have chosen
         * to connect Tunnel to an HTTPS server.
         */
        tlsTimeout?: number;
      }

      export namespace OriginRequest {
        /**
         * For all L7 requests to this hostname, cloudflared will validate each request's
         * Cf-Access-Jwt-Assertion request header.
         */
        export interface Access {
          /**
           * Access applications that are allowed to reach this hostname for this Tunnel.
           * Audience tags can be identified in the dashboard or via the List Access policies
           * API.
           */
          audTag: Array<string>;

          teamName: string;

          /**
           * Deny traffic that has not fulfilled Access authorization.
           */
          required?: boolean;
        }
      }
    }

    /**
     * Configuration parameters for the public hostname specific connection settings
     * between cloudflared and origin server.
     */
    export interface OriginRequest {
      /**
       * For all L7 requests to this hostname, cloudflared will validate each request's
       * Cf-Access-Jwt-Assertion request header.
       */
      access?: OriginRequest.Access;

      /**
       * Path to the certificate authority (CA) for the certificate of your origin. This
       * option should be used only if your certificate is not signed by Cloudflare.
       */
      caPool?: string;

      /**
       * Timeout for establishing a new TCP connection to your origin server. This
       * excludes the time taken to establish TLS, which is controlled by tlsTimeout.
       */
      connectTimeout?: number;

      /**
       * Disables chunked transfer encoding. Useful if you are running a WSGI server.
       */
      disableChunkedEncoding?: boolean;

      /**
       * Attempt to connect to origin using HTTP2. Origin must be configured as https.
       */
      http2Origin?: boolean;

      /**
       * Sets the HTTP Host header on requests sent to the local service.
       */
      httpHostHeader?: string;

      /**
       * Maximum number of idle keepalive connections between Tunnel and your origin.
       * This does not restrict the total number of concurrent connections.
       */
      keepAliveConnections?: number;

      /**
       * Timeout after which an idle keepalive connection can be discarded.
       */
      keepAliveTimeout?: number;

      /**
       * Disable the “happy eyeballs” algorithm for IPv4/IPv6 fallback if your local
       * network has misconfigured one of the protocols.
       */
      noHappyEyeballs?: boolean;

      /**
       * Disables TLS verification of the certificate presented by your origin. Will
       * allow any certificate from the origin to be accepted.
       */
      noTLSVerify?: boolean;

      /**
       * Hostname that cloudflared should expect from your origin server certificate.
       */
      originServerName?: string;

      /**
       * cloudflared starts a proxy server to translate HTTP traffic into TCP when
       * proxying, for example, SSH or RDP. This configures what type of proxy will be
       * started. Valid options are: "" for the regular proxy and "socks" for a SOCKS5
       * proxy.
       */
      proxyType?: string;

      /**
       * The timeout after which a TCP keepalive packet is sent on a connection between
       * Tunnel and the origin server.
       */
      tcpKeepAlive?: number;

      /**
       * Timeout for completing a TLS handshake to your origin server, if you have chosen
       * to connect Tunnel to an HTTPS server.
       */
      tlsTimeout?: number;
    }

    export namespace OriginRequest {
      /**
       * For all L7 requests to this hostname, cloudflared will validate each request's
       * Cf-Access-Jwt-Assertion request header.
       */
      export interface Access {
        /**
         * Access applications that are allowed to reach this hostname for this Tunnel.
         * Audience tags can be identified in the dashboard or via the List Access policies
         * API.
         */
        audTag: Array<string>;

        teamName: string;

        /**
         * Deny traffic that has not fulfilled Access authorization.
         */
        required?: boolean;
      }
    }

    /**
     * Enable private network access from WARP users to private network routes. This is
     * enabled if the tunnel has an assigned route.
     */
    export interface WARPRouting {
      enabled?: boolean;
    }
  }
}

/**
 * Cloudflare Tunnel configuration
 */
export interface ConfigurationGetResponse {
  /**
   * Identifier.
   */
  account_id?: string;

  /**
   * The tunnel configuration and ingress rules.
   */
  config?: ConfigurationGetResponse.Config;

  created_at?: string;

  /**
   * Indicates if this is a locally or remotely configured tunnel. If `local`, manage
   * the tunnel using a YAML file on the origin machine. If `cloudflare`, manage the
   * tunnel's configuration on the Zero Trust dashboard.
   */
  source?: 'local' | 'cloudflare';

  /**
   * UUID of the tunnel.
   */
  tunnel_id?: string;

  /**
   * The version of the Tunnel Configuration.
   */
  version?: number;
}

export namespace ConfigurationGetResponse {
  /**
   * The tunnel configuration and ingress rules.
   */
  export interface Config {
    /**
     * List of public hostname definitions. At least one ingress rule needs to be
     * defined for the tunnel.
     */
    ingress?: Array<Config.Ingress>;

    /**
     * Configuration parameters for the public hostname specific connection settings
     * between cloudflared and origin server.
     */
    originRequest?: Config.OriginRequest;

    /**
     * Enable private network access from WARP users to private network routes. This is
     * enabled if the tunnel has an assigned route.
     */
    'warp-routing'?: Config.WARPRouting;
  }

  export namespace Config {
    /**
     * Public hostname
     */
    export interface Ingress {
      /**
       * Public hostname for this service.
       */
      hostname: string;

      /**
       * Protocol and address of destination server. Supported protocols: http://,
       * https://, unix://, tcp://, ssh://, rdp://, unix+tls://, smb://. Alternatively
       * can return a HTTP status code http_status:[code] e.g. 'http_status:404'.
       */
      service: string;

      /**
       * Configuration parameters for the public hostname specific connection settings
       * between cloudflared and origin server.
       */
      originRequest?: Ingress.OriginRequest;

      /**
       * Requests with this path route to this public hostname.
       */
      path?: string;
    }

    export namespace Ingress {
      /**
       * Configuration parameters for the public hostname specific connection settings
       * between cloudflared and origin server.
       */
      export interface OriginRequest {
        /**
         * For all L7 requests to this hostname, cloudflared will validate each request's
         * Cf-Access-Jwt-Assertion request header.
         */
        access?: OriginRequest.Access;

        /**
         * Path to the certificate authority (CA) for the certificate of your origin. This
         * option should be used only if your certificate is not signed by Cloudflare.
         */
        caPool?: string;

        /**
         * Timeout for establishing a new TCP connection to your origin server. This
         * excludes the time taken to establish TLS, which is controlled by tlsTimeout.
         */
        connectTimeout?: number;

        /**
         * Disables chunked transfer encoding. Useful if you are running a WSGI server.
         */
        disableChunkedEncoding?: boolean;

        /**
         * Attempt to connect to origin using HTTP2. Origin must be configured as https.
         */
        http2Origin?: boolean;

        /**
         * Sets the HTTP Host header on requests sent to the local service.
         */
        httpHostHeader?: string;

        /**
         * Maximum number of idle keepalive connections between Tunnel and your origin.
         * This does not restrict the total number of concurrent connections.
         */
        keepAliveConnections?: number;

        /**
         * Timeout after which an idle keepalive connection can be discarded.
         */
        keepAliveTimeout?: number;

        /**
         * Disable the “happy eyeballs” algorithm for IPv4/IPv6 fallback if your local
         * network has misconfigured one of the protocols.
         */
        noHappyEyeballs?: boolean;

        /**
         * Disables TLS verification of the certificate presented by your origin. Will
         * allow any certificate from the origin to be accepted.
         */
        noTLSVerify?: boolean;

        /**
         * Hostname that cloudflared should expect from your origin server certificate.
         */
        originServerName?: string;

        /**
         * cloudflared starts a proxy server to translate HTTP traffic into TCP when
         * proxying, for example, SSH or RDP. This configures what type of proxy will be
         * started. Valid options are: "" for the regular proxy and "socks" for a SOCKS5
         * proxy.
         */
        proxyType?: string;

        /**
         * The timeout after which a TCP keepalive packet is sent on a connection between
         * Tunnel and the origin server.
         */
        tcpKeepAlive?: number;

        /**
         * Timeout for completing a TLS handshake to your origin server, if you have chosen
         * to connect Tunnel to an HTTPS server.
         */
        tlsTimeout?: number;
      }

      export namespace OriginRequest {
        /**
         * For all L7 requests to this hostname, cloudflared will validate each request's
         * Cf-Access-Jwt-Assertion request header.
         */
        export interface Access {
          /**
           * Access applications that are allowed to reach this hostname for this Tunnel.
           * Audience tags can be identified in the dashboard or via the List Access policies
           * API.
           */
          audTag: Array<string>;

          teamName: string;

          /**
           * Deny traffic that has not fulfilled Access authorization.
           */
          required?: boolean;
        }
      }
    }

    /**
     * Configuration parameters for the public hostname specific connection settings
     * between cloudflared and origin server.
     */
    export interface OriginRequest {
      /**
       * For all L7 requests to this hostname, cloudflared will validate each request's
       * Cf-Access-Jwt-Assertion request header.
       */
      access?: OriginRequest.Access;

      /**
       * Path to the certificate authority (CA) for the certificate of your origin. This
       * option should be used only if your certificate is not signed by Cloudflare.
       */
      caPool?: string;

      /**
       * Timeout for establishing a new TCP connection to your origin server. This
       * excludes the time taken to establish TLS, which is controlled by tlsTimeout.
       */
      connectTimeout?: number;

      /**
       * Disables chunked transfer encoding. Useful if you are running a WSGI server.
       */
      disableChunkedEncoding?: boolean;

      /**
       * Attempt to connect to origin using HTTP2. Origin must be configured as https.
       */
      http2Origin?: boolean;

      /**
       * Sets the HTTP Host header on requests sent to the local service.
       */
      httpHostHeader?: string;

      /**
       * Maximum number of idle keepalive connections between Tunnel and your origin.
       * This does not restrict the total number of concurrent connections.
       */
      keepAliveConnections?: number;

      /**
       * Timeout after which an idle keepalive connection can be discarded.
       */
      keepAliveTimeout?: number;

      /**
       * Disable the “happy eyeballs” algorithm for IPv4/IPv6 fallback if your local
       * network has misconfigured one of the protocols.
       */
      noHappyEyeballs?: boolean;

      /**
       * Disables TLS verification of the certificate presented by your origin. Will
       * allow any certificate from the origin to be accepted.
       */
      noTLSVerify?: boolean;

      /**
       * Hostname that cloudflared should expect from your origin server certificate.
       */
      originServerName?: string;

      /**
       * cloudflared starts a proxy server to translate HTTP traffic into TCP when
       * proxying, for example, SSH or RDP. This configures what type of proxy will be
       * started. Valid options are: "" for the regular proxy and "socks" for a SOCKS5
       * proxy.
       */
      proxyType?: string;

      /**
       * The timeout after which a TCP keepalive packet is sent on a connection between
       * Tunnel and the origin server.
       */
      tcpKeepAlive?: number;

      /**
       * Timeout for completing a TLS handshake to your origin server, if you have chosen
       * to connect Tunnel to an HTTPS server.
       */
      tlsTimeout?: number;
    }

    export namespace OriginRequest {
      /**
       * For all L7 requests to this hostname, cloudflared will validate each request's
       * Cf-Access-Jwt-Assertion request header.
       */
      export interface Access {
        /**
         * Access applications that are allowed to reach this hostname for this Tunnel.
         * Audience tags can be identified in the dashboard or via the List Access policies
         * API.
         */
        audTag: Array<string>;

        teamName: string;

        /**
         * Deny traffic that has not fulfilled Access authorization.
         */
        required?: boolean;
      }
    }

    /**
     * Enable private network access from WARP users to private network routes. This is
     * enabled if the tunnel has an assigned route.
     */
    export interface WARPRouting {
      enabled?: boolean;
    }
  }
}

export interface ConfigurationUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: The tunnel configuration and ingress rules.
   */
  config?: ConfigurationUpdateParams.Config;
}

export namespace ConfigurationUpdateParams {
  /**
   * The tunnel configuration and ingress rules.
   */
  export interface Config {
    /**
     * List of public hostname definitions. At least one ingress rule needs to be
     * defined for the tunnel.
     */
    ingress?: Array<Config.Ingress>;

    /**
     * Configuration parameters for the public hostname specific connection settings
     * between cloudflared and origin server.
     */
    originRequest?: Config.OriginRequest;
  }

  export namespace Config {
    /**
     * Public hostname
     */
    export interface Ingress {
      /**
       * Public hostname for this service.
       */
      hostname: string;

      /**
       * Protocol and address of destination server. Supported protocols: http://,
       * https://, unix://, tcp://, ssh://, rdp://, unix+tls://, smb://. Alternatively
       * can return a HTTP status code http_status:[code] e.g. 'http_status:404'.
       */
      service: string;

      /**
       * Configuration parameters for the public hostname specific connection settings
       * between cloudflared and origin server.
       */
      originRequest?: Ingress.OriginRequest;

      /**
       * Requests with this path route to this public hostname.
       */
      path?: string;
    }

    export namespace Ingress {
      /**
       * Configuration parameters for the public hostname specific connection settings
       * between cloudflared and origin server.
       */
      export interface OriginRequest {
        /**
         * For all L7 requests to this hostname, cloudflared will validate each request's
         * Cf-Access-Jwt-Assertion request header.
         */
        access?: OriginRequest.Access;

        /**
         * Path to the certificate authority (CA) for the certificate of your origin. This
         * option should be used only if your certificate is not signed by Cloudflare.
         */
        caPool?: string;

        /**
         * Timeout for establishing a new TCP connection to your origin server. This
         * excludes the time taken to establish TLS, which is controlled by tlsTimeout.
         */
        connectTimeout?: number;

        /**
         * Disables chunked transfer encoding. Useful if you are running a WSGI server.
         */
        disableChunkedEncoding?: boolean;

        /**
         * Attempt to connect to origin using HTTP2. Origin must be configured as https.
         */
        http2Origin?: boolean;

        /**
         * Sets the HTTP Host header on requests sent to the local service.
         */
        httpHostHeader?: string;

        /**
         * Maximum number of idle keepalive connections between Tunnel and your origin.
         * This does not restrict the total number of concurrent connections.
         */
        keepAliveConnections?: number;

        /**
         * Timeout after which an idle keepalive connection can be discarded.
         */
        keepAliveTimeout?: number;

        /**
         * Disable the “happy eyeballs” algorithm for IPv4/IPv6 fallback if your local
         * network has misconfigured one of the protocols.
         */
        noHappyEyeballs?: boolean;

        /**
         * Disables TLS verification of the certificate presented by your origin. Will
         * allow any certificate from the origin to be accepted.
         */
        noTLSVerify?: boolean;

        /**
         * Hostname that cloudflared should expect from your origin server certificate.
         */
        originServerName?: string;

        /**
         * cloudflared starts a proxy server to translate HTTP traffic into TCP when
         * proxying, for example, SSH or RDP. This configures what type of proxy will be
         * started. Valid options are: "" for the regular proxy and "socks" for a SOCKS5
         * proxy.
         */
        proxyType?: string;

        /**
         * The timeout after which a TCP keepalive packet is sent on a connection between
         * Tunnel and the origin server.
         */
        tcpKeepAlive?: number;

        /**
         * Timeout for completing a TLS handshake to your origin server, if you have chosen
         * to connect Tunnel to an HTTPS server.
         */
        tlsTimeout?: number;
      }

      export namespace OriginRequest {
        /**
         * For all L7 requests to this hostname, cloudflared will validate each request's
         * Cf-Access-Jwt-Assertion request header.
         */
        export interface Access {
          /**
           * Access applications that are allowed to reach this hostname for this Tunnel.
           * Audience tags can be identified in the dashboard or via the List Access policies
           * API.
           */
          audTag: Array<string>;

          teamName: string;

          /**
           * Deny traffic that has not fulfilled Access authorization.
           */
          required?: boolean;
        }
      }
    }

    /**
     * Configuration parameters for the public hostname specific connection settings
     * between cloudflared and origin server.
     */
    export interface OriginRequest {
      /**
       * For all L7 requests to this hostname, cloudflared will validate each request's
       * Cf-Access-Jwt-Assertion request header.
       */
      access?: OriginRequest.Access;

      /**
       * Path to the certificate authority (CA) for the certificate of your origin. This
       * option should be used only if your certificate is not signed by Cloudflare.
       */
      caPool?: string;

      /**
       * Timeout for establishing a new TCP connection to your origin server. This
       * excludes the time taken to establish TLS, which is controlled by tlsTimeout.
       */
      connectTimeout?: number;

      /**
       * Disables chunked transfer encoding. Useful if you are running a WSGI server.
       */
      disableChunkedEncoding?: boolean;

      /**
       * Attempt to connect to origin using HTTP2. Origin must be configured as https.
       */
      http2Origin?: boolean;

      /**
       * Sets the HTTP Host header on requests sent to the local service.
       */
      httpHostHeader?: string;

      /**
       * Maximum number of idle keepalive connections between Tunnel and your origin.
       * This does not restrict the total number of concurrent connections.
       */
      keepAliveConnections?: number;

      /**
       * Timeout after which an idle keepalive connection can be discarded.
       */
      keepAliveTimeout?: number;

      /**
       * Disable the “happy eyeballs” algorithm for IPv4/IPv6 fallback if your local
       * network has misconfigured one of the protocols.
       */
      noHappyEyeballs?: boolean;

      /**
       * Disables TLS verification of the certificate presented by your origin. Will
       * allow any certificate from the origin to be accepted.
       */
      noTLSVerify?: boolean;

      /**
       * Hostname that cloudflared should expect from your origin server certificate.
       */
      originServerName?: string;

      /**
       * cloudflared starts a proxy server to translate HTTP traffic into TCP when
       * proxying, for example, SSH or RDP. This configures what type of proxy will be
       * started. Valid options are: "" for the regular proxy and "socks" for a SOCKS5
       * proxy.
       */
      proxyType?: string;

      /**
       * The timeout after which a TCP keepalive packet is sent on a connection between
       * Tunnel and the origin server.
       */
      tcpKeepAlive?: number;

      /**
       * Timeout for completing a TLS handshake to your origin server, if you have chosen
       * to connect Tunnel to an HTTPS server.
       */
      tlsTimeout?: number;
    }

    export namespace OriginRequest {
      /**
       * For all L7 requests to this hostname, cloudflared will validate each request's
       * Cf-Access-Jwt-Assertion request header.
       */
      export interface Access {
        /**
         * Access applications that are allowed to reach this hostname for this Tunnel.
         * Audience tags can be identified in the dashboard or via the List Access policies
         * API.
         */
        audTag: Array<string>;

        teamName: string;

        /**
         * Deny traffic that has not fulfilled Access authorization.
         */
        required?: boolean;
      }
    }
  }
}

export interface ConfigurationGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace Configurations {
  export {
    type ConfigurationUpdateResponse as ConfigurationUpdateResponse,
    type ConfigurationGetResponse as ConfigurationGetResponse,
    type ConfigurationUpdateParams as ConfigurationUpdateParams,
    type ConfigurationGetParams as ConfigurationGetParams,
  };
}
