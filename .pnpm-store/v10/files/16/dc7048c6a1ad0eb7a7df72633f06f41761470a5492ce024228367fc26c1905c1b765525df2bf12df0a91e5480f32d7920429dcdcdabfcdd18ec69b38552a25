// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import * as PoliciesAPI from '../policies';
import { FallbackDomainsSinglePage } from '../policies';

export class FallbackDomains extends APIResource {
  /**
   * Sets the list of domains to bypass Gateway DNS resolution. These domains will
   * use the specified local DNS resolver instead. This will only apply to the
   * specified device settings profile.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fallbackDomain of client.zeroTrust.devices.policies.custom.fallbackDomains.update(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   {
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *     domains: [{ suffix: 'example.com' }],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  update(
    policyId: string,
    params: FallbackDomainUpdateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<FallbackDomainsSinglePage, PoliciesAPI.FallbackDomain> {
    const { account_id, domains } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/policy/${policyId}/fallback_domains`,
      FallbackDomainsSinglePage,
      { body: domains, method: 'put', ...options },
    );
  }

  /**
   * Fetches the list of domains to bypass Gateway DNS resolution from a specified
   * device settings profile. These domains will use the specified local DNS resolver
   * instead.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fallbackDomain of client.zeroTrust.devices.policies.custom.fallbackDomains.get(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    policyId: string,
    params: FallbackDomainGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<FallbackDomainsSinglePage, PoliciesAPI.FallbackDomain> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/policy/${policyId}/fallback_domains`,
      FallbackDomainsSinglePage,
      options,
    );
  }
}

export interface FallbackDomainUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  domains: Array<PoliciesAPI.FallbackDomainParam>;
}

export interface FallbackDomainGetParams {
  account_id: string;
}

export declare namespace FallbackDomains {
  export {
    type FallbackDomainUpdateParams as FallbackDomainUpdateParams,
    type FallbackDomainGetParams as FallbackDomainGetParams,
  };
}

export { FallbackDomainsSinglePage };
