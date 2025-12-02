import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Connections extends APIResource {
    /**
     * Lists all connections detected by Page Shield.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const connection of client.pageShield.connections.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: ConnectionListParams, options?: Core.RequestOptions): Core.PagePromise<ConnectionsSinglePage, Connection>;
    /**
     * Fetches a connection detected by Page Shield by connection ID.
     *
     * @example
     * ```ts
     * const connection = await client.pageShield.connections.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(connectionId: string, params: ConnectionGetParams, options?: Core.RequestOptions): Core.APIPromise<Connection | null>;
}
export declare class ConnectionsSinglePage extends SinglePage<Connection> {
}
export interface Connection {
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
    domain_reported_malicious?: boolean;
    first_page_url?: string;
    malicious_domain_categories?: Array<string>;
    malicious_url_categories?: Array<string>;
    page_urls?: Array<string>;
    url_reported_malicious?: boolean;
}
export interface ConnectionListParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Query param: The direction used to sort returned connections.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: When true, excludes connections seen in a `/cdn-cgi` path from the
     * returned connections. The default value is true.
     */
    exclude_cdn_cgi?: boolean;
    /**
     * Query param: Excludes connections whose URL contains one of the URL-encoded URLs
     * separated by commas.
     */
    exclude_urls?: string;
    /**
     * Query param: Export the list of connections as a file.
     */
    export?: 'csv';
    /**
     * Query param: Includes connections that match one or more URL-encoded hostnames
     * separated by commas.
     *
     * Wildcards are supported at the start and end of each hostname to support starts
     * with, ends with and contains. If no wildcards are used, results will be filtered
     * by exact match
     */
    hosts?: string;
    /**
     * Query param: The field used to sort returned connections.
     */
    order_by?: 'first_seen_at' | 'last_seen_at';
    /**
     * Query param: The current page number of the paginated results.
     *
     * We additionally support a special value "all". When "all" is used, the API will
     * return all the connections with the applied filters in a single page. This
     * feature is best-effort and it may only work for zones with a low number of
     * connections
     */
    page?: string;
    /**
     * Query param: Includes connections that match one or more page URLs (separated by
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
     * Query param: When true, malicious connections appear first in the returned
     * connections.
     */
    prioritize_malicious?: boolean;
    /**
     * Query param: Filters the returned connections using a comma-separated list of
     * connection statuses. Accepted values: `active`, `infrequent`, and `inactive`.
     * The default value is `active`.
     */
    status?: string;
    /**
     * Query param: Includes connections whose URL contain one or more URL-encoded URLs
     * separated by commas.
     */
    urls?: string;
}
export interface ConnectionGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace Connections {
    export { type Connection as Connection, ConnectionsSinglePage as ConnectionsSinglePage, type ConnectionListParams as ConnectionListParams, type ConnectionGetParams as ConnectionGetParams, };
}
//# sourceMappingURL=connections.d.ts.map