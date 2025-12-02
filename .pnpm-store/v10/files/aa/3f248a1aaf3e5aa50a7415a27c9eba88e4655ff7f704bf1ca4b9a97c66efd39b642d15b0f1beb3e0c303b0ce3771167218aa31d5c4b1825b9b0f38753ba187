import { MutationState } from './mutationstate';
/**
 * Represents the status of a query.
 *
 * @category Query
 */
export declare enum QueryStatus {
    /**
     * Indicates the query is still running.
     */
    Running = "running",
    /**
     * Indicates that the query completed successfully.
     */
    Success = "success",
    /**
     * Indicates that the query completed with errors.
     */
    Errors = "errors",
    /**
     * Indicates that the query completed but the outcome was unknown.
     */
    Completed = "completed",
    /**
     * Indicates that the query was stopped.
     */
    Stopped = "stopped",
    /**
     * Indicates that the query timed out during execution.
     */
    Timeout = "timeout",
    /**
     * Indicates that a connection was closed during execution of the query.
     */
    Closed = "closed",
    /**
     * Indicates that the query stopped with fatal errors.
     */
    Fatal = "fatal",
    /**
     * Indicates that the query was aborted while executing.
     */
    Aborted = "aborted",
    /**
     * Indicates that the status of the query is unknown.
     */
    Unknown = "unknown"
}
/**
 * Contains the results of a query.
 *
 * @category Query
 */
export declare class QueryResult<TRow = any> {
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
 * Contains the meta-data that is returend from a query.
 *
 * @category Query
 */
export declare class QueryMetaData {
    /**
     * The request ID which is associated with the executed query.
     */
    requestId: string;
    /**
     * The client context id which is assoicated with the executed query.
     */
    clientContextId: string;
    /**
     * The status of the query at the time the query meta-data was generated.
     */
    status: QueryStatus;
    /**
     * Provides the signature of the query.
     */
    signature?: any;
    /**
     * Any warnings that occurred during the execution of the query.
     */
    warnings: QueryWarning[];
    /**
     * Various metrics which are made available by the query engine.
     */
    metrics?: QueryMetrics;
    /**
     * Various profiling details that were generated during execution of the query.
     */
    profile?: any;
    /**
     * @internal
     */
    constructor(data: QueryMetaData);
}
/**
 * Contains information about a warning which occurred during the
 * execution of a query.
 *
 * @category Query
 */
export declare class QueryWarning {
    /**
     * The numeric code associated with the warning which occurred.
     */
    code: number;
    /**
     * A human readable representation of the warning which occurred.
     */
    message: string;
    /**
     * @internal
     */
    constructor(data: QueryWarning);
}
/**
 * Contains various metrics that are returned by the server following
 * the execution of a query.
 *
 * @category Query
 */
export declare class QueryMetrics {
    /**
     * The total amount of time spent running the query, in milliseconds.
     */
    elapsedTime: number;
    /**
     * The total amount of time spent executing the query, in milliseconds.
     */
    executionTime: number;
    /**
     * The total number of rows which were part of the sorting for the query.
     */
    sortCount: number;
    /**
     * The total number of rows which were part of the result set.
     */
    resultCount: number;
    /**
     * The total number of bytes which were generated as part of the result set.
     */
    resultSize: number;
    /**
     * The total number of rows which were altered by the query.
     */
    mutationCount: number;
    /**
     * The total number of errors which were encountered during the execution of the query.
     */
    errorCount: number;
    /**
     * The total number of warnings which were encountered during the execution of the query.
     */
    warningCount: number;
    /**
     * @internal
     */
    constructor(data: QueryMetrics);
}
/**
 * Specifies the profiling mode for a query.
 *
 * @category Query
 */
export declare enum QueryProfileMode {
    /**
     * Disables the generation of profiling data.
     */
    Off = "off",
    /**
     * Enables profiling of the phases of a query.
     */
    Phases = "phases",
    /**
     * Enables profiling of the timings of a query.
     */
    Timings = "timings"
}
/**
 * Represents the various scan consistency options that are available when
 * querying against the query service.
 *
 * @category Query
 */
export declare enum QueryScanConsistency {
    /**
     * Indicates that no specific consistency is required, this is the fastest
     * options, but results may not include the most recent operations which have
     * been performed.
     */
    NotBounded = "not_bounded",
    /**
     * Indicates that the results to the query should include all operations that
     * have occurred up until the query was started.  This incurs a performance
     * penalty of waiting for the index to catch up to the most recent operations,
     * but provides the highest level of consistency.
     */
    RequestPlus = "request_plus"
}
/**
 * @category Query
 */
export interface QueryOptions {
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
     * Specifies a MutationState which the query should be consistent with.
     *
     * @see {@link MutationState}
     */
    consistentWith?: MutationState;
    /**
     * Specifies whether this is an ad-hoc query, or if it should be prepared
     * for faster execution in the future.
     */
    adhoc?: boolean;
    /**
     * Specifies whether flex-indexes should be enabled.  Allowing the use of
     * full-text search from the query service.
     */
    flexIndex?: boolean;
    /**
     * Specifies that the query should preserve the existing document expiry times
     * when mutating documents.
     */
    preserveExpiry?: boolean;
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
     * Specifies whether the query engine should use replica nodes for kv fetches,
     * if the active node is down.
     */
    useReplica?: boolean;
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
     * Specifies the context within which this query should be executed.  This can be
     * scoped to a scope or a collection within the dataset.
     */
    queryContext?: string;
    /**
     * Specifies any additional parameters which should be passed to the query engine
     * when executing the query.
     */
    raw?: {
        [key: string]: any;
    };
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
