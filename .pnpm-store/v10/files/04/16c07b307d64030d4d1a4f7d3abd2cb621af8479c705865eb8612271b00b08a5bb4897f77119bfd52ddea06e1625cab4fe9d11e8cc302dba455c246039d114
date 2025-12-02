import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Limits extends APIResource {
    /**
     * Fetch limits associated with DLP for account
     *
     * @example
     * ```ts
     * const limits = await client.zeroTrust.dlp.limits.list({
     *   account_id: 'account_id',
     * });
     * ```
     */
    list(params: LimitListParams, options?: Core.RequestOptions): Core.APIPromise<LimitListResponse>;
}
export interface LimitListResponse {
    max_dataset_cells: number;
}
export interface LimitListParams {
    account_id: string;
}
export declare namespace Limits {
    export { type LimitListResponse as LimitListResponse, type LimitListParams as LimitListParams };
}
//# sourceMappingURL=limits.d.ts.map