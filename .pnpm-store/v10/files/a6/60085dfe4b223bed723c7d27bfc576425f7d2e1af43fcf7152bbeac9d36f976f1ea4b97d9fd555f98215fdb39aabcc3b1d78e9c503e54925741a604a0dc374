import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Sinkholes extends APIResource {
    /**
     * List sinkholes owned by this account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const sinkhole of client.intel.sinkholes.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: SinkholeListParams, options?: Core.RequestOptions): Core.PagePromise<SinkholesSinglePage, Sinkhole>;
}
export declare class SinkholesSinglePage extends SinglePage<Sinkhole> {
}
export interface Sinkhole {
    /**
     * The unique identifier for the sinkhole
     */
    id?: number;
    /**
     * The account tag that owns this sinkhole
     */
    account_tag?: string;
    /**
     * The date and time when the sinkhole was created
     */
    created_on?: string;
    /**
     * The date and time when the sinkhole was last modified
     */
    modified_on?: string;
    /**
     * The name of the sinkhole
     */
    name?: string;
    /**
     * The name of the R2 bucket to store results
     */
    r2_bucket?: string;
    /**
     * The id of the R2 instance
     */
    r2_id?: string;
}
export interface SinkholeListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace Sinkholes {
    export { type Sinkhole as Sinkhole, SinkholesSinglePage as SinkholesSinglePage, type SinkholeListParams as SinkholeListParams, };
}
//# sourceMappingURL=sinkholes.d.ts.map