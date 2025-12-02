// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class CNIs extends APIResource {
  /**
   * Create a new CNI object
   *
   * @example
   * ```ts
   * const cni = await client.networkInterconnects.cnis.create({
   *   account_id: 'account_id',
   *   account: 'account',
   *   interconnect: 'interconnect',
   *   magic: {
   *     conduit_name: 'conduit_name',
   *     description: 'description',
   *     mtu: 0,
   *   },
   * });
   * ```
   */
  create(params: CNICreateParams, options?: Core.RequestOptions): Core.APIPromise<CNICreateResponse> {
    const { account_id, ...body } = params;
    return this._client.post(`/accounts/${account_id}/cni/cnis`, { body, ...options });
  }

  /**
   * Modify stored information about a CNI object
   *
   * @example
   * ```ts
   * const cni = await client.networkInterconnects.cnis.update(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   {
   *     account_id: 'account_id',
   *     id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     account: 'account',
   *     cust_ip: '192.168.3.4/31',
   *     interconnect: 'interconnect',
   *     magic: {
   *       conduit_name: 'conduit_name',
   *       description: 'description',
   *       mtu: 0,
   *     },
   *     p2p_ip: '192.168.3.4/31',
   *   },
   * );
   * ```
   */
  update(
    cni: string,
    params: CNIUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CNIUpdateResponse> {
    const { account_id, ...body } = params;
    return this._client.put(`/accounts/${account_id}/cni/cnis/${cni}`, { body, ...options });
  }

  /**
   * List existing CNI objects
   *
   * @example
   * ```ts
   * const cnis = await client.networkInterconnects.cnis.list({
   *   account_id: 'account_id',
   * });
   * ```
   */
  list(params: CNIListParams, options?: Core.RequestOptions): Core.APIPromise<CNIListResponse> {
    const { account_id, ...query } = params;
    return this._client.get(`/accounts/${account_id}/cni/cnis`, { query, ...options });
  }

  /**
   * Delete a specified CNI object
   *
   * @example
   * ```ts
   * await client.networkInterconnects.cnis.delete(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  delete(cni: string, params: CNIDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void> {
    const { account_id } = params;
    return this._client.delete(`/accounts/${account_id}/cni/cnis/${cni}`, {
      ...options,
      headers: { Accept: '*/*', ...options?.headers },
    });
  }

  /**
   * Get information about a CNI object
   *
   * @example
   * ```ts
   * const cni = await client.networkInterconnects.cnis.get(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(cni: string, params: CNIGetParams, options?: Core.RequestOptions): Core.APIPromise<CNIGetResponse> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/cni/cnis/${cni}`, options);
  }
}

export interface CNICreateResponse {
  id: string;

  /**
   * Customer account tag
   */
  account: string;

  /**
   * Customer end of the point-to-point link
   *
   * This should always be inside the same prefix as `p2p_ip`.
   */
  cust_ip: string;

  /**
   * Interconnect identifier hosting this CNI
   */
  interconnect: string;

  magic: CNICreateResponse.Magic;

  /**
   * Cloudflare end of the point-to-point link
   */
  p2p_ip: string;

  bgp?: CNICreateResponse.BGP;
}

export namespace CNICreateResponse {
  export interface Magic {
    conduit_name: string;

    description: string;

    mtu: number;
  }

  export interface BGP {
    /**
     * ASN used on the customer end of the BGP session
     */
    customer_asn: number;

    /**
     * Extra set of static prefixes to advertise to the customer's end of the session
     */
    extra_prefixes: Array<string>;

    /**
     * MD5 key to use for session authentication.
     *
     * Note that _this is not a security measure_. MD5 is not a valid security
     * mechanism, and the key is not treated as a secret value. This is _only_
     * supported for preventing misconfiguration, not for defending against malicious
     * attacks.
     *
     * The MD5 key, if set, must be of non-zero length and consist only of the
     * following types of character:
     *
     * - ASCII alphanumerics: `[a-zA-Z0-9]`
     * - Special characters in the set `'!@#$%^&*()+[]{}<>/.,;:_-~`= \|`
     *
     * In other words, MD5 keys may contain any printable ASCII character aside from
     * newline (0x0A), quotation mark (`"`), vertical tab (0x0B), carriage return
     * (0x0D), tab (0x09), form feed (0x0C), and the question mark (`?`). Requests
     * specifying an MD5 key with one or more of these disallowed characters will be
     * rejected.
     */
    md5_key?: string | null;
  }
}

export interface CNIUpdateResponse {
  id: string;

  /**
   * Customer account tag
   */
  account: string;

  /**
   * Customer end of the point-to-point link
   *
   * This should always be inside the same prefix as `p2p_ip`.
   */
  cust_ip: string;

  /**
   * Interconnect identifier hosting this CNI
   */
  interconnect: string;

  magic: CNIUpdateResponse.Magic;

  /**
   * Cloudflare end of the point-to-point link
   */
  p2p_ip: string;

  bgp?: CNIUpdateResponse.BGP;
}

