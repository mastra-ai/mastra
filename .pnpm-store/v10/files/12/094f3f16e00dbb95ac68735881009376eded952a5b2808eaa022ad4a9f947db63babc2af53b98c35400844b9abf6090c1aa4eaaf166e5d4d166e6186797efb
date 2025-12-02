"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewErrorMode = exports.ViewOrdering = exports.ViewScanConsistency = exports.DesignDocumentNamespace = exports.ViewRow = exports.ViewMetaData = exports.ViewResult = void 0;
/**
 * Contains the results of a view query.
 *
 * @category Views
 */
class ViewResult {
    /**
     * @internal
     */
    constructor(data) {
        this.rows = data.rows;
        this.meta = data.meta;
    }
}
exports.ViewResult = ViewResult;
/**
 * Contains the meta-data that is returend from a view query.
 *
 * @category Views
 */
class ViewMetaData {
    /**
     * @internal
     */
    constructor(data) {
        this.totalRows = data.totalRows;
        this.debug = data.debug;
    }
    /**
     * Same as {@link ViewMetaData.totalRows}, but represented as
     * the raw server-side value.
     *
     * @deprecated Use {@link ViewMetaData.totalRows} instead.
     */
    get total_rows() {
        return this.totalRows;
    }
}
exports.ViewMetaData = ViewMetaData;
/**
 * Contains the contents of a single row returned by a view query.
 *
 * @category Views
 */
class ViewRow {
    /**
     * @internal
     */
    constructor(data) {
        this.value = data.value;
        this.key = data.key;
        this.id = data.id;
    }
}
exports.ViewRow = ViewRow;
/**
 * Specifies the namespace for the associated Design Document.
 *
 * @category Views
 */
var DesignDocumentNamespace;
(function (DesignDocumentNamespace) {
    /**
     * Indicates that the Design Document namespace is within the development environment.
     */
    DesignDocumentNamespace["Development"] = "development";
    /**
     * Indicates that the Design Document namespace is within the producion environment.
     */
    DesignDocumentNamespace["Production"] = "production";
})(DesignDocumentNamespace || (exports.DesignDocumentNamespace = DesignDocumentNamespace = {}));
/**
 * Represents the various scan consistency options that are available when
 * querying against the views service.
 *
 * @category Views
 */
var ViewScanConsistency;
(function (ViewScanConsistency) {
    /**
     * Indicates that no specific consistency is required, this is the fastest
     * options, but results may not include the most recent operations which have
     * been performed.
     */
    ViewScanConsistency["NotBounded"] = "ok";
    /**
     * Indicates that the results to the query should include all operations that
     * have occurred up until the query was started.  This incurs a performance
     * penalty of waiting for the index to catch up to the most recent operations,
     * but provides the highest level of consistency.
     */
    ViewScanConsistency["RequestPlus"] = "false";
    /**
     * Indicates that the results of the query should behave according to similar
     * semantics as NotBounded, but following the execution of the query the index
     * should begin updating such that following queries will likely include up
     * to date data.
     */
    ViewScanConsistency["UpdateAfter"] = "update_after";
})(ViewScanConsistency || (exports.ViewScanConsistency = ViewScanConsistency = {}));
/**
 * Specifies the ordering mode of a view query.
 *
 * @category Views
 */
var ViewOrdering;
(function (ViewOrdering) {
    /**
     * Indicates that results should be returned in ascending order.
     */
    ViewOrdering["Ascending"] = "false";
    /**
     * Indicates that results should be returned in descending order.
     */
    ViewOrdering["Descending"] = "true";
})(ViewOrdering || (exports.ViewOrdering = ViewOrdering = {}));
/**
 * Specifies the error handling mode for a view query.
 *
 * @category Views
 */
var ViewErrorMode;
(function (ViewErrorMode) {
    /**
     * Indicates that if an error occurs during the execution of the view query,
     * the query should continue to process and include any available results.
     */
    ViewErrorMode["Continue"] = "continue";
    /**
     * Indicates that if an error occurs during the execution of the view query,
     * the query should be aborted immediately rather than attempting to continue.
     */
    ViewErrorMode["Stop"] = "stop";
})(ViewErrorMode || (exports.ViewErrorMode = ViewErrorMode = {}));
