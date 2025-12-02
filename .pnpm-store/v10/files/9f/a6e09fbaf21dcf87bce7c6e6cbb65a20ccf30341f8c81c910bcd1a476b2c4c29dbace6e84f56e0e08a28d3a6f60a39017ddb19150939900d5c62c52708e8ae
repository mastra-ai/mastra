import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class PrebuiltPolicies extends APIResource {
    /**
     * List prebuilt catalog sync policies (Closed Beta).
     */
    list(params: PrebuiltPolicyListParams, options?: Core.RequestOptions): Core.PagePromise<PrebuiltPolicyListResponsesSinglePage, PrebuiltPolicyListResponse>;
}
export declare class PrebuiltPolicyListResponsesSinglePage extends SinglePage<PrebuiltPolicyListResponse> {
}
export interface PrebuiltPolicyListResponse {
    applicable_destinations: Array<'NONE' | 'ZERO_TRUST_LIST'>;
    policy_description: string;
    policy_name: string;
    policy_string: string;
}
export interface PrebuiltPolicyListParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Query param: Specify type of destination, omit to return all.
     */
    destination_type?: 'NONE' | 'ZERO_TRUST_LIST';
}
export declare namespace PrebuiltPolicies {
    export { type PrebuiltPolicyListResponse as PrebuiltPolicyListResponse, PrebuiltPolicyListResponsesSinglePage as PrebuiltPolicyListResponsesSinglePage, type PrebuiltPolicyListParams as PrebuiltPolicyListParams, };
}
//# sourceMappingURL=prebuilt-policies.d.ts.map