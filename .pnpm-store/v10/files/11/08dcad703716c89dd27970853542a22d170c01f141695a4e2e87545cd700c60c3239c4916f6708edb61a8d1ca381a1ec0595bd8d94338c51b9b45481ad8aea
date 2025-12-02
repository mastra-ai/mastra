import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Stats extends APIResource {
    /**
     * Fetch usage statistics details for Cloudflare Images.
     *
     * @example
     * ```ts
     * const stat = await client.images.v1.stats.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: StatGetParams, options?: Core.RequestOptions): Core.APIPromise<Stat>;
}
export interface Stat {
    count?: Stat.Count;
}
export declare namespace Stat {
    interface Count {
        /**
         * Cloudflare Images allowed usage.
         */
        allowed?: number;
        /**
         * Cloudflare Images current usage.
         */
        current?: number;
    }
}
export interface StatGetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace Stats {
    export { type Stat as Stat, type StatGetParams as StatGetParams };
}
//# sourceMappingURL=stats.d.ts.map