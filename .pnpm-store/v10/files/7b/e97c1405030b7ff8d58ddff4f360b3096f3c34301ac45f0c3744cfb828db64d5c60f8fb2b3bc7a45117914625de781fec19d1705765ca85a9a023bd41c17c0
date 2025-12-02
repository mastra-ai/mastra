// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Peers extends APIResource {
  /**
   * Create Peer.
   *
   * @example
   * ```ts
   * const peer = await client.dns.zoneTransfers.peers.create({
   *   account_id: '01a7362d577a6c3019a474fd6f485823',
   *   name: 'my-peer-1',
   * });
   * ```
   */
  create(params: PeerCreateParams, options?: Core.RequestOptions): Core.APIPromise<Peer> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/secondary_dns/peers`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Peer }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Modify Peer.
   *
   * @example
   * ```ts
   * const peer = await client.dns.zoneTransfers.peers.update(
   *   '23ff594956f20c2a721606e94745a8aa',
   *   {
   *     account_id: '01a7362d577a6c3019a474fd6f485823',
   *     name: 'my-peer-1',
   *   },
   * );
   * ```
   */
  update(peerId: string, params: PeerUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Peer> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/secondary_dns/peers/${peerId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Peer }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Peers.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const peer of client.dns.zoneTransfers.peers.list(
   *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(params: PeerListParams, options?: Core.RequestOptions): Core.PagePromise<PeersSinglePage, Peer> {
    const { account_id } = params;
    return this._client.getAPIList(`/accounts/${account_id}/secondary_dns/peers`, PeersSinglePage, options);
  }

  /**
   * Delete Peer.
   *
   * @example
   * ```ts
   * const peer = await client.dns.zoneTransfers.peers.delete(
   *   '23ff594956f20c2a721606e94745a8aa',
   *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
   * );
   * ```
   */
  delete(
    peerId: string,
    params: PeerDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PeerDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/secondary_dns/peers/${peerId}`,
        options,
      ) as Core.APIPromise<{ result: PeerDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Peer.
   *
   * @example
   * ```ts
   * const peer = await client.dns.zoneTransfers.peers.get(
   *   '23ff594956f20c2a721606e94745a8aa',
   *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
   * );
   * ```
   */
  get(peerId: string, params: PeerGetParams, options?: Core.RequestOptions): Core.APIPromise<Peer> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/secondary_dns/peers/${peerId}`, options) as Core.APIPromise<{
        result: Peer;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PeersSinglePage extends SinglePage<Peer> {}

export interface Peer {
  id: string;

  /**
   * The name of the peer.
   */
  name: string;

  /**
   * IPv4/IPv6 address of primary or secondary nameserver, depending on what zone
   * this peer is linked to. For primary zones this IP defines the IP of the
   * secondary nameserver Cloudflare will NOTIFY upon zone changes. For secondary
   * zones this IP defines the IP of the primary nameserver Cloudflare will send
   * AXFR/IXFR requests to.
   */
  ip?: string;

  /**
   * Enable IXFR transfer protocol, default is AXFR. Only applicable to secondary
   * zones.
   */
  ixfr_enable?: boolean;

  /**
   * DNS port of primary or secondary nameserver, depending on what zone this peer is
   * linked to.
   */
  port?: number;

  /**
   * TSIG authentication will be used for zone transfer if configured.
   */
  tsig_id?: string;
}

export interface PeerDeleteResponse {
  id?: string;
}

export interface PeerCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The name of the peer.
   */
  name: string;
}

export interface PeerUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The name of the peer.
   */
  name: string;

  /**
   * Body param: IPv4/IPv6 address of primary or secondary nameserver, depending on
   * what zone this peer is linked to. For primary zones this IP defines the IP of
   * the secondary nameserver Cloudflare will NOTIFY upon zone changes. For secondary
   * zones this IP defines the IP of the primary nameserver Cloudflare will send
   * AXFR/IXFR requests to.
   */
  ip?: string;

  /**
   * Body param: Enable IXFR transfer protocol, default is AXFR. Only applicable to
   * secondary zones.
   */
  ixfr_enable?: boolean;

  /**
   * Body param: DNS port of primary or secondary nameserver, depending on what zone
   * this peer is linked to.
   */
  port?: number;

  /**
   * Body param: TSIG authentication will be used for zone transfer if configured.
   */
  tsig_id?: string;
}

export interface PeerListParams {
  account_id: string;
}

export interface PeerDeleteParams {
  account_id: string;
}

export interface PeerGetParams {
  account_id: string;
}

Peers.PeersSinglePage = PeersSinglePage;

export declare namespace Peers {
  export {
    type Peer as Peer,
    type PeerDeleteResponse as PeerDeleteResponse,
    PeersSinglePage as PeersSinglePage,
    type PeerCreateParams as PeerCreateParams,
    type PeerUpdateParams as PeerUpdateParams,
    type PeerListParams as PeerListParams,
    type PeerDeleteParams as PeerDeleteParams,
    type PeerGetParams as PeerGetParams,
  };
}
