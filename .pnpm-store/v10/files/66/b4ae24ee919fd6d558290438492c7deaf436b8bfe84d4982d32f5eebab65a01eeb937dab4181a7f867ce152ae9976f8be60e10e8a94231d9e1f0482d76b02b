import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Regions extends APIResource {
    /**
     * List all Regional Services regions available for use by this account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const regionListResponse of client.addressing.regionalHostnames.regions.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: RegionListParams, options?: Core.RequestOptions): Core.PagePromise<RegionListResponsesSinglePage, RegionListResponse>;
}
export declare class RegionListResponsesSinglePage extends SinglePage<RegionListResponse> {
}
export interface RegionListResponse {
    /**
     * Identifying key for the region
     */
    key?: string;
    /**
     * Human-readable text label for the region
     */
    label?: string;
}
export interface RegionListParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Regions {
    export { type RegionListResponse as RegionListResponse, RegionListResponsesSinglePage as RegionListResponsesSinglePage, type RegionListParams as RegionListParams, };
}
//# sourceMappingURL=regions.d.ts.map