// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as IPSECTunnelsAPI from './ipsec-tunnels';
import * as MagicTransitAPI from './magic-transit';

export class IPSECTunnels extends APIResource {
  /**
   * Creates a new IPsec tunnel associated with an account. Use `?validate_only=true`
   * as an optional query parameter to only run validation without persisting
   * changes.
   *
   * @example
   * ```ts
   * const ipsecTunnel =
   *   await client.magicTransit.ipsecTunnels.create({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     cloudflare_endpoint: '203.0.113.1',
   *     interface_address: '192.0.2.0/31',
   *     name: 'IPsec_1',
   *   });
   * ```
   */
  create(
    params: IPSECTunnelCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPSECTunnelCreateResponse> {
    const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/magic/ipsec_tunnels`, {
        body,
        ...options,
        headers: {
          ...(xMagicNewHcTarget?.toString() != null ?
            { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: IPSECTunnelCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a specific IPsec tunnel associated with an account. Use
   * `?validate_only=true` as an optional query parameter to only run validation
   * without persisting changes.
   *
   * @example
   * ```ts
   * const ipsecTunnel =
   *   await client.magicTransit.ipsecTunnels.update(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       cloudflare_endpoint: '203.0.113.1',
   *       interface_address: '192.0.2.0/31',
   *       name: 'IPsec_1',
   *     },
   *   );
   * ```
   */
  update(
    ipsecTunnelId: string,
    params: IPSECTunnelUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPSECTunnelUpdateResponse> {
    const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/magic/ipsec_tunnels/${ipsecTunnelId}`, {
        body,
        ...options,
        headers: {
          ...(xMagicNewHcTarget?.toString() != null ?
            { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: IPSECTunnelUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists IPsec tunnels associated with an account.
   *
   * @example
   * ```ts
   * const ipsecTunnels =
   *   await client.magicTransit.ipsecTunnels.list({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  list(
    params: IPSECTunnelListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPSECTunnelListResponse> {
    const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
    return (
      this._client.get(`/accounts/${account_id}/magic/ipsec_tunnels`, {
        ...options,
        headers: {
          ...(xMagicNewHcTarget?.toString() != null ?
            { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: IPSECTunnelListResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Disables and removes a specific static IPsec Tunnel associated with an account.
   * Use `?validate_only=true` as an optional query parameter to only run validation
   * without persisting changes.
   *
   * @example
   * ```ts
   * const ipsecTunnel =
   *   await client.magicTransit.ipsecTunnels.delete(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    ipsecTunnelId: string,
    params: IPSECTunnelDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPSECTunnelDeleteResponse> {
    const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
    return (
      this._client.delete(`/accounts/${account_id}/magic/ipsec_tunnels/${ipsecTunnelId}`, {
        ...options,
        headers: {
          ...(xMagicNewHcTarget?.toString() != null ?
            { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: IPSECTunnelDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update multiple IPsec tunnels associated with an account. Use
   * `?validate_only=true` as an optional query parameter to only run validation
   * without persisting changes.
   *
   * @example
   * ```ts
   * const response =
   *   await client.magicTransit.ipsecTunnels.bulkUpdate({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: {},
   *   });
   * ```
   */
  bulkUpdate(
    params: IPSECTunnelBulkUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPSECTunnelBulkUpdateResponse> {
    const { account_id, body, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
    return (
      this._client.put(`/accounts/${account_id}/magic/ipsec_tunnels`, {
        body: body,
        ...options,
        headers: {
          ...(xMagicNewHcTarget?.toString() != null ?
            { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: IPSECTunnelBulkUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists details for a specific IPsec tunnel.
   *
   * @example
   * ```ts
   * const ipsecTunnel =
   *   await client.magicTransit.ipsecTunnels.get(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    ipsecTunnelId: string,
    params: IPSECTunnelGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPSECTunnelGetResponse> {
    const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
    return (
      this._client.get(`/accounts/${account_id}/magic/ipsec_tunnels/${ipsecTunnelId}`, {
        ...options,
        headers: {
          ...(xMagicNewHcTarget?.toString() != null ?
            { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: IPSECTunnelGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Generates a Pre Shared Key for a specific IPsec tunnel used in the IKE session.
   * Use `?validate_only=true` as an optional query parameter to only run validation
   * without persisting changes. After a PSK is generated, the PSK is immediately
   * persisted to Cloudflare's edge and cannot be retrieved later. Note the PSK in a
   * safe place.
   *
   * @example
   * ```ts
   * const response =
   *   await client.magicTransit.ipsecTunnels.pskGenerate(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       body: {},
   *     },
   *   );
   * ```
   */
  pskGenerate(
    ipsecTunnelId: string,
    params: IPSECTunnelPSKGenerateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPSECTunnelPSKGenerateResponse> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/magic/ipsec_tunnels/${ipsecTunnelId}/psk_generate`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: IPSECTunnelPSKGenerateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * The PSK metadata that includes when the PSK was generated.
 */
export interface PSKMetadata {
  /**
   * The date and time the tunnel was last modified.
   */
  last_generated_on?: string;
}

export interface IPSECTunnelCreateResponse {
  /**
   * Identifier
   */
  id: string;

  /**
   * The IP address assigned to the Cloudflare side of the IPsec tunnel.
   */
  cloudflare_endpoint: string;

  /**
   * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
   * of the tunnel. Select the subnet from the following private IP space:
   * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
   */
  interface_address: string;

  /**
   * The name of the IPsec tunnel. The name cannot share a name with other tunnels.
   */
  name: string;

  /**
   * When `true`, the tunnel can use a null-cipher (`ENCR_NULL`) in the ESP tunnel
   * (Phase 2).
   */
  allow_null_cipher?: boolean;

  /**
   * The date and time the tunnel was created.
   */
  created_on?: string;

  /**
   * The IP address assigned to the customer side of the IPsec tunnel. Not required,
   * but must be set for proactive traceroutes to work.
   */
  customer_endpoint?: string;

  /**
   * An optional description forthe IPsec tunnel.
   */
  description?: string;

  health_check?: IPSECTunnelCreateResponse.HealthCheck;

  /**
   * The date and time the tunnel was last modified.
   */
  modified_on?: string;

  /**
   * The PSK metadata that includes when the PSK was generated.
   */
  psk_metadata?: PSKMetadata;

  /**
   * If `true`, then IPsec replay protection will be supported in the
   * Cloudflare-to-customer direction.
   */
  replay_protection?: boolean;
}

export namespace IPSECTunnelCreateResponse {
  export interface HealthCheck {
    /**
     * The direction of the flow of the healthcheck. Either unidirectional, where the
     * probe comes to you via the tunnel and the result comes back to Cloudflare via
     * the open Internet, or bidirectional where both the probe and result come and go
     * via the tunnel.
     */
    direction?: 'unidirectional' | 'bidirectional';

    /**
     * Determines whether to run healthchecks for a tunnel.
     */
    enabled?: boolean;

    /**
     * How frequent the health check is run. The default value is `mid`.
     */
    rate?: MagicTransitAPI.HealthCheckRate;

    /**
     * The destination address in a request type health check. After the healthcheck is
     * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
     * to this address. This field defaults to `customer_gre_endpoint address`. This
     * field is ignored for bidirectional healthchecks as the interface_address (not
     * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
     * object form if the x-magic-new-hc-target header is set to true and string form
     * if x-magic-new-hc-target is absent or set to false.
     */
    target?: HealthCheck.MagicHealthCheckTarget | string;

    /**
     * The type of healthcheck to run, reply or request. The default value is `reply`.
     */
    type?: MagicTransitAPI.HealthCheckType;
  }

  export namespace HealthCheck {
    /**
     * The destination address in a request type health check. After the healthcheck is
     * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
     * to this address. This field defaults to `customer_gre_endpoint address`. This
     * field is ignored for bidirectional healthchecks as the interface_address (not
     * assigned to the Cloudflare side of the tunnel) is used as the target.
     */
    export interface MagicHealthCheckTarget {
      /**
       * The effective health check target. If 'saved' is empty, then this field will be
       * populated with the calculated default value on GET requests. Ignored in POST,
       * PUT, and PATCH requests.
       */
      effective?: string;

      /**
       * The saved health check target. Setting the value to the empty string indicates
       * that the calculated default value will be used.
       */
      saved?: string;
    }
  }
}

export interface IPSECTunnelUpdateResponse {
  modified?: boolean;

  modified_ipsec_tunnel?: IPSECTunnelUpdateResponse.ModifiedIPSECTunnel;
}

export namespace IPSECTunnelUpdateResponse {
  export interface ModifiedIPSECTunnel {
    /**
     * Identifier
     */
    id: string;

    /**
     * The IP address assigned to the Cloudflare side of the IPsec tunnel.
     */
    cloudflare_endpoint: string;

    /**
     * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
     * of the tunnel. Select the subnet from the following private IP space:
     * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
     */
    interface_address: string;

    /**
     * The name of the IPsec tunnel. The name cannot share a name with other tunnels.
     */
    name: string;

    /**
     * When `true`, the tunnel can use a null-cipher (`ENCR_NULL`) in the ESP tunnel
     * (Phase 2).
     */
    allow_null_cipher?: boolean;

    /**
     * The date and time the tunnel was created.
     */
    created_on?: string;

    /**
     * The IP address assigned to the customer side of the IPsec tunnel. Not required,
     * but must be set for proactive traceroutes to work.
     */
    customer_endpoint?: string;

    /**
     * An optional description forthe IPsec tunnel.
     */
    description?: string;

    health_check?: ModifiedIPSECTunnel.HealthCheck;

    /**
     * The date and time the tunnel was last modified.
     */
    modified_on?: string;

    /**
     * The PSK metadata that includes when the PSK was generated.
     */
    psk_metadata?: IPSECTunnelsAPI.PSKMetadata;

    /**
     * If `true`, then IPsec replay protection will be supported in the
     * Cloudflare-to-customer direction.
     */
    replay_protection?: boolean;
  }

  export namespace ModifiedIPSECTunnel {
    export interface HealthCheck {
      /**
       * The direction of the flow of the healthcheck. Either unidirectional, where the
       * probe comes to you via the tunnel and the result comes back to Cloudflare via
       * the open Internet, or bidirectional where both the probe and result come and go
       * via the tunnel.
       */
      direction?: 'unidirectional' | 'bidirectional';

      /**
       * Determines whether to run healthchecks for a tunnel.
       */
      enabled?: boolean;

      /**
       * How frequent the health check is run. The default value is `mid`.
       */
      rate?: MagicTransitAPI.HealthCheckRate;

      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
       * object form if the x-magic-new-hc-target header is set to true and string form
       * if x-magic-new-hc-target is absent or set to false.
       */
      target?: HealthCheck.MagicHealthCheckTarget | string;

      /**
       * The type of healthcheck to run, reply or request. The default value is `reply`.
       */
      type?: MagicTransitAPI.HealthCheckType;
    }

    export namespace HealthCheck {
      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target.
       */
      export interface MagicHealthCheckTarget {
        /**
         * The effective health check target. If 'saved' is empty, then this field will be
         * populated with the calculated default value on GET requests. Ignored in POST,
         * PUT, and PATCH requests.
         */
        effective?: string;

        /**
         * The saved health check target. Setting the value to the empty string indicates
         * that the calculated default value will be used.
         */
        saved?: string;
      }
    }
  }
}

export interface IPSECTunnelListResponse {
  ipsec_tunnels?: Array<IPSECTunnelListResponse.IPSECTunnel>;
}

export namespace IPSECTunnelListResponse {
  export interface IPSECTunnel {
    /**
     * Identifier
     */
    id: string;

    /**
     * The IP address assigned to the Cloudflare side of the IPsec tunnel.
     */
    cloudflare_endpoint: string;

    /**
     * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
     * of the tunnel. Select the subnet from the following private IP space:
     * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
     */
    interface_address: string;

    /**
     * The name of the IPsec tunnel. The name cannot share a name with other tunnels.
     */
    name: string;

    /**
     * When `true`, the tunnel can use a null-cipher (`ENCR_NULL`) in the ESP tunnel
     * (Phase 2).
     */
    allow_null_cipher?: boolean;

    /**
     * The date and time the tunnel was created.
     */
    created_on?: string;

    /**
     * The IP address assigned to the customer side of the IPsec tunnel. Not required,
     * but must be set for proactive traceroutes to work.
     */
    customer_endpoint?: string;

    /**
     * An optional description forthe IPsec tunnel.
     */
    description?: string;

    health_check?: IPSECTunnel.HealthCheck;

    /**
     * The date and time the tunnel was last modified.
     */
    modified_on?: string;

    /**
     * The PSK metadata that includes when the PSK was generated.
     */
    psk_metadata?: IPSECTunnelsAPI.PSKMetadata;

    /**
     * If `true`, then IPsec replay protection will be supported in the
     * Cloudflare-to-customer direction.
     */
    replay_protection?: boolean;
  }

  export namespace IPSECTunnel {
    export interface HealthCheck {
      /**
       * The direction of the flow of the healthcheck. Either unidirectional, where the
       * probe comes to you via the tunnel and the result comes back to Cloudflare via
       * the open Internet, or bidirectional where both the probe and result come and go
       * via the tunnel.
       */
      direction?: 'unidirectional' | 'bidirectional';

      /**
       * Determines whether to run healthchecks for a tunnel.
       */
      enabled?: boolean;

      /**
       * How frequent the health check is run. The default value is `mid`.
       */
      rate?: MagicTransitAPI.HealthCheckRate;

      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
       * object form if the x-magic-new-hc-target header is set to true and string form
       * if x-magic-new-hc-target is absent or set to false.
       */
      target?: HealthCheck.MagicHealthCheckTarget | string;

      /**
       * The type of healthcheck to run, reply or request. The default value is `reply`.
       */
      type?: MagicTransitAPI.HealthCheckType;
    }

    export namespace HealthCheck {
      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target.
       */
      export interface MagicHealthCheckTarget {
        /**
         * The effective health check target. If 'saved' is empty, then this field will be
         * populated with the calculated default value on GET requests. Ignored in POST,
         * PUT, and PATCH requests.
         */
        effective?: string;

        /**
         * The saved health check target. Setting the value to the empty string indicates
         * that the calculated default value will be used.
         */
        saved?: string;
      }
    }
  }
}

export interface IPSECTunnelDeleteResponse {
  deleted?: boolean;

  deleted_ipsec_tunnel?: IPSECTunnelDeleteResponse.DeletedIPSECTunnel;
}

export namespace IPSECTunnelDeleteResponse {
  export interface DeletedIPSECTunnel {
    /**
     * Identifier
     */
    id: string;

    /**
     * The IP address assigned to the Cloudflare side of the IPsec tunnel.
     */
    cloudflare_endpoint: string;

    /**
     * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
     * of the tunnel. Select the subnet from the following private IP space:
     * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
     */
    interface_address: string;

    /**
     * The name of the IPsec tunnel. The name cannot share a name with other tunnels.
     */
    name: string;

    /**
     * When `true`, the tunnel can use a null-cipher (`ENCR_NULL`) in the ESP tunnel
     * (Phase 2).
     */
    allow_null_cipher?: boolean;

    /**
     * The date and time the tunnel was created.
     */
    created_on?: string;

    /**
     * The IP address assigned to the customer side of the IPsec tunnel. Not required,
     * but must be set for proactive traceroutes to work.
     */
    customer_endpoint?: string;

    /**
     * An optional description forthe IPsec tunnel.
     */
    description?: string;

    health_check?: DeletedIPSECTunnel.HealthCheck;

    /**
     * The date and time the tunnel was last modified.
     */
    modified_on?: string;

    /**
     * The PSK metadata that includes when the PSK was generated.
     */
    psk_metadata?: IPSECTunnelsAPI.PSKMetadata;

    /**
     * If `true`, then IPsec replay protection will be supported in the
     * Cloudflare-to-customer direction.
     */
    replay_protection?: boolean;
  }

  export namespace DeletedIPSECTunnel {
    export interface HealthCheck {
      /**
       * The direction of the flow of the healthcheck. Either unidirectional, where the
       * probe comes to you via the tunnel and the result comes back to Cloudflare via
       * the open Internet, or bidirectional where both the probe and result come and go
       * via the tunnel.
       */
      direction?: 'unidirectional' | 'bidirectional';

      /**
       * Determines whether to run healthchecks for a tunnel.
       */
      enabled?: boolean;

      /**
       * How frequent the health check is run. The default value is `mid`.
       */
      rate?: MagicTransitAPI.HealthCheckRate;

      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
       * object form if the x-magic-new-hc-target header is set to true and string form
       * if x-magic-new-hc-target is absent or set to false.
       */
      target?: HealthCheck.MagicHealthCheckTarget | string;

      /**
       * The type of healthcheck to run, reply or request. The default value is `reply`.
       */
      type?: MagicTransitAPI.HealthCheckType;
    }

    export namespace HealthCheck {
      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target.
       */
      export interface MagicHealthCheckTarget {
        /**
         * The effective health check target. If 'saved' is empty, then this field will be
         * populated with the calculated default value on GET requests. Ignored in POST,
         * PUT, and PATCH requests.
         */
        effective?: string;

        /**
         * The saved health check target. Setting the value to the empty string indicates
         * that the calculated default value will be used.
         */
        saved?: string;
      }
    }
  }
}

export interface IPSECTunnelBulkUpdateResponse {
  modified?: boolean;

  modified_ipsec_tunnels?: Array<IPSECTunnelBulkUpdateResponse.ModifiedIPSECTunnel>;
}

export namespace IPSECTunnelBulkUpdateResponse {
  export interface ModifiedIPSECTunnel {
    /**
     * Identifier
     */
    id: string;

    /**
     * The IP address assigned to the Cloudflare side of the IPsec tunnel.
     */
    cloudflare_endpoint: string;

    /**
     * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
     * of the tunnel. Select the subnet from the following private IP space:
     * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
     */
    interface_address: string;

    /**
     * The name of the IPsec tunnel. The name cannot share a name with other tunnels.
     */
    name: string;

    /**
     * When `true`, the tunnel can use a null-cipher (`ENCR_NULL`) in the ESP tunnel
     * (Phase 2).
     */
    allow_null_cipher?: boolean;

    /**
     * The date and time the tunnel was created.
     */
    created_on?: string;

    /**
     * The IP address assigned to the customer side of the IPsec tunnel. Not required,
     * but must be set for proactive traceroutes to work.
     */
    customer_endpoint?: string;

    /**
     * An optional description forthe IPsec tunnel.
     */
    description?: string;

    health_check?: ModifiedIPSECTunnel.HealthCheck;

    /**
     * The date and time the tunnel was last modified.
     */
    modified_on?: string;

    /**
     * The PSK metadata that includes when the PSK was generated.
     */
    psk_metadata?: IPSECTunnelsAPI.PSKMetadata;

    /**
     * If `true`, then IPsec replay protection will be supported in the
     * Cloudflare-to-customer direction.
     */
    replay_protection?: boolean;
  }

  export namespace ModifiedIPSECTunnel {
    export interface HealthCheck {
      /**
       * The direction of the flow of the healthcheck. Either unidirectional, where the
       * probe comes to you via the tunnel and the result comes back to Cloudflare via
       * the open Internet, or bidirectional where both the probe and result come and go
       * via the tunnel.
       */
      direction?: 'unidirectional' | 'bidirectional';

      /**
       * Determines whether to run healthchecks for a tunnel.
       */
      enabled?: boolean;

      /**
       * How frequent the health check is run. The default value is `mid`.
       */
      rate?: MagicTransitAPI.HealthCheckRate;

      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
       * object form if the x-magic-new-hc-target header is set to true and string form
       * if x-magic-new-hc-target is absent or set to false.
       */
      target?: HealthCheck.MagicHealthCheckTarget | string;

      /**
       * The type of healthcheck to run, reply or request. The default value is `reply`.
       */
      type?: MagicTransitAPI.HealthCheckType;
    }

    export namespace HealthCheck {
      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target.
       */
      export interface MagicHealthCheckTarget {
        /**
         * The effective health check target. If 'saved' is empty, then this field will be
         * populated with the calculated default value on GET requests. Ignored in POST,
         * PUT, and PATCH requests.
         */
        effective?: string;

        /**
         * The saved health check target. Setting the value to the empty string indicates
         * that the calculated default value will be used.
         */
        saved?: string;
      }
    }
  }
}

export interface IPSECTunnelGetResponse {
  ipsec_tunnel?: IPSECTunnelGetResponse.IPSECTunnel;
}

export namespace IPSECTunnelGetResponse {
  export interface IPSECTunnel {
    /**
     * Identifier
     */
    id: string;

    /**
     * The IP address assigned to the Cloudflare side of the IPsec tunnel.
     */
    cloudflare_endpoint: string;

    /**
     * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
     * of the tunnel. Select the subnet from the following private IP space:
     * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
     */
    interface_address: string;

    /**
     * The name of the IPsec tunnel. The name cannot share a name with other tunnels.
     */
    name: string;

    /**
     * When `true`, the tunnel can use a null-cipher (`ENCR_NULL`) in the ESP tunnel
     * (Phase 2).
     */
    allow_null_cipher?: boolean;

    /**
     * The date and time the tunnel was created.
     */
    created_on?: string;

    /**
     * The IP address assigned to the customer side of the IPsec tunnel. Not required,
     * but must be set for proactive traceroutes to work.
     */
    customer_endpoint?: string;

    /**
     * An optional description forthe IPsec tunnel.
     */
    description?: string;

    health_check?: IPSECTunnel.HealthCheck;

    /**
     * The date and time the tunnel was last modified.
     */
    modified_on?: string;

    /**
     * The PSK metadata that includes when the PSK was generated.
     */
    psk_metadata?: IPSECTunnelsAPI.PSKMetadata;

    /**
     * If `true`, then IPsec replay protection will be supported in the
     * Cloudflare-to-customer direction.
     */
    replay_protection?: boolean;
  }

  export namespace IPSECTunnel {
    export interface HealthCheck {
      /**
       * The direction of the flow of the healthcheck. Either unidirectional, where the
       * probe comes to you via the tunnel and the result comes back to Cloudflare via
       * the open Internet, or bidirectional where both the probe and result come and go
       * via the tunnel.
       */
      direction?: 'unidirectional' | 'bidirectional';

      /**
       * Determines whether to run healthchecks for a tunnel.
       */
      enabled?: boolean;

      /**
       * How frequent the health check is run. The default value is `mid`.
       */
      rate?: MagicTransitAPI.HealthCheckRate;

      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
       * object form if the x-magic-new-hc-target header is set to true and string form
       * if x-magic-new-hc-target is absent or set to false.
       */
      target?: HealthCheck.MagicHealthCheckTarget | string;

      /**
       * The type of healthcheck to run, reply or request. The default value is `reply`.
       */
      type?: MagicTransitAPI.HealthCheckType;
    }

    export namespace HealthCheck {
      /**
       * The destination address in a request type health check. After the healthcheck is
       * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
       * to this address. This field defaults to `customer_gre_endpoint address`. This
       * field is ignored for bidirectional healthchecks as the interface_address (not
       * assigned to the Cloudflare side of the tunnel) is used as the target.
       */
      export interface MagicHealthCheckTarget {
        /**
         * The effective health check target. If 'saved' is empty, then this field will be
         * populated with the calculated default value on GET requests. Ignored in POST,
         * PUT, and PATCH requests.
         */
        effective?: string;

        /**
         * The saved health check target. Setting the value to the empty string indicates
         * that the calculated default value will be used.
         */
        saved?: string;
      }
    }
  }
}

export interface IPSECTunnelPSKGenerateResponse {
  /**
   * Identifier
   */
  ipsec_tunnel_id?: string;

  /**
   * A randomly generated or provided string for use in the IPsec tunnel.
   */
  psk?: string;

  /**
   * The PSK metadata that includes when the PSK was generated.
   */
  psk_metadata?: PSKMetadata;
}

export interface IPSECTunnelCreateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: The IP address assigned to the Cloudflare side of the IPsec tunnel.
   */
  cloudflare_endpoint: string;

  /**
   * Body param: A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for
   * each side of the tunnel. Select the subnet from the following private IP space:
   * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
   */
  interface_address: string;

  /**
   * Body param: The name of the IPsec tunnel. The name cannot share a name with
   * other tunnels.
   */
  name: string;

  /**
   * Body param: The IP address assigned to the customer side of the IPsec tunnel.
   * Not required, but must be set for proactive traceroutes to work.
   */
  customer_endpoint?: string;

  /**
   * Body param: An optional description forthe IPsec tunnel.
   */
  description?: string;

  /**
   * Body param:
   */
  health_check?: IPSECTunnelCreateParams.HealthCheck;

  /**
   * Body param: A randomly generated or provided string for use in the IPsec tunnel.
   */
  psk?: string;

  /**
   * Body param: If `true`, then IPsec replay protection will be supported in the
   * Cloudflare-to-customer direction.
   */
  replay_protection?: boolean;

  /**
   * Header param: If true, the health check target in the request and response
   * bodies will be presented using the new object format. Defaults to false.
   */
  'x-magic-new-hc-target'?: boolean;
}

export namespace IPSECTunnelCreateParams {
  export interface HealthCheck {
    /**
     * The direction of the flow of the healthcheck. Either unidirectional, where the
     * probe comes to you via the tunnel and the result comes back to Cloudflare via
     * the open Internet, or bidirectional where both the probe and result come and go
     * via the tunnel.
     */
    direction?: 'unidirectional' | 'bidirectional';

    /**
     * Determines whether to run healthchecks for a tunnel.
     */
    enabled?: boolean;

    /**
     * How frequent the health check is run. The default value is `mid`.
     */
    rate?: MagicTransitAPI.HealthCheckRateParam;

    /**
     * The destination address in a request type health check. After the healthcheck is
     * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
     * to this address. This field defaults to `customer_gre_endpoint address`. This
     * field is ignored for bidirectional healthchecks as the interface_address (not
     * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
     * object form if the x-magic-new-hc-target header is set to true and string form
     * if x-magic-new-hc-target is absent or set to false.
     */
    target?: HealthCheck.MagicHealthCheckTarget | string;

    /**
     * The type of healthcheck to run, reply or request. The default value is `reply`.
     */
    type?: MagicTransitAPI.HealthCheckTypeParam;
  }

  export namespace HealthCheck {
    /**
     * The destination address in a request type health check. After the healthcheck is
     * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
     * to this address. This field defaults to `customer_gre_endpoint address`. This
     * field is ignored for bidirectional healthchecks as the interface_address (not
     * assigned to the Cloudflare side of the tunnel) is used as the target.
     */
    export interface MagicHealthCheckTarget {
      /**
       * The saved health check target. Setting the value to the empty string indicates
       * that the calculated default value will be used.
       */
      saved?: string;
    }
  }
}

export interface IPSECTunnelUpdateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: The IP address assigned to the Cloudflare side of the IPsec tunnel.
   */
  cloudflare_endpoint: string;

  /**
   * Body param: A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for
   * each side of the tunnel. Select the subnet from the following private IP space:
   * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
   */
  interface_address: string;

  /**
   * Body param: The name of the IPsec tunnel. The name cannot share a name with
   * other tunnels.
   */
  name: string;

  /**
   * Body param: The IP address assigned to the customer side of the IPsec tunnel.
   * Not required, but must be set for proactive traceroutes to work.
   */
  customer_endpoint?: string;

  /**
   * Body param: An optional description forthe IPsec tunnel.
   */
  description?: string;

  /**
   * Body param:
   */
  health_check?: IPSECTunnelUpdateParams.HealthCheck;

  /**
   * Body param: A randomly generated or provided string for use in the IPsec tunnel.
   */
  psk?: string;

  /**
   * Body param: If `true`, then IPsec replay protection will be supported in the
   * Cloudflare-to-customer direction.
   */
  replay_protection?: boolean;

  /**
   * Header param: If true, the health check target in the request and response
   * bodies will be presented using the new object format. Defaults to false.
   */
  'x-magic-new-hc-target'?: boolean;
}

export namespace IPSECTunnelUpdateParams {
  export interface HealthCheck {
    /**
     * The direction of the flow of the healthcheck. Either unidirectional, where the
     * probe comes to you via the tunnel and the result comes back to Cloudflare via
     * the open Internet, or bidirectional where both the probe and result come and go
     * via the tunnel.
     */
    direction?: 'unidirectional' | 'bidirectional';

    /**
     * Determines whether to run healthchecks for a tunnel.
     */
    enabled?: boolean;

    /**
     * How frequent the health check is run. The default value is `mid`.
     */
    rate?: MagicTransitAPI.HealthCheckRateParam;

    /**
     * The destination address in a request type health check. After the healthcheck is
     * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
     * to this address. This field defaults to `customer_gre_endpoint address`. This
     * field is ignored for bidirectional healthchecks as the interface_address (not
     * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
     * object form if the x-magic-new-hc-target header is set to true and string form
     * if x-magic-new-hc-target is absent or set to false.
     */
    target?: HealthCheck.MagicHealthCheckTarget | string;

    /**
     * The type of healthcheck to run, reply or request. The default value is `reply`.
     */
    type?: MagicTransitAPI.HealthCheckTypeParam;
  }

  export namespace HealthCheck {
    /**
     * The destination address in a request type health check. After the healthcheck is
     * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
     * to this address. This field defaults to `customer_gre_endpoint address`. This
     * field is ignored for bidirectional healthchecks as the interface_address (not
     * assigned to the Cloudflare side of the tunnel) is used as the target.
     */
    export interface MagicHealthCheckTarget {
      /**
       * The saved health check target. Setting the value to the empty string indicates
       * that the calculated default value will be used.
       */
      saved?: string;
    }
  }
}

export interface IPSECTunnelListParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Header param: If true, the health check target in the response body will be
   * presented using the new object format. Defaults to false.
   */
  'x-magic-new-hc-target'?: boolean;
}

export interface IPSECTunnelDeleteParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Header param: If true, the health check target in the response body will be
   * presented using the new object format. Defaults to false.
   */
  'x-magic-new-hc-target'?: boolean;
}

export interface IPSECTunnelBulkUpdateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;

  /**
   * Header param: If true, the health check target in the request and response
   * bodies will be presented using the new object format. Defaults to false.
   */
  'x-magic-new-hc-target'?: boolean;
}

export interface IPSECTunnelGetParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Header param: If true, the health check target in the response body will be
   * presented using the new object format. Defaults to false.
   */
  'x-magic-new-hc-target'?: boolean;
}

export interface IPSECTunnelPSKGenerateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export declare namespace IPSECTunnels {
  export {
    type PSKMetadata as PSKMetadata,
    type IPSECTunnelCreateResponse as IPSECTunnelCreateResponse,
    type IPSECTunnelUpdateResponse as IPSECTunnelUpdateResponse,
    type IPSECTunnelListResponse as IPSECTunnelListResponse,
    type IPSECTunnelDeleteResponse as IPSECTunnelDeleteResponse,
    type IPSECTunnelBulkUpdateResponse as IPSECTunnelBulkUpdateResponse,
    type IPSECTunnelGetResponse as IPSECTunnelGetResponse,
    type IPSECTunnelPSKGenerateResponse as IPSECTunnelPSKGenerateResponse,
    type IPSECTunnelCreateParams as IPSECTunnelCreateParams,
    type IPSECTunnelUpdateParams as IPSECTunnelUpdateParams,
    type IPSECTunnelListParams as IPSECTunnelListParams,
    type IPSECTunnelDeleteParams as IPSECTunnelDeleteParams,
    type IPSECTunnelBulkUpdateParams as IPSECTunnelBulkUpdateParams,
    type IPSECTunnelGetParams as IPSECTunnelGetParams,
    type IPSECTunnelPSKGenerateParams as IPSECTunnelPSKGenerateParams,
  };
}
