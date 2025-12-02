"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsScanConsistency = exports.AnalyticsMetrics = exports.AnalyticsWarning = exports.AnalyticsMetaData = exports.AnalyticsResult = exports.AnalyticsStatus = void 0;
/**
 * Represents the status of an analytics query.
 *
 * @category Analytics
 */
var AnalyticsStatus;
(function (AnalyticsStatus) {
    /**
     * Indicates the query is still running.
     */
    AnalyticsStatus["Running"] = "running";
    /**
     * Indicates that the query completed successfully.
     */
    AnalyticsStatus["Success"] = "success";
    /**
     * Indicates that the query completed with errors.
     */
    AnalyticsStatus["Errors"] = "errors";
    /**
     * Indicates that the query completed but the outcome was unknown.
     */
    AnalyticsStatus["Completed"] = "completed";
    /**
     * Indicates that the query was stopped.
     */
    AnalyticsStatus["Stopped"] = "stopped";
    /**
     * Indicates that the query timed out during execution.
     */
    AnalyticsStatus["Timeout"] = "timeout";
    /**
     * Indicates that a connection was closed during execution of the query.
     */
    AnalyticsStatus["Closed"] = "closed";
    /**
     * Indicates that the query stopped with fatal errors.
     */
    AnalyticsStatus["Fatal"] = "fatal";
    /**
     * Indicates that the query was aborted while executing.
     */
    AnalyticsStatus["Aborted"] = "aborted";
    /**
     * Indicates that the status of the query is unknown.
     */
    AnalyticsStatus["Unknown"] = "unknown";
})(AnalyticsStatus || (exports.AnalyticsStatus = AnalyticsStatus = {}));
/**
 * Contains the results of an analytics query.
 *
 * @category Analytics
 */
class AnalyticsResult {
    /**
     * @internal
     */
    constructor(data) {
        this.rows = data.rows;
        this.meta = data.meta;
    }
}
exports.AnalyticsResult = AnalyticsResult;
/**
 * Contains the meta-data that is returend from an analytics query.
 *
 * @category Analytics
 */
class AnalyticsMetaData {
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
    }
}
exports.AnalyticsMetaData = AnalyticsMetaData;
/**
 * Contains information about a warning which occurred during the
 * execution of an analytics query.
 *
 * @category Analytics
 */
class AnalyticsWarning {
    /**
     * @internal
     */
    constructor(data) {
        this.code = data.code;
        this.message = data.message;
    }
}
exports.AnalyticsWarning = AnalyticsWarning;
/**
 * Contains various metrics that are returned by the server following
 * the execution of an analytics query.
 *
 * @category Analytics
 */
class AnalyticsMetrics {
    /**
     * @internal
     */
    constructor(data) {
        this.elapsedTime = data.elapsedTime;
        this.executionTime = data.executionTime;
        this.resultCount = data.resultCount;
        this.resultSize = data.resultSize;
        this.errorCount = data.errorCount;
        this.processedObjects = data.processedObjects;
        this.warningCount = data.warningCount;
    }
}
exports.AnalyticsMetrics = AnalyticsMetrics;
/**
 * Represents the various scan consistency options that are available when
 * querying against the analytics service.
 *
 * @category Analytics
 */
var AnalyticsScanConsistency;
(function (AnalyticsScanConsistency) {
    /**
     * Indicates that no specific consistency is required, this is the fastest
     * options, but results may not include the most recent operations which have
     * been performed.
     */
    AnalyticsScanConsistency["NotBounded"] = "not_bounded";
    /**
     * Indicates that the results to the query should include all operations that
     * have occurred up until the query was started.  This incurs a performance
     * penalty of waiting for the index to catch up to the most recent operations,
     * but provides the highest level of consistency.
     */
    AnalyticsScanConsistency["RequestPlus"] = "request_plus";
})(AnalyticsScanConsistency || (exports.AnalyticsScanConsistency = AnalyticsScanConsistency = {}));
