import { Cluster } from './cluster';
import { SearchQuery } from './searchquery';
import { SearchMetaData, SearchQueryOptions, SearchRequest, SearchResult, SearchRow } from './searchtypes';
import { StreamableRowPromise } from './streamablepromises';
/**
 * @internal
 */
export declare class SearchExecutor {
    private _cluster;
    private _bucketName;
    private _scopeName;
    /**
     * @internal
     */
    constructor(cluster: Cluster, bucketName?: string, scopeName?: string);
    /**
     * @internal
     */
    query(indexName: string, query: SearchQuery | SearchRequest, options: SearchQueryOptions): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData>;
}
