import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class AvailableAlerts extends APIResource {
    /**
     * Gets a list of all alert types for which an account is eligible.
     *
     * @example
     * ```ts
     * const availableAlerts =
     *   await client.alerting.availableAlerts.list({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    list(params: AvailableAlertListParams, options?: Core.RequestOptions): Core.APIPromise<AvailableAlertListResponse>;
}
export type AvailableAlertListResponse = {
    [key: string]: Array<AvailableAlertListResponse.Item>;
};
export declare namespace AvailableAlertListResponse {
    interface Item {
        /**
         * Describes the alert type.
         */
        description?: string;
        /**
         * Alert type name.
         */
        display_name?: string;
        /**
         * Format of additional configuration options (filters) for the alert type. Data
         * type of filters during policy creation: Array of strings.
         */
        filter_options?: Array<unknown>;
        /**
         * Use this value when creating and updating a notification policy.
         */
        type?: string;
    }
}
export interface AvailableAlertListParams {
    /**
     * The account id
     */
    account_id: string;
}
export declare namespace AvailableAlerts {
    export { type AvailableAlertListResponse as AvailableAlertListResponse, type AvailableAlertListParams as AvailableAlertListParams, };
}
//# sourceMappingURL=available-alerts.d.ts.map