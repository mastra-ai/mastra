import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import * as PoliciesAPI from "../../policies.js";
import * as ApplicationsAPI from "../applications.js";
import * as ApplicationsPoliciesAPI from "../policies.js";
import * as UsersAPI from "./users.js";
import { UserListParams, UserListResponse, UserListResponsesV4PagePaginationArray, Users } from "./users.js";
export declare class PolicyTests extends APIResource {
    users: UsersAPI.Users;
    /**
     * Starts an Access policy test.
     *
     * @example
     * ```ts
     * const policyTest =
     *   await client.zeroTrust.access.applications.policyTests.create(
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(params: PolicyTestCreateParams, options?: Core.RequestOptions): Core.APIPromise<PolicyTestCreateResponse>;
    /**
     * Fetches the current status of a given Access policy test.
     *
     * @example
     * ```ts
     * const policyTest =
     *   await client.zeroTrust.access.applications.policyTests.get(
     *     'f1a8b3c9d4e5f6789a0b1c2d3e4f5678a9b0c1d2e3f4a5b67890c1d2e3f4b5a6',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(policyTestId: string, params: PolicyTestGetParams, options?: Core.RequestOptions): Core.APIPromise<PolicyTestGetResponse>;
}
export interface PolicyTestCreateResponse {
    /**
     * The UUID of the policy test.
     */
    id?: string;
    /**
     * The status of the policy test request.
     */
    status?: 'success';
}
export interface PolicyTestGetResponse {
    /**
     * The UUID of the policy test.
     */
    id?: string;
    /**
     * The percentage of (processed) users approved based on policy evaluation results.
     */
    percent_approved?: number;
    /**
     * The percentage of (processed) users blocked based on policy evaluation results.
     */
    percent_blocked?: number;
    /**
     * The percentage of (processed) users errored based on policy evaluation results.
     */
    percent_errored?: number;
    /**
     * The percentage of users processed so far (of the entire user base).
     */
    percent_users_processed?: number;
    /**
     * The status of the policy test.
     */
    status?: 'blocked' | 'processing' | 'exceeded time' | 'complete';
    /**
     * The total number of users in the user base.
     */
    total_users?: number;
    /**
     * The number of (processed) users approved based on policy evaluation results.
     */
    users_approved?: number;
    /**
     * The number of (processed) users blocked based on policy evaluation results.
     */
    users_blocked?: number;
    /**
     * The number of (processed) users errored based on policy evaluation results.
     */
    users_errored?: number;
}
export interface PolicyTestCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    policies?: Array<PolicyTestCreateParams.UnionMember0 | string>;
}
export declare namespace PolicyTestCreateParams {
    interface UnionMember0 {
        /**
         * The action Access will take if a user matches this policy. Infrastructure
         * application policies can only use the Allow action.
         */
        decision: ApplicationsAPI.DecisionParam;
        /**
         * Rules evaluated with an OR logical operator. A user needs to meet only one of
         * the Include rules.
         */
        include: Array<ApplicationsPoliciesAPI.AccessRuleParam>;
        /**
         * The name of the Access policy.
         */
        name: string;
        /**
         * Administrators who can approve a temporary authentication request.
         */
        approval_groups?: Array<PoliciesAPI.ApprovalGroupParam>;
        /**
         * Requires the user to request access from an administrator at the start of each
         * session.
         */
        approval_required?: boolean;
        /**
         * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
         * meet any of the Exclude rules.
         */
        exclude?: Array<ApplicationsPoliciesAPI.AccessRuleParam>;
        /**
         * Require this application to be served in an isolated browser for users matching
         * this policy. 'Client Web Isolation' must be on for the account in order to use
         * this feature.
         */
        isolation_required?: boolean;
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
        require?: Array<ApplicationsPoliciesAPI.AccessRuleParam>;
        /**
         * The amount of time that tokens issued for the application will be valid. Must be
         * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
         * m, h.
         */
        session_duration?: string;
    }
}
export interface PolicyTestGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace PolicyTests {
    export { type PolicyTestCreateResponse as PolicyTestCreateResponse, type PolicyTestGetResponse as PolicyTestGetResponse, type PolicyTestCreateParams as PolicyTestCreateParams, type PolicyTestGetParams as PolicyTestGetParams, };
    export { Users as Users, type UserListResponse as UserListResponse, UserListResponsesV4PagePaginationArray as UserListResponsesV4PagePaginationArray, type UserListParams as UserListParams, };
}
//# sourceMappingURL=policy-tests.d.ts.map