// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as ApplicationsAPI from './applications/applications';
import * as ApplicationsPoliciesAPI from './applications/policies';
import { SinglePage } from '../../../pagination';

export class Policies extends APIResource {
  /**
   * Creates a new Access reusable policy.
   *
   * @example
   * ```ts
   * const policy =
   *   await client.zeroTrust.access.policies.create({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     decision: 'allow',
   *     include: [
   *       {
   *         group: {
   *           id: 'aa0a4aab-672b-4bdb-bc33-a59f1130a11f',
   *         },
   *       },
   *     ],
   *     name: 'Allow devs',
   *   });
   * ```
   */
  create(params: PolicyCreateParams, options?: Core.RequestOptions): Core.APIPromise<PolicyCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/access/policies`, { body, ...options }) as Core.APIPromise<{
        result: PolicyCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a Access reusable policy.
   *
   * @example
   * ```ts
   * const policy =
   *   await client.zeroTrust.access.policies.update(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       decision: 'allow',
   *       include: [
   *         {
   *           group: {
   *             id: 'aa0a4aab-672b-4bdb-bc33-a59f1130a11f',
   *           },
   *         },
   *       ],
   *       name: 'Allow devs',
   *     },
   *   );
   * ```
   */
  update(
    policyId: string,
    params: PolicyUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PolicyUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/access/policies/${policyId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PolicyUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists Access reusable policies.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const policyListResponse of client.zeroTrust.access.policies.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PolicyListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PolicyListResponsesSinglePage, PolicyListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/access/policies`,
      PolicyListResponsesSinglePage,
      options,
    );
  }

  /**
   * Deletes an Access reusable policy.
   *
   * @example
   * ```ts
   * const policy =
   *   await client.zeroTrust.access.policies.delete(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    policyId: string,
    params: PolicyDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PolicyDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/access/policies/${policyId}`, options) as Core.APIPromise<{
        result: PolicyDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a single Access reusable policy.
   *
   * @example
   * ```ts
   * const policy = await client.zeroTrust.access.policies.get(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    policyId: string,
    params: PolicyGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PolicyGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/access/policies/${policyId}`, options) as Core.APIPromise<{
        result: PolicyGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PolicyListResponsesSinglePage extends SinglePage<PolicyListResponse> {}

/**
 * A group of email addresses that can approve a temporary authentication request.
 */
export interface ApprovalGroup {
  /**
   * The number of approvals needed to obtain access.
   */
  approvals_needed: number;

  /**
   * A list of emails that can approve the access request.
   */
  email_addresses?: Array<string>;

  /**
   * The UUID of an re-usable email list.
   */
  email_list_uuid?: string;
}

/**
 * A group of email addresses that can approve a temporary authentication request.
 */
export interface ApprovalGroupParam {
  /**
   * The number of approvals needed to obtain access.
   */
  approvals_needed: number;

  /**
   * A list of emails that can approve the access request.
   */
  email_addresses?: Array<string>;

  /**
   * The UUID of an re-usable email list.
   */
  email_list_uuid?: string;
}

export interface Policy {
  /**
   * UUID.
   */
  id?: string;

  /**
   * Administrators who can approve a temporary authentication request.
   */
  approval_groups?: Array<Policy.ApprovalGroup>;

  /**
   * Requires the user to request access from an administrator at the start of each
   * session.
   */
  approval_required?: boolean;

  created_at?: string;

  /**
   * The action Access will take if a user matches this policy.
   */
  decision?: 'allow' | 'deny' | 'non_identity' | 'bypass';

  /**
   * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
   * meet any of the Exclude rules.
   */
  exclude?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Rules evaluated with an OR logical operator. A user needs to meet only one of
   * the Include rules.
   */
  include?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Require this application to be served in an isolated browser for users matching
   * this policy.
   */
  isolation_required?: boolean;

  /**
   * The name of the Access policy.
   */
  name?: string;

  /**
   * The order of execution for this policy. Must be unique for each policy.
   */
  precedence?: number;

  /**
   * A custom message that will appear on the purpose justification screen.
   */
  purpose_justification_prompt?: string;

