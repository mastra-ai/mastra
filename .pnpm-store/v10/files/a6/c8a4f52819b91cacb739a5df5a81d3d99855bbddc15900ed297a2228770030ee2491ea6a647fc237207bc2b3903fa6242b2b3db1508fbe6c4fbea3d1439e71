import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class IndicatorTypes extends APIResource {
    /**
     * Lists all indicator types
     *
     * @example
     * ```ts
     * const indicatorTypes =
     *   await client.cloudforceOne.threatEvents.indicatorTypes.list(
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    list(params: IndicatorTypeListParams, options?: Core.RequestOptions): Core.APIPromise<IndicatorTypeListResponse>;
}
export interface IndicatorTypeListResponse {
    items: IndicatorTypeListResponse.Items;
    type: string;
}
export declare namespace IndicatorTypeListResponse {
    interface Items {
        type: string;
    }
}
export interface IndicatorTypeListParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace IndicatorTypes {
    export { type IndicatorTypeListResponse as IndicatorTypeListResponse, type IndicatorTypeListParams as IndicatorTypeListParams, };
}
//# sourceMappingURL=indicator-types.d.ts.map