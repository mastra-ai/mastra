import { CppDocumentId, CppTransactions, CppTransaction, CppTransactionLinks, CppTransactionGetMetaData } from './binding';
import { Cluster } from './cluster';
import { Collection } from './collection';
import { DurabilityLevel } from './generaltypes';
import { QueryMetaData, QueryProfileMode, QueryResult, QueryScanConsistency } from './querytypes';
import { Scope } from './scope';
import { Transcoder } from './transcoders';
import { Cas } from './utilities';
/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
export declare class DocumentId {
    constructor();
    /**
     * The name of the bucket containing the document.
     */
    bucket: string;
    /**
     * The name of the scope containing the document.
     */
    scope: string;
    /**
     * The name of the collection containing the document.
     */
    collection: string;
    /**
     * The key of the docuemnt.
     */
    key: string;
}
/**
 * Specifies the configuration options for a Transaction Keyspace.
 *
 * @category Transactions
 */
export interface TransactionKeyspace {
    /**
     * The name of the bucket for the Keyspace.
     */
    bucket: string;
    /**
     * The name of the scope for the Keyspace.
     */
    scope?: string;
    /**
     * The name of the collection for the Keyspace.
     */
    collection?: string;
}
/**
 * Represents the mode of the Transactional GetMulti operation.
 *
 * @category Transactions
 */
export declare enum TransactionGetMultiMode {
    /**
     * Indicates that the Transactional GetMulti op should prioritise latency.
     */
    PrioritiseLatency = "prioritise_latency",
    /**
     * Indicates that the Transactional GetMulti op should disable read skew detection.
     */
    DisableReadSkewDetection = "disable_read_skew_detection",
    /**
     * Indicates that the Transactional GetMulti op should prioritise read skew detection.
     */
    PrioritiseReadSkewDetection = "prioritise_read_skew_detection"
}
/**
 * Represents the mode of the Transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
export declare enum TransactionGetMultiReplicasFromPreferredServerGroupMode {
    /**
     * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should prioritise latency.
     */
    PrioritiseLatency = "prioritise_latency",
    /**
     * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should disable read skew detection.
     */
    DisableReadSkewDetection = "disable_read_skew_detection",
    /**
     * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should prioritise read skew detection.
     */
    PrioritiseReadSkewDetection = "prioritise_read_skew_detection"
}
/**
 * Specifies the configuration options for Transactions cleanup.
 *
 * @category Transactions
 */
export interface TransactionsCleanupConfig {
    /**
     * Specifies the period of the cleanup system.
     */
    cleanupWindow?: number;
    /**
     * Specifies whether or not the cleanup system should clean lost attempts.
     */
    disableLostAttemptCleanup?: boolean;
    /**
     * Specifies whether or not the cleanup system should clean client attempts.
     */
    disableClientAttemptCleanup?: boolean;
}
/**
 * Specifies the configuration options for Transactions queries.
 *
 * @category Transactions
 */
export interface TransactionsQueryConfig {
    /**
     * Specifies the default scan consistency level for queries.
     */
    scanConsistency?: QueryScanConsistency;
}
/**
 * Specifies the configuration options for Transactions.
 *
 * @category Transactions
 */
export interface TransactionsConfig {
    /**
     * Specifies the level of synchronous durability level.
     */
    durabilityLevel?: DurabilityLevel;
    /**
     * Specifies the default timeout for KV operations, specified in millseconds.
     *
     * @deprecated Currently a no-op.  CXXCBC-391: Adds support for ExtSDKIntegration which uses KV durable timeout internally.
     */
    kvTimeout?: number;
    /**
     * Specifies the default timeout for transactions.
     */
    timeout?: number;
    /**
     * Specifies the configuration for queries.
     */
    queryConfig?: TransactionsQueryConfig;
    /**
     * Specifies the configuration for the cleanup system.
     */
    cleanupConfig?: TransactionsCleanupConfig;
    /**
     * Specifies the Keyspace (bucket, scope & collection) for the transaction metadata.
     */
    metadataCollection?: TransactionKeyspace;
}
/**
 * Specifies the configuration options for a Transaction.
 *
 * @category Transactions
 */