  /**
   * Require users to enter a justification when they log in to the application.
   */
  purpose_justification_required?: boolean;

  /**
   * Rules evaluated with an AND logical operator. To match the policy, a user must
   * meet all of the Require rules.
   */
  require?: Array<ApplicationsPoliciesAPI.AccessRule>;

  updated_at?: string;
}

export namespace Policy {
  /**
   * A group of email addresses that can approve a temporary authentication request.
   */
  export interface ApprovalGroup {
    /**
     * The number of approvals needed to obtain access.
     */
    approvals_needed: number;

    /**
     * A list of emails that can approve the access request.
     */
    email_addresses?: Array<unknown>;

    /**
     * The UUID of an re-usable email list.
     */
    email_list_uuid?: string;
  }
}

export interface PolicyCreateResponse {
  /**
   * The UUID of the policy
   */
  id?: string;

  /**
   * Number of access applications currently using this policy.
   */
  app_count?: number;

  /**
   * Administrators who can approve a temporary authentication request.
   */
  approval_groups?: Array<ApprovalGroup>;

  /**
   * Requires the user to request access from an administrator at the start of each
   * session.
   */
  approval_required?: boolean;

  created_at?: string;

  /**
   * The action Access will take if a user matches this policy. Infrastructure
   * application policies can only use the Allow action.
   */
  decision?: ApplicationsAPI.Decision;

  /**
   * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
   * meet any of the Exclude rules.
   */
  exclude?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Rules evaluated with an OR logical operator. A user needs to meet only one of
   * the Include rules.
   */
  include?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Require this application to be served in an isolated browser for users matching
   * this policy. 'Client Web Isolation' must be on for the account in order to use
   * this feature.
   */
  isolation_required?: boolean;

  /**
   * The name of the Access policy.
   */
  name?: string;

  /**
   * A custom message that will appear on the purpose justification screen.
   */
  purpose_justification_prompt?: string;

  /**
   * Require users to enter a justification when they log in to the application.
   */
  purpose_justification_required?: boolean;

  /**
   * Rules evaluated with an AND logical operator. To match the policy, a user must
   * meet all of the Require rules.
   */
  require?: Array<ApplicationsPoliciesAPI.AccessRule>;

  reusable?: true;

  /**
   * The amount of time that tokens issued for the application will be valid. Must be
   * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
   * m, h.
   */
  session_duration?: string;

  updated_at?: string;
}

export interface PolicyUpdateResponse {
  /**
   * The UUID of the policy
   */
  id?: string;

  /**
   * Number of access applications currently using this policy.
   */
  app_count?: number;

  /**
   * Administrators who can approve a temporary authentication request.
   */
  approval_groups?: Array<ApprovalGroup>;

  /**
   * Requires the user to request access from an administrator at the start of each
   * session.
   */
  approval_required?: boolean;

  created_at?: string;

  /**
   * The action Access will take if a user matches this policy. Infrastructure
   * application policies can only use the Allow action.
   */
  decision?: ApplicationsAPI.Decision;

  /**
   * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
   * meet any of the Exclude rules.
   */
  exclude?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Rules evaluated with an OR logical operator. A user needs to meet only one of
   * the Include rules.
   */
  include?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Require this application to be served in an isolated browser for users matching
   * this policy. 'Client Web Isolation' must be on for the account in order to use
   * this feature.
   */
  isolation_required?: boolean;

  /**
   * The name of the Access policy.
   */
  name?: string;

  /**
   * A custom message that will appear on the purpose justification screen.
   */
  purpose_justification_prompt?: string;

  /**
   * Require users to enter a justification when they log in to the application.
   */
  purpose_justification_required?: boolean;

  /**
   * Rules evaluated with an AND logical operator. To match the policy, a user must
   * meet all of the Require rules.
   */
  require?: Array<ApplicationsPoliciesAPI.AccessRule>;

  reusable?: true;

  /**
   * The amount of time that tokens issued for the application will be valid. Must be
   * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
   * m, h.
   */
  session_duration?: string;

  updated_at?: string;
}

