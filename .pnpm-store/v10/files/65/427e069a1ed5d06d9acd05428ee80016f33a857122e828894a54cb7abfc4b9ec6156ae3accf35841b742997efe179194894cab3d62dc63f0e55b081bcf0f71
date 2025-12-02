import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Quota extends APIResource {
    /**
     * Lists the number of secrets used in the account.
     *
     * @example
     * ```ts
     * const quota = await client.secretsStore.quota.get({
     *   account_id: '985e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: QuotaGetParams, options?: Core.RequestOptions): Core.APIPromise<QuotaGetResponse>;
}
export interface QuotaGetResponse {
    secrets: QuotaGetResponse.Secrets;
}
export declare namespace QuotaGetResponse {
    interface Secrets {
        /**
         * The number of secrets the account is entitlted to use
         */
        quota: number;
        /**
         * The number of secrets the account is currently using
         */
        usage: number;
    }
}
export interface QuotaGetParams {
    /**
     * Account Identifier
     */
    account_id: string;
}
export declare namespace Quota {
    export { type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
//# sourceMappingURL=quota.d.ts.map