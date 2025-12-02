import { Cluster } from './cluster';
import { NodeCallback } from './utilities';
import { CppManagementSearchIndex } from './binding';
/**
 * Provides information about a search index.  This class is currently
 * incomplete and must be casted from `any` in TypeScript.
 *
 * @category Management
 */
export interface ISearchIndex {
    /**
     * The UUID of the search index.  Used for updates to ensure consistency.
     */
    uuid?: string;
    /**
     * The name of the search index.
     */
    name: string;
    /**
     * Name of the source of the data (ie: the bucket name).
     */
    sourceName: string;
    /**
     * The type of index to use (fulltext-index or fulltext-alias).
     */
    type: string;
    /**
     * Parameters to specify such as the store type and mappins.
     */
    params: {
        [key: string]: any;
    };
    /**
     * The UUID of the data source.
     */
    sourceUuid: string;
    /**
     * Extra parameters for the source.  These are usually things like advanced
     * connection options and tuning parameters.
     */
    sourceParams: {
        [key: string]: any;
    };
    /**
     * The type of the source (couchbase or nil).
     */
    sourceType: string;
    /**
     * Plan properties such as the number of replicas and number of partitions.
     */
    planParams: {
        [key: string]: any;
    };
}
/**
 * This class is currently incomplete and must be casted to `any` in
 * TypeScript to be used.
 *
 * @category Management
 */
export declare class SearchIndex implements ISearchIndex {
    /**
     * The UUID of the search index.  Used for updates to ensure consistency.
     */
    uuid?: string;
    /**
     * The name of the search index.
     */
    name: string;
    /**
     * Name of the source of the data (ie: the bucket name).
     */
    sourceName: string;
    /**
     * The type of index to use (fulltext-index or fulltext-alias).
     */
    type: string;
    /**
     * Parameters to specify such as the store type and mappins.
     */
    params: {
        [key: string]: any;
    };
    /**
     * The UUID of the data source.
     */
    sourceUuid: string;
    /**
     * Extra parameters for the source.  These are usually things like advanced
     * connection options and tuning parameters.
     */
    sourceParams: {
        [key: string]: any;
    };
    /**
     * The type of the source (couchbase or nil).
     */
    sourceType: string;
    /**
     * Plan properties such as the number of replicas and number of partitions.
     */
    planParams: {
        [key: string]: any;
    };
    /**
     * @internal
     */
    constructor(data: SearchIndex);
    /**
     * @internal
     */
    static _toCppData(data: ISearchIndex): any;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementSearchIndex): SearchIndex;
}
/**
 * @category Management
 */
export interface GetSearchIndexOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllSearchIndexesOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface UpsertSearchIndexOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropSearchIndexOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetSearchIndexedDocumentsCountOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface PauseSearchIngestOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface ResumeSearchIngestOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface AllowSearchQueryingOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DisallowSearchQueryingOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface FreezeSearchPlanOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface UnfreezeSearchPlanOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface AnalyzeSearchDocumentOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * SearchIndexManager provides an interface for managing the
 * search indexes on the cluster.
 *
 * @category Management
 */
export declare class SearchIndexManager {
    private _cluster;
    /**
     * @internal
     */
    constructor(cluster: Cluster);
    /**
     * Returns an index by it's name.
     *
     * @param indexName The index to retrieve.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getIndex(indexName: string, options?: GetSearchIndexOptions, callback?: NodeCallback<SearchIndex>): Promise<SearchIndex>;
    /**
     * Returns a list of all existing indexes.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllIndexes(options?: GetAllSearchIndexesOptions, callback?: NodeCallback<SearchIndex[]>): Promise<SearchIndex[]>;
    /**
     * Creates or updates an existing index.
     *
     * @param indexDefinition The index to update.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    upsertIndex(indexDefinition: ISearchIndex, options?: UpsertSearchIndexOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops an index.
     *
     * @param indexName The name of the index to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropIndex(indexName: string, options?: DropSearchIndexOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Returns the number of documents that have been indexed.
     *
     * @param indexName The name of the index to return the count for.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getIndexedDocumentsCount(indexName: string, options?: GetSearchIndexedDocumentsCountOptions, callback?: NodeCallback<number>): Promise<number>;
    /**
     * Pauses the ingestion of documents into an index.
     *
     * @param indexName The name of the index to pause.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    pauseIngest(indexName: string, options?: PauseSearchIngestOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Resumes the ingestion of documents into an index.
     *
     * @param indexName The name of the index to resume.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    resumeIngest(indexName: string, options?: ResumeSearchIngestOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Enables querying of an index.
     *
     * @param indexName The name of the index to enable querying for.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    allowQuerying(indexName: string, options?: AllowSearchQueryingOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Disables querying of an index.
     *
     * @param indexName The name of the index to disable querying for.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    disallowQuerying(indexName: string, options?: DisallowSearchQueryingOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Freezes the indexing plan for execution of queries.
     *
     * @param indexName The name of the index to freeze the plan of.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    freezePlan(indexName: string, options?: FreezeSearchPlanOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Unfreezes the indexing plan for execution of queries.
     *
     * @param indexName The name of the index to freeze the plan of.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    unfreezePlan(indexName: string, options?: UnfreezeSearchPlanOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Performs analysis of a specific document by an index.
     *
     * @param indexName The name of the index to use for the analysis.
     * @param document The document to analyze.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    analyzeDocument(indexName: string, document: any, options?: AnalyzeSearchDocumentOptions, callback?: NodeCallback<any>): Promise<any>;
}
