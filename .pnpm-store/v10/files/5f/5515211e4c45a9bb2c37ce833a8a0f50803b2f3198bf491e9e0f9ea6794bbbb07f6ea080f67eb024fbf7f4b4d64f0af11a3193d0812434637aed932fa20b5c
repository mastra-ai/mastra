import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Eligible extends APIResource {
    /**
     * Get a list of all delivery mechanism types for which an account is eligible.
     *
     * @example
     * ```ts
     * const eligible =
     *   await client.alerting.destinations.eligible.get({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params: EligibleGetParams, options?: Core.RequestOptions): Core.APIPromise<EligibleGetResponse>;
}
export type EligibleGetResponse = {
    [key: string]: Array<EligibleGetResponse.Item>;
};
export declare namespace EligibleGetResponse {
    interface Item {
        /**
         * Determines whether or not the account is eligible for the delivery mechanism.
         */
        eligible?: boolean;
        /**
         * Beta flag. Users can create a policy with a mechanism that is not ready, but we
         * cannot guarantee successful delivery of notifications.
         */
        ready?: boolean;
        /**
         * Determines type of delivery mechanism.
         */
        type?: 'email' | 'pagerduty' | 'webhook';
    }
}
export interface EligibleGetParams {
    /**
     * The account id
     */
    account_id: string;
}
export declare namespace Eligible {
    export { type EligibleGetResponse as EligibleGetResponse, type EligibleGetParams as EligibleGetParams };
}
//# sourceMappingURL=eligible.d.ts.map