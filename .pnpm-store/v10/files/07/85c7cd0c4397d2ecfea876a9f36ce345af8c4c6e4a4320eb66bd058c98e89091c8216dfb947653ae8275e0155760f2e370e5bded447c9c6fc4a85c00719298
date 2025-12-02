"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryScanConsistency = exports.QueryProfileMode = exports.QueryMetrics = exports.QueryWarning = exports.QueryMetaData = exports.QueryResult = exports.QueryStatus = void 0;
/**
 * Represents the status of a query.
 *
 * @category Query
 */
var QueryStatus;
(function (QueryStatus) {
    /**
     * Indicates the query is still running.
     */
    QueryStatus["Running"] = "running";
    /**
     * Indicates that the query completed successfully.
     */
    QueryStatus["Success"] = "success";
    /**
     * Indicates that the query completed with errors.
     */
    QueryStatus["Errors"] = "errors";
    /**
     * Indicates that the query completed but the outcome was unknown.
     */
    QueryStatus["Completed"] = "completed";
    /**
     * Indicates that the query was stopped.
     */
    QueryStatus["Stopped"] = "stopped";
    /**
     * Indicates that the query timed out during execution.
     */
    QueryStatus["Timeout"] = "timeout";
    /**
     * Indicates that a connection was closed during execution of the query.
     */
    QueryStatus["Closed"] = "closed";
    /**
     * Indicates that the query stopped with fatal errors.
     */
    QueryStatus["Fatal"] = "fatal";
    /**
     * Indicates that the query was aborted while executing.
     */
    QueryStatus["Aborted"] = "aborted";
    /**
     * Indicates that the status of the query is unknown.
     */
    QueryStatus["Unknown"] = "unknown";
})(QueryStatus || (exports.QueryStatus = QueryStatus = {}));
/**
 * Contains the results of a query.
 *
 * @category Query
 */
class QueryResult {
    /**
     * @internal
     */
    constructor(data) {
        this.rows = data.rows;
        this.meta = data.meta;
    }
}
exports.QueryResult = QueryResult;
/**
 * Contains the meta-data that is returend from a query.
 *
 * @category Query
 */
class QueryMetaData {
    /**
     * @internal
     */
    constructor(data) {
        this.requestId = data.requestId;
        this.clientContextId = data.clientContextId;
        this.status = data.status;
        this.signature = data.signature;
        this.warnings = data.warnings;
        this.metrics = data.metrics;
        this.profile = data.profile;
    }
}
exports.QueryMetaData = QueryMetaData;
/**
 * Contains information about a warning which occurred during the
 * execution of a query.
 *
 * @category Query
 */
class QueryWarning {
    /**
     * @internal
     */
    constructor(data) {
        this.code = data.code;
        this.message = data.message;
    }
}
exports.QueryWarning = QueryWarning;
/**
 * Contains various metrics that are returned by the server following
 * the execution of a query.
 *
 * @category Query
 */
class QueryMetrics {
    /**
     * @internal
     */
    constructor(data) {
        this.elapsedTime = data.elapsedTime;
        this.executionTime = data.executionTime;
        this.sortCount = data.sortCount;
        this.resultCount = data.resultCount;
        this.resultSize = data.resultSize;
        this.mutationCount = data.mutationCount;
        this.errorCount = data.errorCount;
        this.warningCount = data.warningCount;
    }
}
exports.QueryMetrics = QueryMetrics;
/**
 * Specifies the profiling mode for a query.
 *
 * @category Query
 */
var QueryProfileMode;
(function (QueryProfileMode) {
    /**
     * Disables the generation of profiling data.
     */
    QueryProfileMode["Off"] = "off";
    /**
     * Enables profiling of the phases of a query.
     */
    QueryProfileMode["Phases"] = "phases";
    /**
     * Enables profiling of the timings of a query.
     */
    QueryProfileMode["Timings"] = "timings";
})(QueryProfileMode || (exports.QueryProfileMode = QueryProfileMode = {}));
/**
 * Represents the various scan consistency options that are available when
 * querying against the query service.
 *
 * @category Query
 */
var QueryScanConsistency;
(function (QueryScanConsistency) {
    /**
     * Indicates that no specific consistency is required, this is the fastest
     * options, but results may not include the most recent operations which have
     * been performed.
     */
    QueryScanConsistency["NotBounded"] = "not_bounded";
    /**
     * Indicates that the results to the query should include all operations that
     * have occurred up until the query was started.  This incurs a performance
     * penalty of waiting for the index to catch up to the most recent operations,
     * but provides the highest level of consistency.
     */
    QueryScanConsistency["RequestPlus"] = "request_plus";
})(QueryScanConsistency || (exports.QueryScanConsistency = QueryScanConsistency = {}));
