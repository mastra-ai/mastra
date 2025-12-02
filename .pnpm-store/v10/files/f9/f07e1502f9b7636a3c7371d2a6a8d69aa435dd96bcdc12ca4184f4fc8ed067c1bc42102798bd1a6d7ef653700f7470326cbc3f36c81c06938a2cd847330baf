// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Domains extends APIResource {
  /**
   * Attaches a Worker to a zone and hostname.
   *
   * @example
   * ```ts
   * const domain = await client.workers.domains.update({
   *   account_id: '9a7806061c88ada191ed06f989cc3dac',
   *   environment: 'production',
   *   hostname: 'foo.example.com',
   *   service: 'foo',
   *   zone_id: '593c9c94de529bbbfaac7c53ced0447d',
   * });
   * ```
   */
  update(params: DomainUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Domain> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/workers/domains`, { body, ...options }) as Core.APIPromise<{
        result: Domain;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists all Worker Domains for an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const domain of client.workers.domains.list({
   *   account_id: '9a7806061c88ada191ed06f989cc3dac',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(params: DomainListParams, options?: Core.RequestOptions): Core.PagePromise<DomainsSinglePage, Domain> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(`/accounts/${account_id}/workers/domains`, DomainsSinglePage, {
      query,
      ...options,
    });
  }

  /**
   * Detaches a Worker from a zone and hostname.
   *
   * @example
   * ```ts
   * await client.workers.domains.delete(
   *   'dbe10b4bc17c295377eabd600e1787fd',
   *   { account_id: '9a7806061c88ada191ed06f989cc3dac' },
   * );
   * ```
   */
  delete(domainId: string, params: DomainDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void> {
    const { account_id } = params;
    return this._client.delete(`/accounts/${account_id}/workers/domains/${domainId}`, {
      ...options,
      headers: { Accept: '*/*', ...options?.headers },
    });
  }

  /**
   * Gets a Worker domain.
   *
   * @example
   * ```ts
   * const domain = await client.workers.domains.get(
   *   'dbe10b4bc17c295377eabd600e1787fd',
   *   { account_id: '9a7806061c88ada191ed06f989cc3dac' },
   * );
   * ```
   */
  get(domainId: string, params: DomainGetParams, options?: Core.RequestOptions): Core.APIPromise<Domain> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/workers/domains/${domainId}`, options) as Core.APIPromise<{
        result: Domain;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class DomainsSinglePage extends SinglePage<Domain> {}

export interface Domain {
  /**
   * Identifer of the Worker Domain.
   */
  id?: string;

  /**
   * Worker environment associated with the zone and hostname.
   */
  environment?: string;

  /**
   * Hostname of the Worker Domain.
   */
  hostname?: string;

  /**
   * Worker service associated with the zone and hostname.
   */
  service?: string;

  /**
   * Identifier of the zone.
   */
  zone_id?: string;

  /**
   * Name of the zone.
   */
  zone_name?: string;
}

export interface DomainUpdateParams {
  /**
   * Path param: Identifer of the account.
   */
  account_id: string;

  /**
   * Body param: Worker environment associated with the zone and hostname.
   */
  environment: string;

  /**
   * Body param: Hostname of the Worker Domain.
   */
  hostname: string;

  /**
   * Body param: Worker service associated with the zone and hostname.
   */
  service: string;

  /**
   * Body param: Identifier of the zone.
   */
  zone_id: string;
}

export interface DomainListParams {
  /**
   * Path param: Identifer of the account.
   */
  account_id: string;

  /**
   * Query param: Worker environment associated with the zone and hostname.
   */
  environment?: string;

  /**
   * Query param: Hostname of the Worker Domain.
   */
  hostname?: string;

  /**
   * Query param: Worker service associated with the zone and hostname.
   */
  service?: string;

  /**
   * Query param: Identifier of the zone.
   */
  zone_id?: string;

  /**
   * Query param: Name of the zone.
   */
  zone_name?: string;
}

export interface DomainDeleteParams {
  /**
   * Identifer of the account.
   */
  account_id: string;
}

export interface DomainGetParams {
  /**
   * Identifer of the account.
   */
  account_id: string;
}

Domains.DomainsSinglePage = DomainsSinglePage;

export declare namespace Domains {
  export {
    type Domain as Domain,
    DomainsSinglePage as DomainsSinglePage,
    type DomainUpdateParams as DomainUpdateParams,
    type DomainListParams as DomainListParams,
    type DomainDeleteParams as DomainDeleteParams,
    type DomainGetParams as DomainGetParams,
  };
}
