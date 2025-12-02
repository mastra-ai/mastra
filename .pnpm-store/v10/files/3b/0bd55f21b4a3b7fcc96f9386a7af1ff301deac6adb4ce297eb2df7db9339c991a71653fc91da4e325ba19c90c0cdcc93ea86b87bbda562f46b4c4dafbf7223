import { APIResource } from "../../resource.js";
import * as DatabaseAPI from "./database.js";
import { Database, DatabaseCreateParams, DatabaseDeleteParams, DatabaseDeleteResponse, DatabaseEditParams, DatabaseExportParams, DatabaseExportResponse, DatabaseGetParams, DatabaseImportParams, DatabaseImportResponse, DatabaseListParams, DatabaseListResponse, DatabaseListResponsesV4PagePaginationArray, DatabaseQueryParams, DatabaseRawParams, DatabaseRawResponse, DatabaseRawResponsesSinglePage, DatabaseUpdateParams, QueryResult, QueryResultsSinglePage } from "./database.js";
export declare class D1Resource extends APIResource {
    database: DatabaseAPI.Database;
}
/**
 * The details of the D1 database.
 */
export interface D1 {
    /**
     * Specifies the timestamp the resource was created as an ISO8601 string.
     */
    created_at?: string;
    /**
     * The D1 database's size, in bytes.
     */
    file_size?: number;
    /**
     * D1 database name.
     */
    name?: string;
    num_tables?: number;
    /**
     * Configuration for D1 read replication.
     */
    read_replication?: D1.ReadReplication;
    /**
     * D1 database identifier (UUID).
     */
    uuid?: string;
    version?: string;
}
export declare namespace D1 {
    /**
     * Configuration for D1 read replication.
     */
    interface ReadReplication {
        /**
         * The read replication mode for the database. Use 'auto' to create replicas and
         * allow D1 automatically place them around the world, or 'disabled' to not use any
         * database replicas (it can take a few hours for all replicas to be deleted).
         */
        mode: 'auto' | 'disabled';
    }
}
export declare namespace D1Resource {
    export { type D1 as D1 };
    export { Database as Database, type QueryResult as QueryResult, type DatabaseListResponse as DatabaseListResponse, type DatabaseDeleteResponse as DatabaseDeleteResponse, type DatabaseExportResponse as DatabaseExportResponse, type DatabaseImportResponse as DatabaseImportResponse, type DatabaseRawResponse as DatabaseRawResponse, DatabaseListResponsesV4PagePaginationArray as DatabaseListResponsesV4PagePaginationArray, QueryResultsSinglePage as QueryResultsSinglePage, DatabaseRawResponsesSinglePage as DatabaseRawResponsesSinglePage, type DatabaseCreateParams as DatabaseCreateParams, type DatabaseUpdateParams as DatabaseUpdateParams, type DatabaseListParams as DatabaseListParams, type DatabaseDeleteParams as DatabaseDeleteParams, type DatabaseEditParams as DatabaseEditParams, type DatabaseExportParams as DatabaseExportParams, type DatabaseGetParams as DatabaseGetParams, type DatabaseImportParams as DatabaseImportParams, type DatabaseQueryParams as DatabaseQueryParams, type DatabaseRawParams as DatabaseRawParams, };
}
//# sourceMappingURL=d1.d.ts.map