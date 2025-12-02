// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as IPFSUniversalPathsAPI from './ipfs-universal-paths/ipfs-universal-paths';
import { IPFSUniversalPaths } from './ipfs-universal-paths/ipfs-universal-paths';
import { SinglePage } from '../../../pagination';

export class Hostnames extends APIResource {
  ipfsUniversalPaths: IPFSUniversalPathsAPI.IPFSUniversalPaths = new IPFSUniversalPathsAPI.IPFSUniversalPaths(
    this._client,
  );

  /**
   * Create Web3 Hostname
   *
   * @example
   * ```ts
   * const hostname = await client.web3.hostnames.create({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   name: 'gateway.example.com',
   *   target: 'ipfs',
   * });
   * ```
   */
  create(params: HostnameCreateParams, options?: Core.RequestOptions): Core.APIPromise<Hostname> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/web3/hostnames`, { body, ...options }) as Core.APIPromise<{
        result: Hostname;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Web3 Hostnames
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const hostname of client.web3.hostnames.list({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(
    params: HostnameListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<HostnamesSinglePage, Hostname> {
    const { zone_id } = params;
    return this._client.getAPIList(`/zones/${zone_id}/web3/hostnames`, HostnamesSinglePage, options);
  }

  /**
   * Delete Web3 Hostname
   *
   * @example
   * ```ts
   * const hostname = await client.web3.hostnames.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    identifier: string,
    params: HostnameDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<HostnameDeleteResponse | null> {
    const { zone_id } = params;
    return (
      this._client.delete(`/zones/${zone_id}/web3/hostnames/${identifier}`, options) as Core.APIPromise<{
        result: HostnameDeleteResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Edit Web3 Hostname
   *
   * @example
   * ```ts
   * const hostname = await client.web3.hostnames.edit(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  edit(
    identifier: string,
    params: HostnameEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Hostname> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/web3/hostnames/${identifier}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Hostname }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Web3 Hostname Details
   *
   * @example
   * ```ts
   * const hostname = await client.web3.hostnames.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    identifier: string,
    params: HostnameGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Hostname> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/web3/hostnames/${identifier}`, options) as Core.APIPromise<{
        result: Hostname;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class HostnamesSinglePage extends SinglePage<Hostname> {}

export interface Hostname {
  /**
   * Specify the identifier of the hostname.
   */
  id?: string;

  created_on?: string;

  /**
   * Specify an optional description of the hostname.
   */
  description?: string;

  /**
   * Specify the DNSLink value used if the target is ipfs.
   */
  dnslink?: string;

  modified_on?: string;

  /**
   * Specify the hostname that points to the target gateway via CNAME.
   */
  name?: string;

  /**
   * Specifies the status of the hostname's activation.
   */
  status?: 'active' | 'pending' | 'deleting' | 'error';

  /**
   * Specify the target gateway of the hostname.
   */
  target?: 'ethereum' | 'ipfs' | 'ipfs_universal_path';
}

export interface HostnameDeleteResponse {
  /**
   * Specify the identifier of the hostname.
   */
  id: string;
}

export interface HostnameCreateParams {
  /**
   * Path param: Specify the identifier of the hostname.
   */
  zone_id: string;

  /**
   * Body param: Specify the hostname that points to the target gateway via CNAME.
   */
  name: string;

  /**
   * Body param: Specify the target gateway of the hostname.
   */
  target: 'ethereum' | 'ipfs' | 'ipfs_universal_path';

  /**
   * Body param: Specify an optional description of the hostname.
   */
  description?: string;

  /**
   * Body param: Specify the DNSLink value used if the target is ipfs.
   */
  dnslink?: string;
}

export interface HostnameListParams {
  /**
   * Specify the identifier of the hostname.
   */
  zone_id: string;
}

export interface HostnameDeleteParams {
  /**
   * Specify the identifier of the hostname.
   */
  zone_id: string;
}

export interface HostnameEditParams {
  /**
   * Path param: Specify the identifier of the hostname.
   */
  zone_id: string;

  /**
   * Body param: Specify an optional description of the hostname.
   */
  description?: string;

  /**
   * Body param: Specify the DNSLink value used if the target is ipfs.
   */
  dnslink?: string;
}

export interface HostnameGetParams {
  /**
   * Specify the identifier of the hostname.
   */
  zone_id: string;
}

Hostnames.HostnamesSinglePage = HostnamesSinglePage;
Hostnames.IPFSUniversalPaths = IPFSUniversalPaths;

export declare namespace Hostnames {
  export {
    type Hostname as Hostname,
    type HostnameDeleteResponse as HostnameDeleteResponse,
    HostnamesSinglePage as HostnamesSinglePage,
    type HostnameCreateParams as HostnameCreateParams,
    type HostnameListParams as HostnameListParams,
    type HostnameDeleteParams as HostnameDeleteParams,
    type HostnameEditParams as HostnameEditParams,
    type HostnameGetParams as HostnameGetParams,
  };

  export { IPFSUniversalPaths as IPFSUniversalPaths };
}
