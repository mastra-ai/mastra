import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class HistoryResource extends APIResource {
    /**
     * Gets a list of history records for notifications sent to an account. The records
     * are displayed for last `x` number of days based on the zone plan (free = 30, pro
     * = 30, biz = 30, ent = 90).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const history of client.alerting.history.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: HistoryListParams, options?: Core.RequestOptions): Core.PagePromise<HistoriesV4PagePaginationArray, History>;
}
export declare class HistoriesV4PagePaginationArray extends V4PagePaginationArray<History> {
}
export interface History {
    /**
     * UUID
     */
    id?: string;
    /**
     * Message body included in the notification sent.
     */
    alert_body?: string;
    /**
     * Type of notification that has been dispatched.
     */
    alert_type?: string;
    /**
     * Description of the notification policy (if present).
     */
    description?: string;
    /**
     * The mechanism to which the notification has been dispatched.
     */
    mechanism?: string;
    /**
     * The type of mechanism to which the notification has been dispatched. This can be
     * email/pagerduty/webhook based on the mechanism configured.
     */
    mechanism_type?: 'email' | 'pagerduty' | 'webhook';
    /**
     * Name of the policy.
     */
    name?: string;
    /**
     * The unique identifier of a notification policy
     */
    policy_id?: string;
    /**
     * Timestamp of when the notification was dispatched in ISO 8601 format.
     */
    sent?: string;
}
export interface HistoryListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: The account id
     */
    account_id: string;
    /**
     * Query param: Limit the returned results to history records older than the
     * specified date. This must be a timestamp that conforms to RFC3339.
     */
    before?: string;
    /**
     * Query param: Limit the returned results to history records newer than the
     * specified date. This must be a timestamp that conforms to RFC3339.
     */
    since?: string;
}
export declare namespace HistoryResource {
    export { type History as History, HistoriesV4PagePaginationArray as HistoriesV4PagePaginationArray, type HistoryListParams as HistoryListParams, };
}
//# sourceMappingURL=history.d.ts.map