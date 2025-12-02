import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Search extends APIResource {
    /**
     * Searches for locations, autonomous systems, reports, and bots.
     *
     * @example
     * ```ts
     * const response = await client.radar.search.global({
     *   query: 'United',
     * });
     * ```
     */
    global(query: SearchGlobalParams, options?: Core.RequestOptions): Core.APIPromise<SearchGlobalResponse>;
}
export interface SearchGlobalResponse {
    search: Array<SearchGlobalResponse.Search>;
}
export declare namespace SearchGlobalResponse {
    interface Search {
        code: string;
        name: string;
        type: string;
    }
}
export interface SearchGlobalParams {
    /**
     * Search for locations, autonomous systems and reports.
     */
    query: string;
    /**
     * Search types excluded from results.
     */
    exclude?: Array<'ASNS' | 'BOTS' | 'LOCATIONS' | 'NOTEBOOKS' | 'SPECIAL_EVENTS'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Search types included in results.
     */
    include?: Array<'ASNS' | 'BOTS' | 'LOCATIONS' | 'NOTEBOOKS' | 'SPECIAL_EVENTS'>;
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Limits the number of objects per search category.
     */
    limitPerGroup?: number;
}
export declare namespace Search {
    export { type SearchGlobalResponse as SearchGlobalResponse, type SearchGlobalParams as SearchGlobalParams };
}
//# sourceMappingURL=search.d.ts.map