/**
 * Represents the status of an analytics query.
 *
 * @category Analytics
 */
export declare enum AnalyticsStatus {
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
 * Contains the results of an analytics query.
 *
 * @category Analytics
 */
export declare class AnalyticsResult<TRow = any> {
    /**
     * The rows which have been returned by the query.
     */
    rows: TRow[];
    /**
     * The meta-data which has been returned by the query.
     */
    meta: AnalyticsMetaData;
    /**
     * @internal
     */
    constructor(data: AnalyticsResult);
}
/**
 * Contains the meta-data that is returend from an analytics query.
 *
 * @category Analytics
 */
export declare class AnalyticsMetaData {
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
    status: AnalyticsStatus;
    /**
     * Provides the signature of the query.
     */
    signature?: any;
    /**
     * Any warnings that occurred during the execution of the query.
     */
    warnings: AnalyticsWarning[];
    /**
     * Various metrics which are made available by the query engine.
     */
    metrics: AnalyticsMetrics;
    /**
     * @internal
     */
    constructor(data: AnalyticsMetaData);
}
/**
 * Contains information about a warning which occurred during the
 * execution of an analytics query.
 *
 * @category Analytics
 */
export declare class AnalyticsWarning {
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
    constructor(data: AnalyticsWarning);
}
/**
 * Contains various metrics that are returned by the server following
 * the execution of an analytics query.
 *
 * @category Analytics
 */
export declare class AnalyticsMetrics {
    /**
     * The total amount of time spent running the query, in milliseconds.
     */
    elapsedTime: number;
    /**
     * The total amount of time spent executing the query, in milliseconds.
     */
    executionTime: number;
    /**
     * The total number of rows which were part of the result set.
     */
    resultCount: number;
    /**
     * The total number of bytes which were generated as part of the result set.
     */
    resultSize: number;
    /**
     * The total number of errors which were encountered during the execution of the query.
     */
    errorCount: number;
    /**
     * The total number of objects that were processed as part of execution of the query.
     */
    processedObjects: number;
    /**
     * The total number of warnings which were encountered during the execution of the query.
     */
    warningCount: number;
    /**
     * @internal
     */
    constructor(data: AnalyticsMetrics);
}
/**
 * Represents the various scan consistency options that are available when
 * querying against the analytics service.
 *
 * @category Analytics
 */
export declare enum AnalyticsScanConsistency {
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
 * @category Analytics
 */
export interface AnalyticsQueryOptions {
    /**
     * Values to be used for the placeholders within the query.
     */
    parameters?: {
        [key: string]: any;
    } | any[];
    /**
     * Specifies the consistency requirements when executing the query.
     *
     * @see AnalyticsScanConsistency
     */
    scanConsistency?: AnalyticsScanConsistency;
    /**
     * The returned client context id for this query.
     */
    clientContextId?: string;
    /**
     * Indicates whether this query should be executed with a specific priority level.
     */
    priority?: boolean;
    /**
     * Indicates whether this query should be executed in read-only mode.
     */
    readOnly?: boolean;
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
