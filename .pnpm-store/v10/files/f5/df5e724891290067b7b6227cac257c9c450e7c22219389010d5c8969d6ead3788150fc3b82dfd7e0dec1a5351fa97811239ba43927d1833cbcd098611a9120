import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class TargetIndustries extends APIResource {
    /**
     * Lists all target industries
     *
     * @example
     * ```ts
     * const targetIndustries =
     *   await client.cloudforceOne.threatEvents.targetIndustries.list(
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    list(params: TargetIndustryListParams, options?: Core.RequestOptions): Core.APIPromise<TargetIndustryListResponse>;
}
export interface TargetIndustryListResponse {
    items: TargetIndustryListResponse.Items;
    type: string;
}
export declare namespace TargetIndustryListResponse {
    interface Items {
        type: string;
    }
}
export interface TargetIndustryListParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace TargetIndustries {
    export { type TargetIndustryListResponse as TargetIndustryListResponse, type TargetIndustryListParams as TargetIndustryListParams, };
}
//# sourceMappingURL=target-industries.d.ts.map