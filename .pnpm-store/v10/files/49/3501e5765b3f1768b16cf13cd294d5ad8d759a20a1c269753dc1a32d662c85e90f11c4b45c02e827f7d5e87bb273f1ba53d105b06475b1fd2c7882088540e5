import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Scripts extends APIResource {
    /**
     * Lists all scripts detected by Page Shield.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const script of client.pageShield.scripts.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: ScriptListParams, options?: Core.RequestOptions): Core.PagePromise<ScriptsSinglePage, Script>;
    /**
     * Fetches a script detected by Page Shield by script ID.
     *
     * @example
     * ```ts
     * const script = await client.pageShield.scripts.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptId: string, params: ScriptGetParams, options?: Core.RequestOptions): Core.APIPromise<ScriptGetResponse | null>;
}
export declare class ScriptsSinglePage extends SinglePage<Script> {
}
export interface Script {
    /**
     * Identifier
     */
    id: string;
    added_at: string;
    first_seen_at: string;
    host: string;
    last_seen_at: string;
    url: string;
    url_contains_cdn_cgi_path: boolean;
    /**
     * The cryptomining score of the JavaScript content.
     */
    cryptomining_score?: number | null;
    /**
     * The dataflow score of the JavaScript content.
     */
    dataflow_score?: number | null;
    domain_reported_malicious?: boolean;
    /**
     * The timestamp of when the script was last fetched.
     */
    fetched_at?: string | null;
    first_page_url?: string;
    /**
     * The computed hash of the analyzed script.
     */
    hash?: string | null;
    /**
     * The integrity score of the JavaScript content.
     */
    js_integrity_score?: number | null;
    /**
     * The magecart score of the JavaScript content.
     */
    magecart_score?: number | null;
    malicious_domain_categories?: Array<string>;
    malicious_url_categories?: Array<string>;
    /**
     * The malware score of the JavaScript content.
     */
    malware_score?: number | null;
    /**
     * The obfuscation score of the JavaScript content.
     */
    obfuscation_score?: number | null;
    page_urls?: Array<string>;
    url_reported_malicious?: boolean;
}
export interface ScriptGetResponse {
    /**
     * Identifier
     */
    id: string;
    added_at: string;
    first_seen_at: string;
    host: string;
    last_seen_at: string;
    url: string;
    url_contains_cdn_cgi_path: boolean;
    /**
     * The cryptomining score of the JavaScript content.
     */
    cryptomining_score?: number | null;
    /**
     * The dataflow score of the JavaScript content.
     */
    dataflow_score?: number | null;
    domain_reported_malicious?: boolean;
    /**
     * The timestamp of when the script was last fetched.
     */
    fetched_at?: string | null;
    first_page_url?: string;
    /**
     * The computed hash of the analyzed script.
     */
    hash?: string | null;
    /**
     * The integrity score of the JavaScript content.
     */
    js_integrity_score?: number | null;
    /**
     * The magecart score of the JavaScript content.
     */
    magecart_score?: number | null;
    malicious_domain_categories?: Array<string>;
    malicious_url_categories?: Array<string>;
    /**
     * The malware score of the JavaScript content.
     */
    malware_score?: number | null;
    /**
     * The obfuscation score of the JavaScript content.
     */
    obfuscation_score?: number | null;
    page_urls?: Array<string>;
    url_reported_malicious?: boolean;
    versions?: Array<ScriptGetResponse.Version> | null;
}
export declare namespace ScriptGetResponse {
    /**
     * The version of the analyzed script.
     */
    interface Version {
        /**
         * The cryptomining score of the JavaScript content.
         */
        cryptomining_score?: number | null;
        /**
         * The dataflow score of the JavaScript content.
         */
        dataflow_score?: number | null;
        /**
         * The timestamp of when the script was last fetched.
         */
        fetched_at?: string | null;
        /**
         * The computed hash of the analyzed script.
         */
        hash?: string | null;
        /**
         * The integrity score of the JavaScript content.
         */
        js_integrity_score?: number | null;
        /**
         * The magecart score of the JavaScript content.
         */
        magecart_score?: number | null;
        /**
         * The malware score of the JavaScript content.
         */
        malware_score?: number | null;
        /**
         * The obfuscation score of the JavaScript content.
         */
        obfuscation_score?: number | null;
    }
}
export interface ScriptListParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Query param: The direction used to sort returned scripts.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: When true, excludes scripts seen in a `/cdn-cgi` path from the
     * returned scripts. The default value is true.
     */
    exclude_cdn_cgi?: boolean;
    /**
     * Query param: When true, excludes duplicate scripts. We consider a script
     * duplicate of another if their javascript content matches and they share the same
     * url host and zone hostname. In such case, we return the most recent script for
     * the URL host and zone hostname combination.
     */
    exclude_duplicates?: boolean;
    /**
     * Query param: Excludes scripts whose URL contains one of the URL-encoded URLs
     * separated by commas.
     */
    exclude_urls?: string;
    /**
     * Query param: Export the list of scripts as a file.
     */
    export?: 'csv';
    /**
     * Query param: Includes scripts that match one or more URL-encoded hostnames
     * separated by commas.
     *
     * Wildcards are supported at the start and end of each hostname to support starts
     * with, ends with and contains. If no wildcards are used, results will be filtered
     * by exact match
     */
    hosts?: string;
    /**
     * Query param: The field used to sort returned scripts.
     */
    order_by?: 'first_seen_at' | 'last_seen_at';
    /**
     * Query param: The current page number of the paginated results.
     *
     * We additionally support a special value "all". When "all" is used, the API will
     * return all the scripts with the applied filters in a single page. This feature
     * is best-effort and it may only work for zones with a low number of scripts
     */
    page?: string;
    /**
     * Query param: Includes scripts that match one or more page URLs (separated by
     * commas) where they were last seen
     *
     * Wildcards are supported at the start and end of each page URL to support starts
     * with, ends with and contains. If no wildcards are used, results will be filtered
     * by exact match
     */
    page_url?: string;
    /**
     * Query param: The number of results per page.
     */
    per_page?: number;
    /**
     * Query param: When true, malicious scripts appear first in the returned scripts.
     */
    prioritize_malicious?: boolean;
    /**
     * Query param: Filters the returned scripts using a comma-separated list of
     * scripts statuses. Accepted values: `active`, `infrequent`, and `inactive`. The
     * default value is `active`.
     */
    status?: string;
    /**
     * Query param: Includes scripts whose URL contain one or more URL-encoded URLs
     * separated by commas.
     */
    urls?: string;
}
export interface ScriptGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace Scripts {
    export { type Script as Script, type ScriptGetResponse as ScriptGetResponse, ScriptsSinglePage as ScriptsSinglePage, type ScriptListParams as ScriptListParams, type ScriptGetParams as ScriptGetParams, };
}
//# sourceMappingURL=scripts.d.ts.map