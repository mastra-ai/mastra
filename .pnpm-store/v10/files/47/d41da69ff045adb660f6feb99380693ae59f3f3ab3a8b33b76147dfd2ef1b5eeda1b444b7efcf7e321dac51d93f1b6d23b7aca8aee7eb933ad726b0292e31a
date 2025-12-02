import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Quota extends APIResource {
    /**
     * For a given zone, list certificate pack quotas.
     *
     * @example
     * ```ts
     * const quota = await client.ssl.certificatePacks.quota.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: QuotaGetParams, options?: Core.RequestOptions): Core.APIPromise<QuotaGetResponse>;
}
export interface QuotaGetResponse {
    advanced?: QuotaGetResponse.Advanced;
}
export declare namespace QuotaGetResponse {
    interface Advanced {
        /**
         * Quantity Allocated.
         */
        allocated?: number;
        /**
         * Quantity Used.
         */
        used?: number;
    }
}
export interface QuotaGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Quota {
    export { type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
//# sourceMappingURL=quota.d.ts.map