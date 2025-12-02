// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Policies extends APIResource {
  /**
   * Create a Page Shield policy.
   *
   * @example
   * ```ts
   * const policy = await client.pageShield.policies.create({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   action: 'allow',
   *   description: 'Checkout page CSP policy',
   *   enabled: true,
   *   expression:
   *     'ends_with(http.request.uri.path, "/checkout")',
   *   value: "script-src 'none';",
   * });
   * ```
   */
  create(
    params: PolicyCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PolicyCreateResponse | null> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/page_shield/policies`, { body, ...options }) as Core.APIPromise<{
        result: PolicyCreateResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a Page Shield policy by ID.
   *
   * @example
   * ```ts
   * const policy = await client.pageShield.policies.update(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    policyId: string,
    params: PolicyUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PolicyUpdateResponse | null> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/page_shield/policies/${policyId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PolicyUpdateResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists all Page Shield policies.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const policyListResponse of client.pageShield.policies.list(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PolicyListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PolicyListResponsesSinglePage, PolicyListResponse> {
    const { zone_id } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/page_shield/policies`,
      PolicyListResponsesSinglePage,
      options,
    );
  }

  /**
   * Delete a Page Shield policy by ID.
   *
   * @example
   * ```ts
   * await client.pageShield.policies.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(policyId: string, params: PolicyDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void> {
    const { zone_id } = params;
    return this._client.delete(`/zones/${zone_id}/page_shield/policies/${policyId}`, {
      ...options,
      headers: { Accept: '*/*', ...options?.headers },
    });
  }

  /**
   * Fetches a Page Shield policy by ID.
   *
   * @example
   * ```ts
   * const policy = await client.pageShield.policies.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    policyId: string,
    params: PolicyGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PolicyGetResponse | null> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/page_shield/policies/${policyId}`, options) as Core.APIPromise<{
        result: PolicyGetResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PolicyListResponsesSinglePage extends SinglePage<PolicyListResponse> {}

export interface Policy {
  /**
   * The action to take if the expression matches
   */
  action: 'allow' | 'log';

  /**
   * A description for the policy
   */
  description: string;

  /**
   * Whether the policy is enabled
   */
  enabled: boolean;

  /**
   * The expression which must match for the policy to be applied, using the
   * Cloudflare Firewall rule expression syntax
   */
  expression: string;

  /**
   * The policy which will be applied
   */
  value: string;
}

export interface PolicyCreateResponse {
  /**
   * Identifier
   */
  id: string;

  /**
   * The action to take if the expression matches
   */
  action: 'allow' | 'log';

  /**
   * A description for the policy
   */
  description: string;

  /**
   * Whether the policy is enabled
   */
  enabled: boolean;

  /**
   * The expression which must match for the policy to be applied, using the
   * Cloudflare Firewall rule expression syntax
   */
  expression: string;

  /**
   * The policy which will be applied
   */
  value: string;
}

export interface PolicyUpdateResponse {
  /**
   * Identifier
   */
  id: string;

  /**
   * The action to take if the expression matches
   */
  action: 'allow' | 'log';

  /**
   * A description for the policy
   */
  description: string;

  /**
   * Whether the policy is enabled
   */
  enabled: boolean;

  /**
   * The expression which must match for the policy to be applied, using the
   * Cloudflare Firewall rule expression syntax
   */
  expression: string;

  /**
   * The policy which will be applied
   */
  value: string;
}

export interface PolicyListResponse {
  /**
   * Identifier
   */
  id: string;

  /**
   * The action to take if the expression matches
   */
  action: 'allow' | 'log';

  /**
   * A description for the policy
   */
  description: string;

  /**
   * Whether the policy is enabled
   */
  enabled: boolean;

  /**
   * The expression which must match for the policy to be applied, using the
   * Cloudflare Firewall rule expression syntax
   */
  expression: string;

  /**
   * The policy which will be applied
   */
  value: string;
}

export interface PolicyGetResponse {
  /**
   * Identifier
   */
  id: string;

  /**
   * The action to take if the expression matches
   */
  action: 'allow' | 'log';

  /**
   * A description for the policy
   */
  description: string;

  /**
   * Whether the policy is enabled
   */
  enabled: boolean;

  /**
   * The expression which must match for the policy to be applied, using the
   * Cloudflare Firewall rule expression syntax
   */
  expression: string;

  /**
   * The policy which will be applied
   */
  value: string;
}

export interface PolicyCreateParams {
  /**
   * Path param: Identifier
   */
  zone_id: string;

  /**
   * Body param: The action to take if the expression matches
   */
  action: 'allow' | 'log';

  /**
   * Body param: A description for the policy
   */
  description: string;

  /**
   * Body param: Whether the policy is enabled
   */
  enabled: boolean;

  /**
   * Body param: The expression which must match for the policy to be applied, using
   * the Cloudflare Firewall rule expression syntax
   */
  expression: string;

  /**
   * Body param: The policy which will be applied
   */
  value: string;
}

export interface PolicyUpdateParams {
  /**
   * Path param: Identifier
   */
  zone_id: string;

  /**
   * Body param: The action to take if the expression matches
   */
  action?: 'allow' | 'log';

  /**
   * Body param: A description for the policy
   */
  description?: string;

  /**
   * Body param: Whether the policy is enabled
   */
  enabled?: boolean;

  /**
   * Body param: The expression which must match for the policy to be applied, using
   * the Cloudflare Firewall rule expression syntax
   */
  expression?: string;

  /**
   * Body param: The policy which will be applied
   */
  value?: string;
}

export interface PolicyListParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export interface PolicyDeleteParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export interface PolicyGetParams {
  /**
   * Identifier
   */
  zone_id: string;
}

Policies.PolicyListResponsesSinglePage = PolicyListResponsesSinglePage;

export declare namespace Policies {
  export {
    type Policy as Policy,
    type PolicyCreateResponse as PolicyCreateResponse,
    type PolicyUpdateResponse as PolicyUpdateResponse,
    type PolicyListResponse as PolicyListResponse,
    type PolicyGetResponse as PolicyGetResponse,
    PolicyListResponsesSinglePage as PolicyListResponsesSinglePage,
    type PolicyCreateParams as PolicyCreateParams,
    type PolicyUpdateParams as PolicyUpdateParams,
    type PolicyListParams as PolicyListParams,
    type PolicyDeleteParams as PolicyDeleteParams,
    type PolicyGetParams as PolicyGetParams,
  };
}