export namespace CNIUpdateResponse {
  export interface Magic {
    conduit_name: string;

    description: string;

    mtu: number;
  }

  export interface BGP {
    /**
     * ASN used on the customer end of the BGP session
     */
    customer_asn: number;

    /**
     * Extra set of static prefixes to advertise to the customer's end of the session
     */
    extra_prefixes: Array<string>;

    /**
     * MD5 key to use for session authentication.
     *
     * Note that _this is not a security measure_. MD5 is not a valid security
     * mechanism, and the key is not treated as a secret value. This is _only_
     * supported for preventing misconfiguration, not for defending against malicious
     * attacks.
     *
     * The MD5 key, if set, must be of non-zero length and consist only of the
     * following types of character:
     *
     * - ASCII alphanumerics: `[a-zA-Z0-9]`
     * - Special characters in the set `'!@#$%^&*()+[]{}<>/.,;:_-~`= \|`
     *
     * In other words, MD5 keys may contain any printable ASCII character aside from
     * newline (0x0A), quotation mark (`"`), vertical tab (0x0B), carriage return
     * (0x0D), tab (0x09), form feed (0x0C), and the question mark (`?`). Requests
     * specifying an MD5 key with one or more of these disallowed characters will be
     * rejected.
     */
    md5_key?: string | null;
  }
}

export interface CNIListResponse {
  items: Array<CNIListResponse.Item>;

  next?: number | null;
}

export namespace CNIListResponse {
  export interface Item {
    id: string;

    /**
     * Customer account tag
     */
    account: string;

    /**
     * Customer end of the point-to-point link
     *
     * This should always be inside the same prefix as `p2p_ip`.
     */
    cust_ip: string;

    /**
     * Interconnect identifier hosting this CNI
     */
    interconnect: string;

    magic: Item.Magic;

    /**
     * Cloudflare end of the point-to-point link
     */
    p2p_ip: string;

    bgp?: Item.BGP;
  }

  export namespace Item {
    export interface Magic {
      conduit_name: string;

      description: string;

      mtu: number;
    }

    export interface BGP {
      /**
       * ASN used on the customer end of the BGP session
       */
      customer_asn: number;

      /**
       * Extra set of static prefixes to advertise to the customer's end of the session
       */
      extra_prefixes: Array<string>;

      /**
       * MD5 key to use for session authentication.
       *
       * Note that _this is not a security measure_. MD5 is not a valid security
       * mechanism, and the key is not treated as a secret value. This is _only_
       * supported for preventing misconfiguration, not for defending against malicious
       * attacks.
       *
       * The MD5 key, if set, must be of non-zero length and consist only of the
       * following types of character:
       *
       * - ASCII alphanumerics: `[a-zA-Z0-9]`
       * - Special characters in the set `'!@#$%^&*()+[]{}<>/.,;:_-~`= \|`
       *
       * In other words, MD5 keys may contain any printable ASCII character aside from
       * newline (0x0A), quotation mark (`"`), vertical tab (0x0B), carriage return
       * (0x0D), tab (0x09), form feed (0x0C), and the question mark (`?`). Requests
       * specifying an MD5 key with one or more of these disallowed characters will be
       * rejected.
       */
      md5_key?: string | null;
    }
  }
}

export interface CNIGetResponse {
  id: string;

  /**
   * Customer account tag
   */
  account: string;

  /**
   * Customer end of the point-to-point link
   *
   * This should always be inside the same prefix as `p2p_ip`.
   */
  cust_ip: string;

  /**
   * Interconnect identifier hosting this CNI
   */
  interconnect: string;

  magic: CNIGetResponse.Magic;

  /**
   * Cloudflare end of the point-to-point link
   */
  p2p_ip: string;

  bgp?: CNIGetResponse.BGP;
}

export namespace CNIGetResponse {
  export interface Magic {
    conduit_name: string;

    description: string;

    mtu: number;
  }

  export interface BGP {
    /**
     * ASN used on the customer end of the BGP session
     */
    customer_asn: number;

    /**
     * Extra set of static prefixes to advertise to the customer's end of the session
     */
    extra_prefixes: Array<string>;

    /**
     * MD5 key to use for session authentication.
     *
     * Note that _this is not a security measure_. MD5 is not a valid security
     * mechanism, and the key is not treated as a secret value. This is _only_
     * supported for preventing misconfiguration, not for defending against malicious
     * attacks.
     *
     * The MD5 key, if set, must be of non-zero length and consist only of the
     * following types of character:
     *
     * - ASCII alphanumerics: `[a-zA-Z0-9]`
     * - Special characters in the set `'!@#$%^&*()+[]{}<>/.,;:_-~`= \|`
     *
     * In other words, MD5 keys may contain any printable ASCII character aside from
     * newline (0x0A), quotation mark (`"`), vertical tab (0x0B), carriage return
     * (0x0D), tab (0x09), form feed (0x0C), and the question mark (`?`). Requests
     * specifying an MD5 key with one or more of these disallowed characters will be
     * rejected.
     */
    md5_key?: string | null;
  }
}

