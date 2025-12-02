import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Summary extends APIResource {
    /**
     * Get risk score info for all users in the account
     *
     * @example
     * ```ts
     * const summary =
     *   await client.zeroTrust.riskScoring.summary.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params: SummaryGetParams, options?: Core.RequestOptions): Core.APIPromise<SummaryGetResponse>;
}
export interface SummaryGetResponse {
    users: Array<SummaryGetResponse.User>;
}
export declare namespace SummaryGetResponse {
    interface User {
        email: string;
        event_count: number;
        last_event: string;
        max_risk_level: 'low' | 'medium' | 'high';
        name: string;
        user_id: string;
    }
}
export interface SummaryGetParams {
    account_id: string;
}
export declare namespace Summary {
    export { type SummaryGetResponse as SummaryGetResponse, type SummaryGetParams as SummaryGetParams };
}
//# sourceMappingURL=summary.d.ts.map