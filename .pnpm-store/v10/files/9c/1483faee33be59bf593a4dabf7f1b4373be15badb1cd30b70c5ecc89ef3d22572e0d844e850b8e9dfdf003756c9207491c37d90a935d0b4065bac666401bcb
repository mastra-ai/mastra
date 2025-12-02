// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class ACLs extends APIResource {
  /**
   * Create ACL.
   *
   * @example
   * ```ts
   * const acl = await client.dns.zoneTransfers.acls.create({
   *   account_id: '01a7362d577a6c3019a474fd6f485823',
   *   ip_range: '192.0.2.53/28',
   *   name: 'my-acl-1',
   * });
   * ```
   */
  create(params: ACLCreateParams, options?: Core.RequestOptions): Core.APIPromise<ACL> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/secondary_dns/acls`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ACL }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Modify ACL.
   *
   * @example
   * ```ts
   * const acl = await client.dns.zoneTransfers.acls.update(
   *   '23ff594956f20c2a721606e94745a8aa',
   *   {
   *     account_id: '01a7362d577a6c3019a474fd6f485823',
   *     ip_range: '192.0.2.53/28',
   *     name: 'my-acl-1',
   *   },
   * );
   * ```
   */
  update(aclId: string, params: ACLUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ACL> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/secondary_dns/acls/${aclId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ACL }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List ACLs.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const acl of client.dns.zoneTransfers.acls.list({
   *   account_id: '01a7362d577a6c3019a474fd6f485823',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(params: ACLListParams, options?: Core.RequestOptions): Core.PagePromise<ACLsSinglePage, ACL> {
    const { account_id } = params;
    return this._client.getAPIList(`/accounts/${account_id}/secondary_dns/acls`, ACLsSinglePage, options);
  }

  /**
   * Delete ACL.
   *
   * @example
   * ```ts
   * const acl = await client.dns.zoneTransfers.acls.delete(
   *   '23ff594956f20c2a721606e94745a8aa',
   *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
   * );
   * ```
   */
  delete(
    aclId: string,
    params: ACLDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ACLDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/secondary_dns/acls/${aclId}`, options) as Core.APIPromise<{
        result: ACLDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get ACL.
   *
   * @example
   * ```ts
   * const acl = await client.dns.zoneTransfers.acls.get(
   *   '23ff594956f20c2a721606e94745a8aa',
   *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
   * );
   * ```
   */
  get(aclId: string, params: ACLGetParams, options?: Core.RequestOptions): Core.APIPromise<ACL> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/secondary_dns/acls/${aclId}`, options) as Core.APIPromise<{
        result: ACL;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class ACLsSinglePage extends SinglePage<ACL> {}

export interface ACL {
  id: string;

  /**
   * Allowed IPv4/IPv6 address range of primary or secondary nameservers. This will
   * be applied for the entire account. The IP range is used to allow additional
   * NOTIFY IPs for secondary zones and IPs Cloudflare allows AXFR/IXFR requests from
   * for primary zones. CIDRs are limited to a maximum of /24 for IPv4 and /64 for
   * IPv6 respectively.
   */
  ip_range: string;

  /**
   * The name of the acl.
   */
  name: string;
}

export interface ACLDeleteResponse {
  id?: string;
}

export interface ACLCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Allowed IPv4/IPv6 address range of primary or secondary nameservers.
   * This will be applied for the entire account. The IP range is used to allow
   * additional NOTIFY IPs for secondary zones and IPs Cloudflare allows AXFR/IXFR
   * requests from for primary zones. CIDRs are limited to a maximum of /24 for IPv4
   * and /64 for IPv6 respectively.
   */
  ip_range: string;

  /**
   * Body param: The name of the acl.
   */
  name: string;
}

export interface ACLUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Allowed IPv4/IPv6 address range of primary or secondary nameservers.
   * This will be applied for the entire account. The IP range is used to allow
   * additional NOTIFY IPs for secondary zones and IPs Cloudflare allows AXFR/IXFR
   * requests from for primary zones. CIDRs are limited to a maximum of /24 for IPv4
   * and /64 for IPv6 respectively.
   */
  ip_range: string;

  /**
   * Body param: The name of the acl.
   */
  name: string;
}

export interface ACLListParams {
  account_id: string;
}

export interface ACLDeleteParams {
  account_id: string;
}

export interface ACLGetParams {
  account_id: string;
}

ACLs.ACLsSinglePage = ACLsSinglePage;

export declare namespace ACLs {
  export {
    type ACL as ACL,
    type ACLDeleteResponse as ACLDeleteResponse,
    ACLsSinglePage as ACLsSinglePage,
    type ACLCreateParams as ACLCreateParams,
    type ACLUpdateParams as ACLUpdateParams,
    type ACLListParams as ACLListParams,
    type ACLDeleteParams as ACLDeleteParams,
    type ACLGetParams as ACLGetParams,
  };
}