export interface CNICreateParams {
  /**
   * Path param: Customer account tag
   */
  account_id: string;

  /**
   * Body param: Customer account tag
   */
  account: string;

  /**
   * Body param:
   */
  interconnect: string;

  /**
   * Body param:
   */
  magic: CNICreateParams.Magic;

  /**
   * Body param:
   */
  bgp?: CNICreateParams.BGP;
}

export namespace CNICreateParams {
  export interface Magic {
    conduit_name: string;

    description: string;

    mtu: number;
  }

  export interface BGP {
    /**
     * ASN used on the customer end of the BGP session
     */
    customer_asn: number;

    /**
     * Extra set of static prefixes to advertise to the customer's end of the session
     */
    extra_prefixes: Array<string>;

    /**
     * MD5 key to use for session authentication.
     *
     * Note that _this is not a security measure_. MD5 is not a valid security
     * mechanism, and the key is not treated as a secret value. This is _only_
     * supported for preventing misconfiguration, not for defending against malicious
     * attacks.
     *
     * The MD5 key, if set, must be of non-zero length and consist only of the
     * following types of character:
     *
     * - ASCII alphanumerics: `[a-zA-Z0-9]`
     * - Special characters in the set `'!@#$%^&*()+[]{}<>/.,;:_-~`= \|`
     *
     * In other words, MD5 keys may contain any printable ASCII character aside from
     * newline (0x0A), quotation mark (`"`), vertical tab (0x0B), carriage return
     * (0x0D), tab (0x09), form feed (0x0C), and the question mark (`?`). Requests
     * specifying an MD5 key with one or more of these disallowed characters will be
     * rejected.
     */
    md5_key?: string | null;
  }
}

export interface CNIUpdateParams {
  /**
   * Path param: Customer account tag
   */
  account_id: string;

  /**
   * Body param:
   */
  id: string;

  /**
   * Body param: Customer account tag
   */
  account: string;

  /**
   * Body param: Customer end of the point-to-point link
   *
   * This should always be inside the same prefix as `p2p_ip`.
   */
  cust_ip: string;

  /**
   * Body param: Interconnect identifier hosting this CNI
   */
  interconnect: string;

  /**
   * Body param:
   */
  magic: CNIUpdateParams.Magic;

  /**
   * Body param: Cloudflare end of the point-to-point link
   */
  p2p_ip: string;

  /**
   * Body param:
   */
  bgp?: CNIUpdateParams.BGP;
}

export namespace CNIUpdateParams {
  export interface Magic {
    conduit_name: string;

    description: string;

    mtu: number;
  }

  export interface BGP {
    /**
     * ASN used on the customer end of the BGP session
     */
    customer_asn: number;

    /**
     * Extra set of static prefixes to advertise to the customer's end of the session
     */
    extra_prefixes: Array<string>;

    /**
     * MD5 key to use for session authentication.
     *
     * Note that _this is not a security measure_. MD5 is not a valid security
     * mechanism, and the key is not treated as a secret value. This is _only_
     * supported for preventing misconfiguration, not for defending against malicious
     * attacks.
     *
     * The MD5 key, if set, must be of non-zero length and consist only of the
     * following types of character:
     *
     * - ASCII alphanumerics: `[a-zA-Z0-9]`
     * - Special characters in the set `'!@#$%^&*()+[]{}<>/.,;:_-~`= \|`
     *
     * In other words, MD5 keys may contain any printable ASCII character aside from
     * newline (0x0A), quotation mark (`"`), vertical tab (0x0B), carriage return
     * (0x0D), tab (0x09), form feed (0x0C), and the question mark (`?`). Requests
     * specifying an MD5 key with one or more of these disallowed characters will be
     * rejected.
     */
    md5_key?: string | null;
  }
}

export interface CNIListParams {
  /**
   * Path param: Customer account tag
   */
  account_id: string;

  /**
   * Query param:
   */
  cursor?: number | null;

  /**
   * Query param:
   */
  limit?: number | null;

  /**
   * Query param: If specified, only show CNIs associated with the specified slot
   */
  slot?: string | null;

  /**
   * Query param: If specified, only show cnis associated with the specified tunnel
   * id
   */
  tunnel_id?: string | null;
}

export interface CNIDeleteParams {
  /**
   * Customer account tag
   */
  account_id: string;
}

export interface CNIGetParams {
  /**
   * Customer account tag
   */
  account_id: string;
}

export declare namespace CNIs {
  export {
    type CNICreateResponse as CNICreateResponse,
    type CNIUpdateResponse as CNIUpdateResponse,
    type CNIListResponse as CNIListResponse,
    type CNIGetResponse as CNIGetResponse,
    type CNICreateParams as CNICreateParams,
    type CNIUpdateParams as CNIUpdateParams,
    type CNIListParams as CNIListParams,
    type CNIDeleteParams as CNIDeleteParams,
    type CNIGetParams as CNIGetParams,
  };
}
