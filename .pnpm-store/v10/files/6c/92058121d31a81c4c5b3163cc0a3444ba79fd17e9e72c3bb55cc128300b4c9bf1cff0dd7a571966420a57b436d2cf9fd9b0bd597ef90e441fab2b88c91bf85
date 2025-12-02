import { AnalyticsMetaData, AnalyticsQueryOptions, AnalyticsResult } from './analyticstypes';
import { CppConnection } from './binding';
import { Bucket } from './bucket';
import { Cluster } from './cluster';
import { Collection } from './collection';
import { QueryMetaData, QueryOptions, QueryResult } from './querytypes';
import { ScopeSearchIndexManager } from './scopesearchindexmanager';
import { SearchMetaData, SearchQueryOptions, SearchRequest, SearchResult, SearchRow } from './searchtypes';
import { StreamableRowPromise } from './streamablepromises';
import { Transcoder } from './transcoders';
import { NodeCallback } from './utilities';
import { ScopeEventingFunctionManager } from './scopeeventingfunctionmanager';
/**
 * Exposes the operations which are available to be performed against a scope.
 * Namely the ability to access to Collections for performing operations.
 *
 * @category Core
 */
export declare class Scope {
    /**
     * @internal
     */
    static get DEFAULT_NAME(): string;
    private _bucket;
    private _name;
    private _conn;
    /**
    @internal
    */
    constructor(bucket: Bucket, scopeName: string);
    /**
    @internal
    */
    get conn(): CppConnection;
    /**
    @internal
    */
    get bucket(): Bucket;
    /**
    @internal
    */
    get cluster(): Cluster;
    /**
    @internal
    */
    get transcoder(): Transcoder;
    /**
     * The name of the scope this Scope object references.
     */
    get name(): string;
    /**
     * Creates a Collection object reference to a specific collection.
     *
     * @param collectionName The name of the collection to reference.
     */
    collection(collectionName: string): Collection;
    /**
     * Returns a SearchIndexManager which can be used to manage the search
     * indexes of this scope.
     */
    searchIndexes(): ScopeSearchIndexManager;
    /**
     * Returns a ScopeEventingFunctionManager which can be used to manage the eventing
     * functions of this scope.
     * Uncommitted: This API is subject to change in the future.
     */
    eventingFunctions(): ScopeEventingFunctionManager;
    /**
     * Executes a N1QL query against the cluster scoped to this scope.
     *
     * @param statement The N1QL statement to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    query<TRow = any>(statement: string, options?: QueryOptions, callback?: NodeCallback<QueryResult<TRow>>): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>;
    /**
     * Executes an analytics query against the cluster scoped this scope.
     *
     * @param statement The analytics statement to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    analyticsQuery<TRow = any>(statement: string, options?: AnalyticsQueryOptions, callback?: NodeCallback<AnalyticsResult<TRow>>): StreamableRowPromise<AnalyticsResult<TRow>, TRow, AnalyticsMetaData>;
    /**
     * Executes a search query against the scope.
     *
     * @param indexName The name of the index to query.
     * @param request The SearchRequest describing the search to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    search(indexName: string, request: SearchRequest, options?: SearchQueryOptions, callback?: NodeCallback<SearchResult>): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData>;
}
