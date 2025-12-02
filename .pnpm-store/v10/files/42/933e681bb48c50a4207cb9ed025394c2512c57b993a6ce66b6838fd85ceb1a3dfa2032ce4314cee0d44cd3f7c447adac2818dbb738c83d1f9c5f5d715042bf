// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Delegations extends APIResource {
  /**
   * Create a new account delegation for a given IP prefix.
   *
   * @example
   * ```ts
   * const delegations =
   *   await client.addressing.prefixes.delegations.create(
   *     '2af39739cc4e3b5910c918468bb89828',
   *     {
   *       account_id: '258def64c72dae45f3e4c8516e2111f2',
   *       cidr: '192.0.2.0/24',
   *       delegated_account_id:
   *         'b1946ac92492d2347c6235b4d2611184',
   *     },
   *   );
   * ```
   */
  create(
    prefixId: string,
    params: DelegationCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Delegations> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/addressing/prefixes/${prefixId}/delegations`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Delegations }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List all delegations for a given account IP prefix.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const delegations of client.addressing.prefixes.delegations.list(
   *   '2af39739cc4e3b5910c918468bb89828',
   *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    prefixId: string,
    params: DelegationListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DelegationsSinglePage, Delegations> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/addressing/prefixes/${prefixId}/delegations`,
      DelegationsSinglePage,
      options,
    );
  }

  /**
   * Delete an account delegation for a given IP prefix.
   *
   * @example
   * ```ts
   * const delegation =
   *   await client.addressing.prefixes.delegations.delete(
   *     '2af39739cc4e3b5910c918468bb89828',
   *     'd933b1530bc56c9953cf8ce166da8004',
   *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
   *   );
   * ```
   */
  delete(
    prefixId: string,
    delegationId: string,
    params: DelegationDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DelegationDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/addressing/prefixes/${prefixId}/delegations/${delegationId}`,
        options,
      ) as Core.APIPromise<{ result: DelegationDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class DelegationsSinglePage extends SinglePage<Delegations> {}

export interface Delegations {
  /**
   * Identifier of a Delegation.
   */
  id?: string;

  /**
   * IP Prefix in Classless Inter-Domain Routing format.
   */
  cidr?: string;

  created_at?: string;

  /**
   * Account identifier for the account to which prefix is being delegated.
   */
  delegated_account_id?: string;

  modified_at?: string;

  /**
   * Identifier of an IP Prefix.
   */
  parent_prefix_id?: string;
}

export interface DelegationDeleteResponse {
  /**
   * Identifier of a Delegation.
   */
  id?: string;
}

export interface DelegationCreateParams {
  /**
   * Path param: Identifier of a Cloudflare account.
   */
  account_id: string;

  /**
   * Body param: IP Prefix in Classless Inter-Domain Routing format.
   */
  cidr: string;

  /**
   * Body param: Account identifier for the account to which prefix is being
   * delegated.
   */
  delegated_account_id: string;
}

export interface DelegationListParams {
  /**
   * Identifier of a Cloudflare account.
   */
  account_id: string;
}

export interface DelegationDeleteParams {
  /**
   * Identifier of a Cloudflare account.
   */
  account_id: string;
}

Delegations.DelegationsSinglePage = DelegationsSinglePage;

export declare namespace Delegations {
  export {
    type Delegations as Delegations,
    type DelegationDeleteResponse as DelegationDeleteResponse,
    DelegationsSinglePage as DelegationsSinglePage,
    type DelegationCreateParams as DelegationCreateParams,
    type DelegationListParams as DelegationListParams,
    type DelegationDeleteParams as DelegationDeleteParams,
  };
}
