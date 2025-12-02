import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class History extends APIResource {
    /**
     * Accesses your billing history object.
     *
     * @deprecated
     */
    list(query?: HistoryListParams, options?: Core.RequestOptions): Core.PagePromise<BillingHistoriesV4PagePaginationArray, BillingHistory>;
    list(options?: Core.RequestOptions): Core.PagePromise<BillingHistoriesV4PagePaginationArray, BillingHistory>;
}
export declare class BillingHistoriesV4PagePaginationArray extends V4PagePaginationArray<BillingHistory> {
}
export interface BillingHistory {
    /**
     * Billing item identifier tag.
     */
    id: string;
    /**
     * The billing item action.
     */
    action: string;
    /**
     * The amount associated with this billing item.
     */
    amount: number;
    /**
     * The monetary unit in which pricing information is displayed.
     */
    currency: string;
    /**
     * The billing item description.
     */
    description: string;
    /**
     * When the billing item was created.
     */
    occurred_at: string;
    /**
     * The billing item type.
     */
    type: string;
    zone: BillingHistory.Zone;
}
export declare namespace BillingHistory {
    interface Zone {
        name?: string;
    }
}
export interface HistoryListParams extends V4PagePaginationArrayParams {
    /**
     * The billing item action.
     */
    action?: string;
    /**
     * When the billing item was created.
     */
    occurred_at?: string;
    /**
     * Field to order billing history by.
     */
    order?: 'type' | 'occurred_at' | 'action';
    /**
     * The billing item type.
     */
    type?: string;
}
export declare namespace History {
    export { type BillingHistory as BillingHistory, BillingHistoriesV4PagePaginationArray as BillingHistoriesV4PagePaginationArray, type HistoryListParams as HistoryListParams, };
}
//# sourceMappingURL=history.d.ts.map