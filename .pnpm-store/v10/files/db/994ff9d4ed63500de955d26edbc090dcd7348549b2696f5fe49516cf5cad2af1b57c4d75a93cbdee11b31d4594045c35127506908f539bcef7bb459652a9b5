import { CppError, CppQueryResponse } from './binding';
import { Cluster } from './cluster';
import { QueryMetaData, QueryOptions, QueryResult } from './querytypes';
import { StreamableRowPromise } from './streamablepromises';
/**
 * @internal
 */
export declare class QueryExecutor {
    private _cluster;
    /**
     * @internal
     */
    constructor(cluster: Cluster);
    /**
     * @internal
     */
    static execute<TRow = any>(exec: (callback: (err: CppError | null, resp: CppQueryResponse) => void) => void): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>;
    /**
     * @internal
     */
    query<TRow = any>(query: string, options: QueryOptions): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>;
}