export interface PolicyListResponse {
  /**
   * The UUID of the policy
   */
  id?: string;

  /**
   * Number of access applications currently using this policy.
   */
  app_count?: number;

  /**
   * Administrators who can approve a temporary authentication request.
   */
  approval_groups?: Array<ApprovalGroup>;

  /**
   * Requires the user to request access from an administrator at the start of each
   * session.
   */
  approval_required?: boolean;

  created_at?: string;

  /**
   * The action Access will take if a user matches this policy. Infrastructure
   * application policies can only use the Allow action.
   */
  decision?: ApplicationsAPI.Decision;

  /**
   * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
   * meet any of the Exclude rules.
   */
  exclude?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Rules evaluated with an OR logical operator. A user needs to meet only one of
   * the Include rules.
   */
  include?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Require this application to be served in an isolated browser for users matching
   * this policy. 'Client Web Isolation' must be on for the account in order to use
   * this feature.
   */
  isolation_required?: boolean;

  /**
   * The name of the Access policy.
   */
  name?: string;

  /**
   * A custom message that will appear on the purpose justification screen.
   */
  purpose_justification_prompt?: string;

  /**
   * Require users to enter a justification when they log in to the application.
   */
  purpose_justification_required?: boolean;

  /**
   * Rules evaluated with an AND logical operator. To match the policy, a user must
   * meet all of the Require rules.
   */
  require?: Array<ApplicationsPoliciesAPI.AccessRule>;

  reusable?: true;

  /**
   * The amount of time that tokens issued for the application will be valid. Must be
   * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
   * m, h.
   */
  session_duration?: string;

  updated_at?: string;
}

export interface PolicyDeleteResponse {
  /**
   * The UUID of the policy
   */
  id?: string;
}

export interface PolicyGetResponse {
  /**
   * The UUID of the policy
   */
  id?: string;

  /**
   * Number of access applications currently using this policy.
   */
  app_count?: number;

  /**
   * Administrators who can approve a temporary authentication request.
   */
  approval_groups?: Array<ApprovalGroup>;

  /**
   * Requires the user to request access from an administrator at the start of each
   * session.
   */
  approval_required?: boolean;

  created_at?: string;

  /**
   * The action Access will take if a user matches this policy. Infrastructure
   * application policies can only use the Allow action.
   */
  decision?: ApplicationsAPI.Decision;

  /**
   * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
   * meet any of the Exclude rules.
   */
  exclude?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Rules evaluated with an OR logical operator. A user needs to meet only one of
   * the Include rules.
   */
  include?: Array<ApplicationsPoliciesAPI.AccessRule>;

  /**
   * Require this application to be served in an isolated browser for users matching
   * this policy. 'Client Web Isolation' must be on for the account in order to use
   * this feature.
   */
  isolation_required?: boolean;

  /**
   * The name of the Access policy.
   */
  name?: string;

  /**
   * A custom message that will appear on the purpose justification screen.
   */
  purpose_justification_prompt?: string;

  /**
   * Require users to enter a justification when they log in to the application.
   */
  purpose_justification_required?: boolean;

  /**
   * Rules evaluated with an AND logical operator. To match the policy, a user must
   * meet all of the Require rules.
   */
  require?: Array<ApplicationsPoliciesAPI.AccessRule>;

  reusable?: true;

  /**
   * The amount of time that tokens issued for the application will be valid. Must be
   * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
   * m, h.
   */
  session_duration?: string;

  updated_at?: string;
}

