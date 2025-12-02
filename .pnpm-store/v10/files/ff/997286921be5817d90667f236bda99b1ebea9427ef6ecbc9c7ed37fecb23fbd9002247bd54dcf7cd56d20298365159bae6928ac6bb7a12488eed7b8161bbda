import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Quota extends APIResource {
    /**
     * Retrieves the current quota usage and limits for device commands within a
     * specific account, including the time when the quota will reset
     *
     * @example
     * ```ts
     * const quota = await client.zeroTrust.dex.commands.quota.get(
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    get(params: QuotaGetParams, options?: Core.RequestOptions): Core.APIPromise<QuotaGetResponse>;
}
export interface QuotaGetResponse {
    /**
     * The remaining number of commands that can be initiated for an account
     */
    quota: number;
    /**
     * The number of commands that have been initiated for an account
     */
    quota_usage: number;
    /**
     * The time when the quota resets
     */
    reset_time: string;
}
export interface QuotaGetParams {
    /**
     * unique identifier linked to an account in the API request path
     */
    account_id: string;
}
export declare namespace Quota {
    export { type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
//# sourceMappingURL=quota.d.ts.map