export interface TransactionOptions {
    /**
     * Specifies the level of synchronous durability level.
     */
    durabilityLevel?: DurabilityLevel;
    /**
     * Specifies the timeout for the transaction.
     */
    timeout?: number;
}
/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
export declare class TransactionGetMultiSpec {
    constructor(collection: Collection, id: string, transcoder?: Transcoder);
    /**
     * The Collection where the document belongs.
     */
    collection: Collection;
    /**
     * The id (or key) of the document.
     */
    id: string;
    /**
     * The Transcoder to encode/decode the document.
     */
    transcoder?: Transcoder;
    /**
     * @internal
     */
    _toCppDocumentId(): CppDocumentId;
}
/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
export declare class TransactionGetMultiReplicasFromPreferredServerGroupSpec {
    constructor(collection: Collection, id: string, transcoder?: Transcoder);
    /**
     * The Collection where the document belongs.
     */
    collection: Collection;
    /**
     * The id (or key) of the document.
     */
    id: string;
    /**
     * The Transcoder to encode/decode the document.
     */
    transcoder?: Transcoder;
    /**
     * @internal
     */
    _toCppDocumentId(): CppDocumentId;
}
/**
 * Contains the results of a Transaction.
 *
 * @category Transactions
 */
export declare class TransactionResult {
    /**
     * @internal
     */
    constructor(data: {
        transactionId: string;
        unstagingComplete: boolean;
    });
    /**
     * The ID of the completed transaction.
     */
    transactionId: string;
    /**
     * Whether all documents were successfully unstaged and are now available
     * for non-transactional operations to see.
     */
    unstagingComplete: boolean;
}
/**
 * Contains the results of a transactional Get operation.
 *
 * @category Transactions
 */
export declare class TransactionGetResult {
    /**
     * @internal
     */
    constructor(data: TransactionGetResult);
    /**
     * The id of the document.
     */
    id: DocumentId;
    /**
     * The content of the document.
     */
    content: any;
    /**
     * The CAS of the document.
     */
    cas: Cas;
    /**
     * @internal
     */
    _links: CppTransactionLinks;
    /**
     * @internal
     */
    _metadata: CppTransactionGetMetaData;
}
/**
 * Contains the results of a specific sub-operation within a transactional GetMulti operation.
 *
 * @category Transactions
 */
export declare class TransactionGetMultiResultEntry {
    /**
     * The error, if any, which occured when attempting to perform this sub-operation.
     */
    error: Error | null;
    /**
     * The value returned by the sub-operation.
     */
    value?: any;
    /**
     * @internal
     */
    constructor(data: {
        value?: any;
        error?: Error;
    });
}
/**
 * Contains the results of a transactional GetMulti operation.
 *
 * @category Transactions
 */
export declare class TransactionGetMultiResult {
    /**
     * @internal
     */
    constructor(data: {
        content: TransactionGetMultiResultEntry[];
    });
    /**
     * The content of the document.
     */
    content: TransactionGetMultiResultEntry[];
    /**
     * Indicates whether the document at the specified index exists.
     *
     * @param index The result index to check.
     */
    exists(index: number): boolean;
    /**
     * Provides the content at the specified index, if it exists.
     *
     * @param index The result index to check.
     */
    contentAt(index: number): any;
}
/**
 * Contains the results of a specific sub-operation within
 * a transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
export declare class TransactionGetMultiReplicasFromPreferredServerGroupResultEntry {
    /**
     * The error, if any, which occured when attempting to access the document.
     */
    error: Error | null;
    /**
     * The value of the document.
     */
    value?: any;
    /**
     * @internal
     */
    constructor(data: {
        value?: any;
        error?: Error;
    });
}
/**
 * Contains the results of a transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
export declare class TransactionGetMultiReplicasFromPreferredServerGroupResult {
    /**
     * @internal
     */
    constructor(data: {
        content: TransactionGetMultiReplicasFromPreferredServerGroupResultEntry[];
    });
    /**
     * The content of the document.
     */
    content: TransactionGetMultiReplicasFromPreferredServerGroupResultEntry[];
    /**
     * Indicates whether the document at the specified index exists.
     *
     * @param index The result index to check.
     */
    exists(index: number): boolean;
    /**
     * Provides the content at the specified index, if it exists.
     *
     * @param index The result index to check.
     */
    contentAt(index: number): any;
}
/**
 * Contains the results of a transactional Query operation.
 *
 * @category Transactions
 */