export interface PolicyCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: The action Access will take if a user matches this policy.
   * Infrastructure application policies can only use the Allow action.
   */
  decision: ApplicationsAPI.DecisionParam;

  /**
   * Body param: Rules evaluated with an OR logical operator. A user needs to meet
   * only one of the Include rules.
   */
  include: Array<ApplicationsPoliciesAPI.AccessRuleParam>;

  /**
   * Body param: The name of the Access policy.
   */
  name: string;

  /**
   * Body param: Administrators who can approve a temporary authentication request.
   */
  approval_groups?: Array<ApprovalGroupParam>;

  /**
   * Body param: Requires the user to request access from an administrator at the
   * start of each session.
   */
  approval_required?: boolean;

  /**
   * Body param: Rules evaluated with a NOT logical operator. To match the policy, a
   * user cannot meet any of the Exclude rules.
   */
  exclude?: Array<ApplicationsPoliciesAPI.AccessRuleParam>;

  /**
   * Body param: Require this application to be served in an isolated browser for
   * users matching this policy. 'Client Web Isolation' must be on for the account in
   * order to use this feature.
   */
  isolation_required?: boolean;

  /**
   * Body param: A custom message that will appear on the purpose justification
   * screen.
   */
  purpose_justification_prompt?: string;

  /**
   * Body param: Require users to enter a justification when they log in to the
   * application.
   */
  purpose_justification_required?: boolean;

  /**
   * Body param: Rules evaluated with an AND logical operator. To match the policy, a
   * user must meet all of the Require rules.
   */
  require?: Array<ApplicationsPoliciesAPI.AccessRuleParam>;

  /**
   * Body param: The amount of time that tokens issued for the application will be
   * valid. Must be in the format `300ms` or `2h45m`. Valid time units are: ns, us
   * (or µs), ms, s, m, h.
   */
  session_duration?: string;
}

export interface PolicyUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: The action Access will take if a user matches this policy.
   * Infrastructure application policies can only use the Allow action.
   */
  decision: ApplicationsAPI.DecisionParam;

  /**
   * Body param: Rules evaluated with an OR logical operator. A user needs to meet
   * only one of the Include rules.
   */
  include: Array<ApplicationsPoliciesAPI.AccessRuleParam>;

  /**
   * Body param: The name of the Access policy.
   */
  name: string;

  /**
   * Body param: Administrators who can approve a temporary authentication request.
   */
  approval_groups?: Array<ApprovalGroupParam>;

  /**
   * Body param: Requires the user to request access from an administrator at the
   * start of each session.
   */
  approval_required?: boolean;

  /**
   * Body param: Rules evaluated with a NOT logical operator. To match the policy, a
   * user cannot meet any of the Exclude rules.
   */
  exclude?: Array<ApplicationsPoliciesAPI.AccessRuleParam>;

  /**
   * Body param: Require this application to be served in an isolated browser for
   * users matching this policy. 'Client Web Isolation' must be on for the account in
   * order to use this feature.
   */
  isolation_required?: boolean;

  /**
   * Body param: A custom message that will appear on the purpose justification
   * screen.
   */
  purpose_justification_prompt?: string;

  /**
   * Body param: Require users to enter a justification when they log in to the
   * application.
   */
  purpose_justification_required?: boolean;

  /**
   * Body param: Rules evaluated with an AND logical operator. To match the policy, a
   * user must meet all of the Require rules.
   */
  require?: Array<ApplicationsPoliciesAPI.AccessRuleParam>;

  /**
   * Body param: The amount of time that tokens issued for the application will be
   * valid. Must be in the format `300ms` or `2h45m`. Valid time units are: ns, us
   * (or µs), ms, s, m, h.
   */
  session_duration?: string;
}

export interface PolicyListParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface PolicyDeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface PolicyGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Policies.PolicyListResponsesSinglePage = PolicyListResponsesSinglePage;

export declare namespace Policies {
  export {
    type ApprovalGroup as ApprovalGroup,
    type Policy as Policy,
    type PolicyCreateResponse as PolicyCreateResponse,
    type PolicyUpdateResponse as PolicyUpdateResponse,
    type PolicyListResponse as PolicyListResponse,
    type PolicyDeleteResponse as PolicyDeleteResponse,
    type PolicyGetResponse as PolicyGetResponse,
    PolicyListResponsesSinglePage as PolicyListResponsesSinglePage,
    type PolicyCreateParams as PolicyCreateParams,
    type PolicyUpdateParams as PolicyUpdateParams,
    type PolicyListParams as PolicyListParams,
    type PolicyDeleteParams as PolicyDeleteParams,
    type PolicyGetParams as PolicyGetParams,
  };
}