export declare class TransactionQueryResult<TRow = any> {
    /**
     * The rows which have been returned by the query.
     */
    rows: TRow[];
    /**
     * The meta-data which has been returned by the query.
     */
    meta: QueryMetaData;
    /**
     * @internal
     */
    constructor(data: QueryResult);
}
/**
 * @category Transactions
 */
export interface TransactionQueryOptions {
    /**
     * Values to be used for the placeholders within the query.
     */
    parameters?: {
        [key: string]: any;
    } | any[];
    /**
     * Specifies the consistency requirements when executing the query.
     *
     * @see QueryScanConsistency
     */
    scanConsistency?: QueryScanConsistency;
    /**
     * Specifies whether this is an ad-hoc query, or if it should be prepared
     * for faster execution in the future.
     */
    adhoc?: boolean;
    /**
     * The returned client context id for this query.
     */
    clientContextId?: string;
    /**
     * This is an advanced option, see the query service reference for more
     * information on the proper use and tuning of this option.
     */
    maxParallelism?: number;
    /**
     * This is an advanced option, see the query service reference for more
     * information on the proper use and tuning of this option.
     */
    pipelineBatch?: number;
    /**
     * This is an advanced option, see the query service reference for more
     * information on the proper use and tuning of this option.
     */
    pipelineCap?: number;
    /**
     * This is an advanced option, see the query service reference for more
     * information on the proper use and tuning of this option.  Specified
     * in milliseconds.
     */
    scanWait?: number;
    /**
     * This is an advanced option, see the query service reference for more
     * information on the proper use and tuning of this option.
     */
    scanCap?: number;
    /**
     * Specifies that this query should be executed in read-only mode, disabling
     * the ability for the query to make any changes to the data.
     */
    readOnly?: boolean;
    /**
     * Specifies the level of profiling that should be used for the query.
     */
    profile?: QueryProfileMode;
    /**
     * Specifies whether metrics should be captured as part of the execution of
     * the query.
     */
    metrics?: boolean;
    /**
     * Specifies any additional parameters which should be passed to the query engine
     * when executing the query.
     */
    raw?: {
        [key: string]: any;
    };
    /**
     * Specifies the scope to run this query in.
     */
    scope?: Scope;
}
/**
 * @category Transactions
 */
export interface TransactionGetOptions {
    /**
     * Specifies an explicit transcoder to use for this specific operation.
     */
    transcoder?: Transcoder;
}
/**
 * @category Transactions
 */
export interface TransactionGetReplicaFromPreferredServerGroupOptions {
    /**
     * Specifies an explicit transcoder to use for this specific operation.
     */
    transcoder?: Transcoder;
}
/**
 * @category Transactions
 */
export interface TransactionGetMultiOptions {
    /**
     * Specifies a mode to use for this specific operation.
     */
    mode?: TransactionGetMultiMode;
}
/**
 * @category Transactions
 */
export interface TransactionGetMultiReplicasFromPreferredServerGroupOptions {
    /**
     * Specifies a mode to use for this specific operation.
     */
    mode?: TransactionGetMultiReplicasFromPreferredServerGroupMode;
}
/**
 * @category Transactions
 */
export interface TransactionInsertOptions {
    /**
     * Specifies an explicit transcoder to use for this specific operation.
     */
    transcoder?: Transcoder;
}
/**
 * @category Transactions
 */
export interface TransactionReplaceOptions {
    /**
     * Specifies an explicit transcoder to use for this specific operation.
     */
    transcoder?: Transcoder;
}
/**
 * Provides an interface to preform transactional operations in a transaction.
 *
 * @category Transactions
 */
export declare class TransactionAttemptContext {
    private _impl;
    private _transcoder;
    /**
     * @internal
     */
    constructor(txns: Transactions, config?: TransactionOptions);
    /**
    @internal
    */
    get impl(): CppTransaction;
    /**
     * @internal
     */
    _newAttempt(): Promise<void>;
    /**
     * Retrieves the value of a document from the collection.
     *
     * @param collection The collection the document lives in.
     * @param key The document key to retrieve.
     * @param options Optional parameters for this operation.
     */
    get(collection: Collection, key: string, options?: TransactionGetOptions): Promise<TransactionGetResult>;
    /**
     * Retrieves the value of a document from the collection.
     *
     * @param collection The collection the document lives in.
     * @param key The document key to retrieve.
     * @param options Optional parameters for this operation.
     */
    getReplicaFromPreferredServerGroup(collection: Collection, key: string, options?: TransactionGetReplicaFromPreferredServerGroupOptions): Promise<TransactionGetResult>;
    /**
     * Retrieves the documents specified in the list of specs.
     *
     * @param specs The documents to retrieve.
     * @param options Optional parameters for this operation.
     */
    getMultiReplicasFromPreferredServerGroup(specs: TransactionGetMultiReplicasFromPreferredServerGroupSpec[], options?: TransactionGetMultiReplicasFromPreferredServerGroupOptions): Promise<TransactionGetMultiReplicasFromPreferredServerGroupResult>;
    /**
     * Retrieves the documents specified in the list of specs.
     *
     * @param specs The documents to retrieve.
     * @param options Optional parameters for this operation.
     */
    getMulti(specs: TransactionGetMultiSpec[], options?: TransactionGetMultiOptions): Promise<TransactionGetMultiResult>;
    /**
     * Inserts a new document to the collection, failing if the document already exists.
     *
     * @param collection The collection the document lives in.
     * @param key The document key to insert.
     * @param content The document content to insert.
     * @param options Optional parameters for this operation.
     */
    insert(collection: Collection, key: string, content: any, options?: TransactionInsertOptions): Promise<TransactionGetResult>;
    /**
     * Replaces a document in a collection.
     *
     * @param doc The document to replace.
     * @param content The document content to insert.
     * @param options Optional parameters for this operation.
     */
    replace(doc: TransactionGetResult, content: any, options?: TransactionReplaceOptions): Promise<TransactionGetResult>;
    /**
     * Removes a document from a collection.
     *
     * @param doc The document to remove.
     */
    remove(doc: TransactionGetResult): Promise<void>;
    /**
     * Executes a query in the context of this transaction.
     *
     * @param statement The statement to execute.
     * @param options Optional parameters for this operation.
     */
    query<TRow = any>(statement: string, options?: TransactionQueryOptions): Promise<TransactionQueryResult<TRow>>;
    /**
     * @internal
     */
    _commit(): Promise<TransactionResult>;
    /**
     * @internal
     */
    _rollback(): Promise<void>;
}
/**
 * Provides an interface to access transactions.
 *
 * @category Transactions
 */
export declare class Transactions {
    private _cluster;
    private _impl;
    /**
    @internal
    */
    constructor(cluster: Cluster, config?: TransactionsConfig);
    /**
    @internal
    */
    get impl(): CppTransactions;
    /**
    @internal
    */
    _close(): Promise<void>;
    /**
     * Executes a transaction.
     *
     * @param logicFn The transaction lambda to execute.
     * @param config Configuration operations for the transaction.
     */
    run(logicFn: (attempt: TransactionAttemptContext) => Promise<void>, config?: TransactionOptions): Promise<TransactionResult>;
}
